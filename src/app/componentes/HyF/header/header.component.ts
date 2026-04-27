import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import {
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  of,
  startWith,
  switchMap,
  tap
} from 'rxjs';
import { normalizeSearchText } from '../../../core/search/trie';
import { NegocioLite, NegocioSearchService } from '../../../servicios/buscador/negocio-search.service';
import { HomeHeaderService, HomeHeaderPopupKind } from '../../../servicios/homeHeaderServicio/home-header.service';

type SearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly negocioSearchService = inject(NegocioSearchService);
  private readonly homeHeaderService = inject(HomeHeaderService);

  readonly logoSrc = 'assets/imagenes/logo_nenufar.png';
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly busquedaEstado = signal<SearchStatus>('idle');
  readonly resultadosBusqueda = signal<NegocioLite[]>([]);
  readonly currentUrl = signal(this.router.url);
  readonly currentQuery = signal('');
  readonly sinResultadosBusqueda = computed(
    () =>
      normalizeSearchText(this.currentQuery()).length >= 2 &&
      (this.busquedaEstado() === 'empty' || this.busquedaEstado() === 'error')
  );

  private readonly searchSubscription: Subscription;
  private readonly routerEventsSubscription = this.router.events
    .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
    .subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
    });

  constructor() {
    this.searchSubscription = this.searchControl.valueChanges
      .pipe(
        startWith(this.searchControl.value),
        tap((value) => {
          this.currentQuery.set(value);

          const normalized = normalizeSearchText(value);
          this.busquedaEstado.set(normalized.length >= 2 ? 'loading' : 'idle');

          if (!normalized) {
            this.resultadosBusqueda.set([]);
          }
        }),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => this.searchWithState(value))
      )
      .subscribe(({ normalized, results, status }) => {
        this.resultadosBusqueda.set(results.slice(0, 6));

        if (!normalized) {
          this.busquedaEstado.set('idle');
          return;
        }

        if (normalized.length < 2) {
          this.busquedaEstado.set(results.length ? 'ready' : 'idle');
          return;
        }

        this.busquedaEstado.set(status);
      });
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
    this.routerEventsSubscription.unsubscribe();
  }

  async buscarPrimerNegocio(): Promise<void> {
    const primerResultado = this.resultadosBusqueda()[0];
    if (primerResultado) {
      this.seleccionarNegocio(primerResultado);
      return;
    }

    const normalized = normalizeSearchText(this.searchControl.value);
    if (normalized.length < 2) {
      return;
    }

    this.busquedaEstado.set('loading');

    try {
      const results = await firstValueFrom(this.negocioSearchService.search(normalized));
      const firstMatch = results[0];

      if (firstMatch) {
        this.seleccionarNegocio(firstMatch);
        return;
      }

      this.resultadosBusqueda.set([]);
      this.busquedaEstado.set('empty');
    } catch {
      this.resultadosBusqueda.set([]);
      this.busquedaEstado.set('error');
    }
  }

  seleccionarNegocio(negocio: NegocioLite): void {
    this.searchControl.setValue(negocio.nombre, { emitEvent: false });
    this.currentQuery.set(negocio.nombre);
    this.resetearBusqueda(false);
    void this.router.navigate(['/negocio', negocio.id]);
  }

  irAInicio(): void {
    this.resetearBusqueda();
    void this.router.navigate(['/inicio']);
  }

  irAEstanque(): void {
    this.resetearBusqueda();
    void this.router.navigate(['/estanque']);
  }

  abrirInfo(): void {
    void this.irAInicioYAbrirPopup('info');
  }

  abrirAyuda(): void {
    void this.irAInicioYAbrirPopup('ayuda');
  }

  getCategoriaNombre(negocio: NegocioLite): string {
    return negocio.categoria?.nombre || 'Negocio local';
  }

  private async irAInicioYAbrirPopup(kind: HomeHeaderPopupKind): Promise<void> {
    if (this.currentUrl() !== '/inicio') {
      await this.router.navigate(['/inicio']);
    }

    this.homeHeaderService.requestPopup(kind);
  }

  private searchWithState(value: string) {
    const normalized = normalizeSearchText(value);

    if (!normalized) {
      return of({
        normalized,
        results: [] as NegocioLite[],
        status: 'idle' as SearchStatus
      });
    }

    return this.negocioSearchService.search(normalized).pipe(
      map((results) => ({
        normalized,
        results,
        status: results.length ? ('ready' as SearchStatus) : ('empty' as SearchStatus)
      })),
      catchError(() =>
        of({
          normalized,
          results: [] as NegocioLite[],
          status: 'error' as SearchStatus
        })
      )
    );
  }

  private resetearBusqueda(limpiarTermino = true): void {
    if (limpiarTermino) {
      this.searchControl.setValue('', { emitEvent: false });
      this.currentQuery.set('');
    }

    this.resultadosBusqueda.set([]);
    this.busquedaEstado.set('idle');
  }
}
