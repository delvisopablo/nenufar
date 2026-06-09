import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
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
  resolveOwnedBusinessId,
  resolvePrivateProfileRoute,
} from '../../../servicios/authService/auth.service';
import {
  NegocioService,
  resolveNegocioRouteCommands,
  resolveNegocioRouteKey,
} from '../../../servicios/negocioService/negocio.service';
import { NegocioLite, NegocioSearchService } from '../../../servicios/buscador/negocio-search.service';
import {
  Categoria,
  CategoriaServiceService,
  Subcategoria,
} from '../../../servicios/categoriaServicio/categoriaService.service';

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
  private readonly categoriaService = inject(CategoriaServiceService);

  readonly logoSrc = 'assets/imagenes/logo_nenufar_small.png';
  readonly flowerSrc = 'assets/imagenes/flor_logo.png';
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly busquedaEstado = signal<SearchStatus>('idle');
  readonly resultadosBusqueda = signal<NegocioLite[]>([]);
  readonly currentQuery = signal('');
  readonly categorias = signal<Categoria[]>([]);
  readonly subcategorias = signal<Subcategoria[]>([]);
  readonly filtrosAbiertos = signal(false);
  readonly filtrosCargando = signal(false);
  readonly subcategoriasCargando = signal(false);
  readonly categoriaSeleccionadaId = signal<number | null>(null);
  readonly subcategoriaSeleccionadaId = signal<number | null>(null);
  readonly nenunInfoAbierto = signal(false);
  readonly accessModalAbierto = signal(false);
  readonly accessModalMessage = signal('Necesitas iniciar sesion para seguir negocios y guardar tus favoritos.');
  readonly navigationError = signal('');
  readonly usuarioActual = computed(() => this.authService.usuarioActual());
  readonly mostrarMiPerfil = computed(() => this.authService.isAuthenticated());
  readonly mostrarAccesoAdmin = computed(
    () => this.usuarioActual()?.rolGlobal === 'ADMIN',
  );
  readonly sinResultadosBusqueda = computed(
    () =>
      (normalizeSearchText(this.currentQuery()).length >= 2 || this.hayFiltrosActivos()) &&
      this.busquedaEstado() === 'empty',
  );
  readonly errorBusqueda = computed(
    () =>
      (normalizeSearchText(this.currentQuery()).length >= 2 || this.hayFiltrosActivos()) &&
      this.busquedaEstado() === 'error',
  );
  readonly hayFiltrosActivos = computed(
    () => Boolean(this.categoriaSeleccionadaId() || this.subcategoriaSeleccionadaId()),
  );
  readonly categoriaSeleccionada = computed(
    () => this.categorias().find((item) => item.id === this.categoriaSeleccionadaId()) ?? null,
  );
  readonly subcategoriaSeleccionada = computed(
    () => this.subcategorias().find((item) => item.id === this.subcategoriaSeleccionadaId()) ?? null,
  );
  readonly resumenFiltros = computed(() => {
    const categoria = this.categoriaSeleccionada()?.nombre;
    const subcategoria = this.subcategoriaSeleccionada()?.nombre;

    if (categoria && subcategoria) {
      return `${categoria} · ${subcategoria}`;
    }

    return categoria || 'Filtros';
  });

  private readonly searchSubscription: Subscription;

  constructor() {
    this.searchSubscription = this.searchControl.valueChanges
      .pipe(
        startWith(this.searchControl.value),
        tap((value) => {
          this.currentQuery.set(value);
          this.navigationError.set('');

          const normalized = normalizeSearchText(value);
          this.busquedaEstado.set(
            normalized.length >= 2 || this.hayFiltrosActivos() ? 'loading' : 'idle',
          );

          if (!normalized && !this.hayFiltrosActivos()) {
            this.resultadosBusqueda.set([]);
          }
        }),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => this.searchWithState(value))
      )
      .subscribe(({ normalized, results, status }) => {
        this.resultadosBusqueda.set(results);

        if (!normalized && !this.hayFiltrosActivos()) {
          this.busquedaEstado.set('idle');
          return;
        }

        if (normalized.length < 2) {
          this.busquedaEstado.set(results.length ? 'ready' : 'idle');
          return;
        }

        this.busquedaEstado.set(status);
      });

    this.cargarCategorias();
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
  }

  async buscarPrimerNegocio(): Promise<void> {
    // Siempre ejecuta la búsqueda filtrada al pulsar "Buscar" o Enter.
    // Así el usuario ve los resultados actualizados con el texto + filtros activos
    // en lugar de navegar automáticamente al primer resultado.
    await this.ejecutarBusquedaActual();
  }

  seleccionarNegocio(negocio: NegocioLite): void {
    this.searchControl.setValue(negocio.nombre, { emitEvent: false });
    this.currentQuery.set(negocio.nombre);
    this.navigationError.set('');

    const negocioRoute = this.getNegocioRoute(negocio);
    if (!negocioRoute) {
      this.navigationError.set('Ese negocio no se abrió porque aún no tiene una ruta pública.');
      return;
    }

    this.resetearBusqueda(false);
    void this.router.navigate(negocioRoute);
  }

  irAInicio(): void {
    this.resetearBusqueda();
    if (this.router.url.split('?')[0].split('#')[0] === '/inicio') {
      window.location.reload();
      return;
    }

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

  getSubcategoriaNombre(negocio: NegocioLite): string {
    return negocio.subcategoria?.nombre || '';
  }

  getSearchMeta(negocio: NegocioLite): string {
    const publicHandle = resolveNegocioRouteKey(negocio);
    const parts = [
      publicHandle ? `@${publicHandle}` : '',
      this.getCategoriaNombre(negocio),
      this.getSubcategoriaNombre(negocio),
      negocio.ciudad || negocio.provincia || '',
    ].filter(Boolean);

    return parts.join(' · ');
  }

  private getNegocioRoute(negocio: NegocioLite): (string | number)[] | null {
    const negocioId = Number(negocio.id ?? 0);
    const negocioDuenoId = Number(negocio.duenoId ?? 0);
    const ownedBusinessId = resolveOwnedBusinessId(this.usuarioActual());
    const usuarioActualId = Number(this.usuarioActual()?.id ?? 0);
    const esMiNegocio =
      (Number.isFinite(negocioId) && negocioId > 0 && ownedBusinessId === negocioId) ||
      (Number.isFinite(negocioDuenoId) && negocioDuenoId > 0 && negocioDuenoId === usuarioActualId);

    if (esMiNegocio) {
      return resolvePrivateProfileRoute(this.usuarioActual());
    }

    return resolveNegocioRouteCommands(negocio);
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
        this.accessModalMessage.set('El seguimiento del negocio no se actualizó.');
        this.accessModalAbierto.set(true);
      },
    });
  }

  toggleFiltros(): void {
    this.filtrosAbiertos.update((open) => !open);
  }

  seleccionarCategoria(categoria: Categoria | null): void {
    this.categoriaSeleccionadaId.set(categoria?.id ?? null);
    this.subcategoriaSeleccionadaId.set(null);
    this.subcategorias.set([]);
    this.navigationError.set('');

    if (categoria) {
      this.cargarSubcategorias(categoria.id);
    }

    // Lanza búsqueda inmediatamente al cambiar de categoría.
    // cerrarPanel=false para que el usuario pueda seguir eligiendo subcategoría.
    void this.ejecutarBusquedaActual(false);
  }

  seleccionarSubcategoria(subcategoria: Subcategoria | null): void {
    this.subcategoriaSeleccionadaId.set(subcategoria?.id ?? null);
    this.navigationError.set('');
    // Lanza búsqueda inmediatamente al cambiar subcategoría.
    // cerrarPanel=false para que el usuario vea el panel y pueda limpiar filtros.
    void this.ejecutarBusquedaActual(false);
  }

  limpiarFiltros(): void {
    this.categoriaSeleccionadaId.set(null);
    this.subcategoriaSeleccionadaId.set(null);
    this.subcategorias.set([]);
    this.filtrosAbiertos.set(false);
    void this.ejecutarBusquedaActual();
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

  irAListaCompra(): void {
    this.resetearBusqueda();
    void this.router.navigate(['/Nenulista']);
  }

  private searchWithState(value: string) {
    const normalized = normalizeSearchText(value);
    const filters = this.getFiltrosBusqueda();

    if (!normalized && !this.hayFiltrosActivos()) {
      return of({
        normalized,
        results: [] as NegocioLite[],
        status: 'idle' as SearchStatus
      });
    }

    return this.negocioSearchService.search(normalized, filters).pipe(
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

    this.navigationError.set('');
    this.resultadosBusqueda.set([]);
    this.busquedaEstado.set('idle');
    this.filtrosAbiertos.set(false);
  }

  private getFiltrosBusqueda(): { categoriaId?: number; subcategoriaId?: number } {
    return {
      ...(this.categoriaSeleccionadaId() ? { categoriaId: this.categoriaSeleccionadaId() ?? undefined } : {}),
      ...(this.subcategoriaSeleccionadaId() ? { subcategoriaId: this.subcategoriaSeleccionadaId() ?? undefined } : {}),
    };
  }

  private cargarCategorias(): void {
    this.filtrosCargando.set(true);
    this.categoriaService.list().pipe(
      catchError(() => of([] as Categoria[])),
    ).subscribe((categorias) => {
      this.categorias.set(categorias);
      this.filtrosCargando.set(false);
    });
  }

  private cargarSubcategorias(categoriaId: number): void {
    this.subcategoriasCargando.set(true);
    this.categoriaService.listSubcategorias(categoriaId).pipe(
      catchError(() => of([] as Subcategoria[])),
    ).subscribe((subcategorias) => {
      this.subcategorias.set(subcategorias.filter((item) => item.activo !== false));
      this.subcategoriasCargando.set(false);
    });
  }

  private async ejecutarBusquedaActual(cerrarPanel = true): Promise<void> {
    const normalized = normalizeSearchText(this.searchControl.value);

    if (!normalized && !this.hayFiltrosActivos()) {
      this.resultadosBusqueda.set([]);
      this.busquedaEstado.set('idle');
      return;
    }

    this.busquedaEstado.set('loading');

    try {
      const results = await firstValueFrom(
        this.negocioSearchService.search(normalized, this.getFiltrosBusqueda()),
      );
      this.resultadosBusqueda.set(results);
      this.busquedaEstado.set(results.length ? 'ready' : 'empty');
      if (cerrarPanel) {
        this.filtrosAbiertos.set(false);
      }
    } catch {
      this.resultadosBusqueda.set([]);
      this.busquedaEstado.set('error');
    }
  }
}
