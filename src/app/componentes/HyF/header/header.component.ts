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
import {
  getNenufarNegocio as getNenufarNegocioAsset,
  addUnsplashParams,
  buildUnsplashSrcset,
} from '../../../core/negocio/negocio-visuals';
import { AccessRequiredModalComponent } from '../../../components/shared/access-required-modal/access-required-modal.component';
import { NenunInfoComponent } from '../../nenun-info/nenun-info.component';
import {
  AuthService,
  AuthUser,
  resolvePrivateProfileRoute,
} from '../../../servicios/authService/auth.service';
import {
  NegocioService,
  resolveNegocioRouteKey,
} from '../../../servicios/negocioService/negocio.service';
import { NegocioLite, NegocioSearchService } from '../../../servicios/buscador/negocio-search.service';

type SearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NenunInfoComponent, AccessRequiredModalComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly negocioSearchService = inject(NegocioSearchService);
  private readonly negocioService = inject(NegocioService);

  readonly logoSrc = 'assets/imagenes/logo_nenufar_small.png';
  readonly flowerSrc = 'assets/imagenes/flor_logo.png';
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly busquedaEstado = signal<SearchStatus>('idle');
  readonly resultadosBusqueda = signal<NegocioLite[]>([]);
  readonly currentQuery = signal('');
  readonly nenunInfoAbierto = signal(false);
  readonly accessModalAbierto = signal(false);
  readonly accessModalMessage = signal('Necesitas iniciar sesion para seguir negocios y guardar tus favoritos.');
  readonly usuarioActual = signal<AuthUser | null>(this.authService.obtenerUsuario());
  readonly mostrarMiPerfil = computed(() => this.authService.isAuthenticated());
  readonly mostrarAccesoAdmin = computed(
    () => this.usuarioActual()?.rolGlobal === 'ADMIN',
  );
  readonly sinResultadosBusqueda = computed(
    () =>
      normalizeSearchText(this.currentQuery()).length >= 2 &&
      (this.busquedaEstado() === 'empty' || this.busquedaEstado() === 'error')
  );

  private readonly searchSubscription: Subscription;
  private readonly routerSubscription: Subscription;

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

    this.syncUsuarioActual();
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.syncUsuarioActual());
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
    this.routerSubscription.unsubscribe();
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
    void this.router.navigate(this.getNegocioRoute(negocio));
  }

  irAInicio(): void {
    this.resetearBusqueda();
    void this.router.navigate(['/inicio']);
  }

  irAEstanque(): void {
    this.resetearBusqueda();
    void this.router.navigate(['/estanque']);
  }

  abrirNenunInfo(): void {
    this.resetearBusqueda(false);
    this.nenunInfoAbierto.set(true);
  }

  cerrarNenunInfo(): void {
    this.nenunInfoAbierto.set(false);
  }

  getCategoriaNombre(negocio: NegocioLite): string {
    return negocio.categoria?.nombre || 'Negocio local';
  }

  getSearchMeta(negocio: NegocioLite): string {
    const publicHandle = resolveNegocioRouteKey(negocio);
    const parts = [
      publicHandle ? `@${publicHandle}` : '',
      this.getCategoriaNombre(negocio),
      negocio.ciudad || negocio.provincia || '',
    ].filter(Boolean);

    return parts.join(' · ');
  }

  private getNegocioRoute(negocio: NegocioLite): (string | number)[] {
    const routeKey = resolveNegocioRouteKey(negocio);
    return routeKey ? ['/', routeKey] : ['/negocio', negocio.id];
  }

  getNenufarNegocio(negocio: NegocioLite): string {
    return addUnsplashParams(getNenufarNegocioAsset(negocio), 96);
  }

  getNenufarNegocioSrcset(negocio: NegocioLite): string {
    return buildUnsplashSrcset(getNenufarNegocioAsset(negocio), [48, 96, 144]);
  }

  getReviewSummary(negocio: NegocioLite): string {
    if (negocio.reviewCount <= 0) {
      return 'Aún sin reseñas públicas';
    }

    const latest = negocio.latestReviews[0];
    if (!latest) {
      return `${negocio.reviewCount} reseña${negocio.reviewCount !== 1 ? 's' : ''}`;
    }

    return `${negocio.reviewCount} reseña${negocio.reviewCount !== 1 ? 's' : ''} · ${latest.contenidoCorto}`;
  }

  toggleSeguir(event: Event, negocio: NegocioLite): void {
    event.stopPropagation();

    if (!this.authService.isAuthenticated()) {
      this.accessModalAbierto.set(true);
      return;
    }

    const request$ = negocio.isFollowing
      ? this.negocioService.dejarDeSeguirNegocio(negocio.id)
      : this.negocioService.seguirNegocio(negocio.id);

    request$.subscribe({
      next: (response) => {
        this.resultadosBusqueda.update((items) =>
          items.map((item) =>
            item.id === negocio.id
              ? {
                  ...item,
                  isFollowing: !negocio.isFollowing,
                  followersCount: Number(response.total ?? item.followersCount ?? 0) || 0,
                }
              : item,
          ),
        );
      },
      error: () => {
        this.accessModalMessage.set('No hemos podido actualizar el seguimiento del negocio.');
        this.accessModalAbierto.set(true);
      },
    });
  }

  irALogin(): void {
    this.accessModalAbierto.set(false);
    void this.router.navigate(['/estanque']);
  }

  async irAPerfilPrivado(): Promise<void> {
    this.resetearBusqueda();
    const shouldHydrate = !this.usuarioActual() && this.authService.hasSessionHint();
    const usuario = shouldHydrate
      ? await firstValueFrom(this.authService.hydrateSession({ forceRemote: true }))
      : this.usuarioActual();

    void this.router.navigate(resolvePrivateProfileRoute(usuario ?? this.usuarioActual()));
  }

  irAAdmin(): void {
    this.resetearBusqueda();
    void this.router.navigate(['/admin']);
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

  private syncUsuarioActual(): void {
    this.usuarioActual.set(this.authService.obtenerUsuario());
  }
}
