import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { PondBackgroundComponent } from '../shared/pond-background/pond-background.component';
import { RutaLocalSearchService } from './ruta-local-search.service';
import {
  ListaCompraService,
  ListaCompraItem,
} from '../../servicios/listaCompraServicio/lista-compra.service';

export type RouteMode = 'recados' | 'cerveza' | 'gastro' | 'tarde' | 'improvisar';
export type Screen = 'tipo' | 'improvisar-setup' | 'home' | 'ruta' | 'add' | 'resumen';

export interface RouteItem {
  name: string;
  qty: number;
  note?: string;
  nenulistaItemId?: number | string;
  completado?: boolean;
}

export interface Parada {
  id: number;
  placeName: string;
  placeAddress: string;
  items: RouteItem[];
  startTime?: string;
  endTime?: string;
  done: boolean;
  current: boolean;
}

export interface SavedRoute {
  id: number;
  name: string;
  mode: RouteMode;
  date: string;
  paradas: Parada[];
  totalItems: number;
  duration: string;
}

export interface SearchResult {
  id: number;
  name: string;
  type: string;
  address: string;
  distance: string;
  emoji: string;
}

export interface ModeConfig {
  icon: string;
  name: string;
  appName: string;
  color: string;
  colorLight: string;
  colorDark: string;
  mapBg: string;
  startBtn: string;
  stopLabel: string;
  itemLabel: string;
  itemPlaceholder: string;
  qtyLabel: string;
  noteLabel: string;
  notePlaceholder: string;
  addStopLabel: string;
  endLabel: string;
  itemChips: string[];
  statUnit: string;
  trophy: string;
  resTitle: string;
}

const MODE_CONFIGS: Record<RouteMode, ModeConfig> = {
  recados: {
    icon: '🛒',
    name: 'Recados de barrio',
    appName: 'RutaLocal',
    color: '#5DADE2',
    colorLight: 'rgba(93, 173, 226, 0.18)',
    colorDark: '#EEF8FF',
    mapBg: 'linear-gradient(180deg, rgba(93, 173, 226, 0.36), rgba(10, 31, 61, 0.94))',
    startBtn: 'Empezar ruta de recados',
    stopLabel: 'tienda',
    itemLabel: 'Producto',
    itemPlaceholder: 'Ej. tomates, pan o leche',
    qtyLabel: 'Cantidad',
    noteLabel: 'Nota opcional',
    notePlaceholder: 'Ej. que este maduro o sin gluten',
    addStopLabel: 'Anadir siguiente tienda',
    endLabel: 'Terminar recados',
    itemChips: ['Tomates', 'Sandia', 'Pan', 'Leche', 'Huevos', 'Cafe'],
    statUnit: 'productos',
    trophy: '✅',
    resTitle: 'Recados completados'
  },
  cerveza: {
    icon: '🍺',
    name: 'Ruta cervecera',
    appName: 'RutaLocal',
    color: '#85C1E9',
    colorLight: 'rgba(133, 193, 233, 0.2)',
    colorDark: '#F4FBFF',
    mapBg: 'linear-gradient(180deg, rgba(133, 193, 233, 0.4), rgba(14, 58, 94, 0.92))',
    startBtn: 'Empezar nueva ruta',
    stopLabel: 'bar',
    itemLabel: 'Cerveza',
    itemPlaceholder: 'Ej. tercio, caña o sin',
    qtyLabel: 'Cantidad',
    noteLabel: 'Marca opcional',
    notePlaceholder: 'Ej. Mahou o artesanal',
    addStopLabel: 'Anadir siguiente bar',
    endLabel: 'Terminar ruta',
    itemChips: ['Tercio', 'Cana', 'Clara', 'Sin', 'IPA', 'Pinta'],
    statUnit: 'cervezas',
    trophy: '🏆',
    resTitle: 'Ruta completada'
  },
  gastro: {
    icon: '🍽️',
    name: 'Ruta gastro',
    appName: 'RutaLocal',
    color: '#2980B9',
    colorLight: 'rgba(41, 128, 185, 0.18)',
    colorDark: '#EEF8FF',
    mapBg: 'linear-gradient(180deg, rgba(41, 128, 185, 0.44), rgba(10, 31, 61, 0.94))',
    startBtn: 'Empezar ruta gastronomica',
    stopLabel: 'local',
    itemLabel: 'Tapa o plato',
    itemPlaceholder: 'Ej. croquetas o tortilla',
    qtyLabel: 'Raciones',
    noteLabel: 'Valoracion opcional',
    notePlaceholder: 'Ej. para repetir o mejor pedir mesa',
    addStopLabel: 'Anadir siguiente local',
    endLabel: 'Terminar ruta gastronomica',
    itemChips: ['Croquetas', 'Bravas', 'Tortilla', 'Pulpo', 'Vermut', 'Postre'],
    statUnit: 'tapas',
    trophy: '🍴',
    resTitle: 'Ruta gastronomica'
  },
  tarde: {
    icon: '🎬',
    name: 'Plan de tarde',
    appName: 'RutaLocal',
    color: '#1F618D',
    colorLight: 'rgba(31, 97, 141, 0.18)',
    colorDark: '#EAF5FF',
    mapBg: 'linear-gradient(180deg, rgba(31, 97, 141, 0.46), rgba(13, 33, 55, 0.94))',
    startBtn: 'Empezar plan de tarde',
    stopLabel: 'sitio',
    itemLabel: 'Actividad',
    itemPlaceholder: 'Ej. cine, regalo o paseo',
    qtyLabel: 'Personas',
    noteLabel: 'Nota opcional',
    notePlaceholder: 'Ej. comprar antes las entradas',
    addStopLabel: 'Anadir siguiente sitio',
    endLabel: 'Terminar plan',
    itemChips: ['Cine', 'Cafe', 'Compras', 'Parque', 'Museo', 'Concierto'],
    statUnit: 'planes',
    trophy: '🌟',
    resTitle: 'Plan completado'
  },
  improvisar: {
    icon: '⚡',
    name: 'Improvisar',
    appName: 'RutaLocal',
    color: '#AED6F1',
    colorLight: 'rgba(174, 214, 241, 0.18)',
    colorDark: '#F4FBFF',
    mapBg: 'linear-gradient(180deg, rgba(174, 214, 241, 0.28), rgba(10, 31, 61, 0.95))',
    startBtn: 'Salir sin plan fijo',
    stopLabel: 'sitio',
    itemLabel: 'Que hiciste aqui',
    itemPlaceholder: 'Ej. cafe, paseo o compra rapida',
    qtyLabel: 'Cantidad',
    noteLabel: 'Nota rapida',
    notePlaceholder: 'Ej. volveria o apuntar para otro dia',
    addStopLabel: 'Buscar sitio cercano',
    endLabel: 'Terminar aventura',
    itemChips: ['Cafe', 'Cerveza', 'Compra', 'Tapa', 'Paseo', 'Foto'],
    statUnit: 'paradas',
    trophy: '⚡',
    resTitle: 'Aventura completada'
  }
};

const SAMPLE_ROUTES: SavedRoute[] = [
  {
    id: 1,
    name: 'Malasana sin prisas',
    mode: 'cerveza',
    date: 'Ayer · 21:15 - 01:10',
    paradas: [],
    totalItems: 11,
    duration: '3h 55m'
  },
  {
    id: 2,
    name: 'Compra de la semana',
    mode: 'recados',
    date: 'Hace 3 dias · 10:00 - 11:10',
    paradas: [],
    totalItems: 9,
    duration: '1h 10m'
  },
  {
    id: 3,
    name: 'Tapas por el centro',
    mode: 'gastro',
    date: 'Hace 5 dias · 14:00 - 16:50',
    paradas: [],
    totalItems: 8,
    duration: '2h 50m'
  }
];

@Component({
  selector: 'app-ruta-local',
  standalone: true,
  imports: [RouterLink, PondBackgroundComponent],
  templateUrl: './ruta-local.component.html',
  styleUrl: './ruta-local.component.scss'
})
export class RutaLocalComponent implements OnDestroy {
  private readonly searchService = inject(RutaLocalSearchService);
  private readonly listaCompraService = inject(ListaCompraService);

  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly cargandoNenulista = signal(false);
  readonly nenulistaError = signal('');

  readonly brandLogoSrc = 'assets/imagenes/flor_logo.png';

  currentScreen = signal<Screen>('tipo');
  currentMode = signal<RouteMode>('cerveza');
  cantVal = signal(1);

  improvisarSearchQuery = signal('');
  improvisarSearchResults = signal<SearchResult[]>([]);
  improvisarPreselected = signal<SearchResult[]>([]);
  improvisarSearching = signal(false);

  activeParadas = signal<Parada[]>([]);
  activeParadaIndex = signal(0);
  routeStartTime = signal('');
  addItemName = signal('');
  addItemNote = signal('');
  addItemQty = signal(1);

  showInlineSearch = signal(false);
  inlineSearchQuery = signal('');
  inlineSearchResults = signal<SearchResult[]>([]);

  savedRoutes = signal<SavedRoute[]>(SAMPLE_ROUTES);

  readonly modeConfig = computed(() => MODE_CONFIGS[this.currentMode()]);

  readonly currentParada = computed(() => this.activeParadas()[this.activeParadaIndex()] ?? null);

  readonly totalItems = computed(() => this.sumItems(this.activeParadas()));

  readonly filteredSavedRoutes = computed(() =>
    this.savedRoutes()
      .filter((route) => route.mode === this.currentMode())
      .slice(0, 3)
  );

  readonly hasRouteData = computed(() => this.activeParadas().length > 0);

  readonly summaryStats = computed(() => {
    const paradas = this.activeParadas().length ? this.activeParadas() : this.getDemoParadas();
    return {
      stops: paradas.length,
      items: this.sumItems(paradas),
      duration: this.hasRouteData() ? this.estimateDuration(paradas) : '2h aprox'
    };
  });

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  cargarDesdeNenulista(): void {
    this.cargandoNenulista.set(true);
    this.nenulistaError.set('');

    this.listaCompraService
      .getLista()
      .pipe(finalize(() => this.cargandoNenulista.set(false)))
      .subscribe({
        next: (items: ListaCompraItem[]) => {
          const pendientes = items.filter(
            (item) => !item.completado && !item.completada,
          );

          if (!pendientes.length) {
            this.nenulistaError.set('No hay productos pendientes en Mi Nenulista.');
            return;
          }

          const grupos = new Map<string, { nombre: string; items: ListaCompraItem[] }>();
          const sinNegocio: ListaCompraItem[] = [];

          for (const item of pendientes) {
            const negocioNombre =
              String(item.negocio?.nombre ?? '').trim() ||
              String(item.producto?.negocio?.nombre ?? '').trim();
            if (negocioNombre) {
              if (!grupos.has(negocioNombre)) {
                grupos.set(negocioNombre, { nombre: negocioNombre, items: [] });
              }
              grupos.get(negocioNombre)!.items.push(item);
            } else {
              sinNegocio.push(item);
            }
          }

          const paradas: Parada[] = [];
          let idCounter = 1;

          grupos.forEach((grupo) => {
            paradas.push({
              id: idCounter++,
              placeName: grupo.nombre,
              placeAddress: 'Desde Mi Nenulista',
              items: grupo.items.map((item) => ({
                name:
                  String(item.nombre ?? '').trim() ||
                  String(item.producto?.nombre ?? '').trim() ||
                  'Producto',
                qty: Math.max(1, Math.floor(Number(item.cantidad ?? 1))),
                note: String(item.nota ?? '').trim() || undefined,
                nenulistaItemId: item.id,
                completado: false,
              })),
              done: false,
              current: false,
            });
          });

          if (sinNegocio.length) {
            paradas.push({
              id: idCounter++,
              placeName: 'Sin negocio',
              placeAddress: 'Productos sin negocio asignado',
              items: sinNegocio.map((item) => ({
                name:
                  String(item.nombre ?? '').trim() ||
                  String(item.producto?.nombre ?? '').trim() ||
                  'Producto manual',
                qty: Math.max(1, Math.floor(Number(item.cantidad ?? 1))),
                note: String(item.nota ?? '').trim() || undefined,
                nenulistaItemId: item.id,
                completado: false,
              })),
              done: false,
              current: false,
            });
          }

          if (paradas.length > 0) {
            paradas[0].current = true;
            paradas[0].startTime = this.nowTime();
          }

          this.activeParadas.set(paradas);
          this.activeParadaIndex.set(0);
          this.routeStartTime.set(this.nowTime());
          this.showInlineSearch.set(false);
          this.currentScreen.set('ruta');
        },
        error: () => {
          this.nenulistaError.set(
            'No se pudo cargar Mi Nenulista. Comprueba que has iniciado sesión.',
          );
        },
      });
  }

  getParadaIndex(parada: Parada): number {
    return this.activeParadas().findIndex((p) => p.id === parada.id);
  }

  toggleNenulistaItem(paradaIndex: number, itemIndex: number): void {
    const paradas = this.activeParadas().map((p) => ({
      ...p,
      items: p.items.map((i) => ({ ...i })),
    }));
    const parada = paradas[paradaIndex];
    if (!parada) return;
    const item = parada.items[itemIndex];
    if (!item?.nenulistaItemId) return;

    item.completado = !item.completado;
    this.activeParadas.set(paradas);

    this.listaCompraService
      .updateItem(item.nenulistaItemId, { completado: item.completado })
      .subscribe({
        error: () => {
          item.completado = !item.completado;
          this.activeParadas.set(
            this.activeParadas().map((p) => ({
              ...p,
              items: p.items.map((i) => ({ ...i })),
            })),
          );
        },
      });
  }

  goScreen(screen: Screen): void {
    if (screen === 'add' && !this.currentParada()) {
      this.currentScreen.set(this.currentMode() === 'improvisar' ? 'ruta' : 'home');
      return;
    }

    if (screen === 'ruta' && !this.hasRouteData() && this.currentMode() !== 'improvisar') {
      this.currentScreen.set('home');
      return;
    }

    if (screen === 'resumen' && !this.hasRouteData()) {
      this.currentScreen.set(this.currentMode() === 'improvisar' ? 'improvisar-setup' : 'home');
      return;
    }

    this.currentScreen.set(screen);
  }

  selectMode(mode: RouteMode): void {
    this.currentMode.set(mode);
    this.resetSearchState();
    this.resetRouteDraft();
    this.currentScreen.set(mode === 'improvisar' ? 'improvisar-setup' : 'home');
  }

  onImprovisarSearch(query: string): void {
    this.improvisarSearchQuery.set(query);
    this.scheduleSearch(query, 'setup');
  }

  togglePreselect(result: SearchResult): void {
    const current = this.improvisarPreselected();
    const exists = current.some((item) => item.id === result.id);

    this.improvisarPreselected.set(
      exists ? current.filter((item) => item.id !== result.id) : [...current, result]
    );
  }

  isPreselected(result: SearchResult): boolean {
    return this.improvisarPreselected().some((item) => item.id === result.id);
  }

  startImprovisar(): void {
    const preselected = this.improvisarPreselected();
    const paradas = preselected.map((result, index) => ({
      id: index + 1,
      placeName: result.name,
      placeAddress: result.address,
      items: [],
      done: false,
      current: index === 0,
      startTime: index === 0 ? this.nowTime() : undefined
    }));

    this.activeParadas.set(paradas);
    this.activeParadaIndex.set(0);
    this.routeStartTime.set(this.nowTime());
    this.showInlineSearch.set(paradas.length === 0);
    this.currentScreen.set('ruta');
  }

  startRoute(): void {
    if (this.currentMode() === 'improvisar') {
      this.startImprovisar();
      return;
    }

    const demos = this.getDemoParadas();
    const currentIndex = Math.max(0, demos.findIndex((parada) => parada.current));

    this.activeParadas.set(demos);
    this.activeParadaIndex.set(currentIndex);
    this.routeStartTime.set(this.nowTime());
    this.showInlineSearch.set(false);
    this.currentScreen.set('ruta');
  }

  openSavedRoute(route: SavedRoute): void {
    this.currentMode.set(route.mode);

    const paradas = route.paradas.length ? this.cloneParadas(route.paradas) : this.getDemoParadas(route.mode);
    const currentIndex = Math.max(0, paradas.findIndex((parada) => parada.current));

    this.activeParadas.set(paradas);
    this.activeParadaIndex.set(currentIndex);
    this.routeStartTime.set(this.extractStartTime(route.date));
    this.currentScreen.set('resumen');
  }

  openAddItem(parada: Parada): void {
    const currentIndex = this.activeParadas().findIndex((item) => item.id === parada.id);

    if (currentIndex < 0) {
      return;
    }

    this.activeParadaIndex.set(currentIndex);
    this.addItemName.set('');
    this.addItemNote.set('');
    this.addItemQty.set(1);
    this.cantVal.set(1);
    this.currentScreen.set('add');
  }

  saveItem(): void {
    const name = this.addItemName().trim();
    const currentParada = this.currentParada();

    if (!name || !currentParada) {
      return;
    }

    const paradas = [...this.activeParadas()];
    const parada = { ...currentParada };

    parada.items = [
      ...parada.items,
      {
        name,
        qty: this.addItemQty(),
        note: this.addItemNote().trim() || undefined
      }
    ];

    paradas[this.activeParadaIndex()] = parada;
    this.activeParadas.set(paradas);
    this.addItemName.set('');
    this.addItemNote.set('');
    this.addItemQty.set(1);
    this.cantVal.set(1);
  }

  saveItemAndBack(): void {
    this.saveItem();
    this.currentScreen.set('ruta');
  }

  markParadaDone(index: number): void {
    const lastIndex = this.activeParadas().length - 1;

    const paradas = this.activeParadas().map((parada, paradaIndex) => ({
      ...parada,
      done: paradaIndex <= index,
      current: paradaIndex === index + 1 && index < lastIndex,
      endTime: paradaIndex === index ? this.nowTime() : parada.endTime
    }));

    this.activeParadas.set(paradas);
    this.activeParadaIndex.set(index < lastIndex ? index + 1 : index);
  }

  addNewStop(result: SearchResult): void {
    const paradas = this.activeParadas();
    const shouldBecomeCurrent = paradas.length === 0 || paradas.every((parada) => parada.done);
    const normalizedParadas = shouldBecomeCurrent
      ? paradas.map((parada) => ({ ...parada, current: false }))
      : paradas;

    const newParada: Parada = {
      id: normalizedParadas.length + 1,
      placeName: result.name,
      placeAddress: result.address,
      items: [],
      done: false,
      current: shouldBecomeCurrent,
      startTime: shouldBecomeCurrent ? this.nowTime() : undefined
    };

    this.activeParadas.set([...normalizedParadas, newParada]);
    this.activeParadaIndex.set(normalizedParadas.length);
    this.showInlineSearch.set(false);
    this.inlineSearchQuery.set('');
    this.inlineSearchResults.set([]);
  }

  addEmptyStop(): void {
    const paradas = this.activeParadas();
    const shouldBecomeCurrent = paradas.length === 0 || paradas.every((parada) => parada.done);
    const normalizedParadas = shouldBecomeCurrent
      ? paradas.map((parada) => ({ ...parada, current: false }))
      : paradas;

    const newParada: Parada = {
      id: normalizedParadas.length + 1,
      placeName: `${this.capitalize(this.modeConfig().stopLabel)} ${normalizedParadas.length + 1}`,
      placeAddress: 'Direccion pendiente',
      items: [],
      done: false,
      current: shouldBecomeCurrent,
      startTime: shouldBecomeCurrent ? this.nowTime() : undefined
    };

    this.activeParadas.set([...normalizedParadas, newParada]);
    this.activeParadaIndex.set(normalizedParadas.length);
    this.addItemName.set('');
    this.addItemNote.set('');
    this.addItemQty.set(1);
    this.cantVal.set(1);
    this.currentScreen.set('add');
  }

  onInlineSearch(query: string): void {
    this.inlineSearchQuery.set(query);
    this.scheduleSearch(query, 'inline');
  }

  endRoute(): void {
    const paradas = this.activeParadas();

    if (!paradas.length) {
      return;
    }

    const route: SavedRoute = {
      id: Date.now(),
      name:
        this.currentMode() === 'improvisar'
          ? `Improvisada del ${this.todayStr()}`
          : `${this.modeConfig().name} · ${this.todayStr()}`,
      mode: this.currentMode(),
      date: `Hoy · ${this.routeStartTime() || this.nowTime()} - ${this.nowTime()}`,
      paradas: this.cloneParadas(paradas),
      totalItems: this.totalItems(),
      duration: this.estimateDuration(paradas)
    };

    this.savedRoutes.update((routes) => [route, ...routes]);
    this.currentScreen.set('resumen');
  }

  chCant(delta: number): void {
    const nextValue = Math.max(1, this.addItemQty() + delta);
    this.addItemQty.set(nextValue);
    this.cantVal.set(nextValue);
  }

  selectChip(chip: string): void {
    this.addItemName.set(chip);
  }

  getDemoParadas(mode: RouteMode = this.currentMode()): Parada[] {
    const demos: Record<RouteMode, Parada[]> = {
      cerveza: [
        {
          id: 1,
          placeName: 'El Tigre',
          placeAddress: 'Gran Via',
          items: [{ name: 'Tercio', qty: 3, note: 'Mahou' }],
          done: true,
          current: false,
          startTime: '21:10',
          endTime: '21:55'
        },
        {
          id: 2,
          placeName: 'Bar Palentino',
          placeAddress: 'Malasana',
          items: [{ name: 'Pinta', qty: 2, note: 'Artesanal' }],
          done: false,
          current: true
        }
      ],
      recados: [
        {
          id: 1,
          placeName: 'Fruteria Carmen',
          placeAddress: 'Mercado Central',
          items: [
            { name: 'Tomates', qty: 2, note: '2 kg' },
            { name: 'Sandia', qty: 1 }
          ],
          done: false,
          current: true
        },
        {
          id: 2,
          placeName: 'Panaderia El Horno',
          placeAddress: 'C/ Mayor',
          items: [],
          done: false,
          current: false
        }
      ],
      gastro: [
        {
          id: 1,
          placeName: 'Casa Labra',
          placeAddress: 'Sol',
          items: [
            { name: 'Bacalao rebozado', qty: 2 },
            { name: 'Vermut', qty: 2 }
          ],
          done: true,
          current: false,
          startTime: '14:00',
          endTime: '14:40'
        },
        {
          id: 2,
          placeName: 'El Brillante',
          placeAddress: 'Atocha',
          items: [],
          done: false,
          current: true
        }
      ],
      tarde: [
        {
          id: 1,
          placeName: 'Fnac Gran Via',
          placeAddress: 'Gran Via',
          items: [{ name: 'Libro regalo', qty: 1 }],
          done: true,
          current: false,
          startTime: '17:00',
          endTime: '17:45'
        },
        {
          id: 2,
          placeName: 'Cines Callao',
          placeAddress: 'Gran Via',
          items: [],
          done: false,
          current: true
        }
      ],
      improvisar: []
    };

    return this.cloneParadas(demos[mode] ?? []);
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  trackByIdx(index: number): number {
    return index;
  }

  private scheduleSearch(query: string, target: 'setup' | 'inline'): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      if (target === 'setup') {
        this.improvisarSearching.set(false);
        this.improvisarSearchResults.set([]);
      } else {
        this.inlineSearchResults.set([]);
      }
      return;
    }

    if (target === 'setup') {
      this.improvisarSearching.set(true);
    }

    this.searchTimeout = setTimeout(() => {
      const results = this.searchService.search(normalizedQuery, this.currentMode());

      if (target === 'setup') {
        this.improvisarSearchResults.set(results);
        this.improvisarSearching.set(false);
        return;
      }

      this.inlineSearchResults.set(results);
    }, target === 'setup' ? 380 : 280);
  }

  private resetSearchState(): void {
    this.improvisarSearchQuery.set('');
    this.improvisarSearchResults.set([]);
    this.improvisarPreselected.set([]);
    this.improvisarSearching.set(false);
    this.inlineSearchQuery.set('');
    this.inlineSearchResults.set([]);
    this.showInlineSearch.set(false);
  }

  private resetRouteDraft(): void {
    this.activeParadas.set([]);
    this.activeParadaIndex.set(0);
    this.routeStartTime.set('');
    this.addItemName.set('');
    this.addItemNote.set('');
    this.addItemQty.set(1);
    this.cantVal.set(1);
  }

  private cloneParadas(paradas: Parada[]): Parada[] {
    return paradas.map((parada) => ({
      ...parada,
      items: parada.items.map((item) => ({ ...item }))
    }));
  }

  private sumItems(paradas: Parada[]): number {
    return paradas.reduce(
      (routeTotal, parada) => routeTotal + parada.items.reduce((itemTotal, item) => itemTotal + item.qty, 0),
      0
    );
  }

  private estimateDuration(paradas: Parada[]): string {
    const totalMinutes = Math.max(35, paradas.length * 34 + this.sumItems(paradas) * 7);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (!hours) {
      return `${minutes}m`;
    }

    return `${hours}h ${minutes}m`;
  }

  private extractStartTime(label: string): string {
    const parts = label.split('·');

    if (parts.length < 2) {
      return '';
    }

    return parts[1].split('-')[0]?.trim() ?? '';
  }

  private nowTime(): string {
    return new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private todayStr(): string {
    return new Date().toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
