import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import { AuthService } from '../../servicios/authService/auth.service';
import {
  AccionLogro,
  Logro,
  LogroUsuario,
  LogroServiceService,
  MiLogro,
  NivelProgreso,
  ProgresoEscalera,
} from '../../servicios/logroServicio/logroService.service';
import { PetalosService } from '../../servicios/petalosServicio/petalos.service';

export interface CategoriaLogros {
  id: string;
  nombre: string;
  icono: string;
  acciones: AccionLogro[];
}

export interface LogroOculto {
  id: string;
  titulo: string;
  descripcion: string;
  pista: string;
  desbloqueado: boolean;
  recompensa: number;
  esEasterEgg?: boolean;
  esMaestro?: boolean;
}

export interface DetalleSeleccionado {
  titulo: string;
  descripcion: string;
  desbloqueado: boolean;
  progreso?: number;
  meta?: number;
  recompensa: number;
  categoria: string;
  conseguidoEn?: string;
}

const CATEGORIAS: CategoriaLogros[] = [
  {
    id: 'resenas',
    nombre: 'Reseñas',
    icono: '',
    acciones: ['RESENA_PUBLICADA'],
  },
  {
    id: 'exploracion',
    nombre: 'Exploración',
    icono: '',
    acciones: ['VISITA_NEGOCIO', 'COMPRA_REALIZADA', 'RESERVA_HECHA'],
  },
  {
    id: 'comunidad',
    nombre: 'Comunidad',
    icono: '',
    acciones: ['NEGOCIO_SEGUIDO', 'PROMOCION_CANJEADA'],
  },
];

const LOGROS_OCULTOS: LogroOculto[] = [
  {
    id: 'todas-categorias',
    titulo: 'Gran Explorador',
    descripcion: 'Visitar todas las categorías de negocio del barrio.',
    pista: 'El barrio tiene muchas caras...',
    desbloqueado: false,
    recompensa: 50,
  },
  {
    id: 'todas-subcategorias',
    titulo: 'Sin Dejar Rincón',
    descripcion: 'Explorar todas las subcategorías disponibles.',
    pista: 'Ve más allá de lo evidente...',
    desbloqueado: false,
    recompensa: 75,
  },
  {
    id: 'resena-todas-estrellas',
    titulo: 'Crítico Completo',
    descripcion: 'Publicar una reseña de cada puntuación posible (1 a 5 estrellas).',
    pista: 'No todas las experiencias son iguales',
    desbloqueado: false,
    recompensa: 60,
  },
  {
    id: 'diez-resenas-5',
    titulo: 'Embajador del Barrio',
    descripcion: 'Conseguir 10 reseñas de 5 estrellas en tus establecimientos.',
    pista: 'La excelencia se reconoce',
    desbloqueado: false,
    recompensa: 100,
  },
  {
    id: 'diez-resenas-valoradas',
    titulo: 'Voz de la Comunidad',
    descripcion: 'Acumular 10 reseñas de 4 estrellas o más.',
    pista: 'Tu opinión importa en el barrio',
    desbloqueado: false,
    recompensa: 80,
  },
  {
    id: 'perfil-negocio-completo',
    titulo: 'Escaparate Perfecto',
    descripcion: 'Completar al 100% la configuración del perfil de tu negocio.',
    pista: 'Muestra lo mejor de tu negocio',
    desbloqueado: false,
    recompensa: 40,
  },
  {
    id: 'horario-negocio',
    titulo: 'Puntual como un Reloj',
    descripcion: 'Configurar el horario completo de tu negocio.',
    pista: 'El tiempo es oro',
    desbloqueado: false,
    recompensa: 30,
  },
  {
    id: 'primera-resena',
    titulo: 'Primera Palabra',
    descripcion: 'Publicar tu primera reseña en Nenúfar.',
    pista: 'Todo empieza con un primer paso',
    desbloqueado: false,
    recompensa: 25,
  },
  {
    id: 'easter-egg',
    titulo: '???',
    descripcion: '???',
    pista: 'Hay secretos que solo se descubren explorando...',
    desbloqueado: false,
    recompensa: 200,
    esEasterEgg: true,
  },
  {
    id: 'nenufar-maestro',
    titulo: 'Nenúfar del Topo',
    descripcion: 'Desbloquear absolutamente todos los logros de la plataforma.',
    pista: 'El logro definitivo. Solo para los más dedicados.',
    desbloqueado: false,
    recompensa: 500,
    esMaestro: true,
  },
];

@Component({
  selector: 'app-mis-logros',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mis-logros.component.html',
  styleUrl: './mis-logros.component.css',
})
export class MisLogrosComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly logroSvc = inject(LogroServiceService);
  private readonly petalosSvc = inject(PetalosService);

  readonly cargando = signal(true);
  readonly errorMensaje = signal('');
  readonly escaleras = signal<ProgresoEscalera[]>([]);
  readonly misLogros = signal<MiLogro[]>([]);
  readonly saldoPetalos = signal(0);
  readonly detalleAbierto = signal<DetalleSeleccionado | null>(null);

  readonly categorias = CATEGORIAS;
  readonly logrosOcultos = LOGROS_OCULTOS;

  readonly totalNiveles = computed(() =>
    this.escaleras().reduce((sum, e) => sum + e.niveles.length, 0),
  );

  readonly totalDesbloqueados = computed(() =>
    this.escaleras().reduce(
      (sum, e) => sum + e.niveles.filter((n) => n.desbloqueado).length,
      0,
    ),
  );

  readonly progresoTotal = computed(() => {
    const total = this.totalNiveles();
    if (!total) return 0;
    return Math.round((this.totalDesbloqueados() / total) * 100);
  });

  readonly logrosRecientes = computed(() =>
    this.misLogros()
      .slice()
      .sort(
        (a, b) =>
          new Date(b.conseguidoEn).getTime() - new Date(a.conseguidoEn).getTime(),
      )
      .slice(0, 4),
  );

  readonly proximosLogros = computed(() => {
    const proximos: { label: string; porcentaje: number; texto: string }[] = [];
    for (const esc of this.escaleras()) {
      const siguiente = esc.niveles.find((n) => !n.desbloqueado);
      if (!siguiente) continue;
      const faltan = Math.max(0, siguiente.umbral - esc.contador);
      const pct = Math.min(100, (esc.contador / siguiente.umbral) * 100);
      proximos.push({
        label: siguiente.titulo,
        porcentaje: Math.round(pct),
        texto: `Te faltan ${faltan} ${esc.accionLabel} para "${siguiente.titulo}"`,
      });
    }
    return proximos.slice(0, 4);
  });

  ngOnInit(): void {
    this.authService
      .hydrateSession({ forceRemote: !this.authService.isSessionResolved() })
      .pipe(
        switchMap((usuario) => {
          const usuarioId = Number(usuario?.id ?? this.authService.obtenerUsuario()?.id ?? 0);

          if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
            return of({
              escaleras: [] as ProgresoEscalera[],
              logros: [] as MiLogro[],
              balance: { saldo: 0 },
            });
          }

          return forkJoin({
            escaleras: this.logroSvc.miProgreso().pipe(
              catchError((error: unknown) => {
                this.logDevSecondary('progreso de logros', error);
                return of([] as ProgresoEscalera[]);
              }),
            ),
            logros: this.cargarMisLogros(usuarioId),
            balance: this.petalosSvc.balance().pipe(
              catchError((error: unknown) => {
                this.logDevSecondary('balance de pétalos', error);
                return of({ saldo: 0 });
              }),
            ),
          });
        }),
        catchError((error: unknown) => {
          this.logDevSecondary('sesión de logros', error);
          return of({
            escaleras: [] as ProgresoEscalera[],
            logros: [] as MiLogro[],
            balance: { saldo: 0 },
          });
        }),
      )
      .subscribe({
        next: ({ escaleras, logros, balance }) => {
          this.escaleras.set(escaleras);
          this.misLogros.set(logros);
          this.saldoPetalos.set(balance.saldo ?? 0);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.cargando.set(false);
          this.errorMensaje.set(
            getUserErrorMessage(error, 'No hemos podido cargar tus logros.'),
          );
        },
      });
  }

  private cargarMisLogros(usuarioId: number) {
    return this.logroSvc.misLogros().pipe(
      catchError((error: unknown) => {
        this.logDevSecondary('mis logros', error);
        return forkJoin({
          asignados: this.logroSvc.porUsuario(usuarioId).pipe(
            catchError((fallbackError: unknown) => {
              this.logDevSecondary('logros antiguos del usuario', fallbackError);
              return of([] as LogroUsuario[]);
            }),
          ),
          catalogo: this.logroSvc.findAll().pipe(
            catchError((fallbackError: unknown) => {
              this.logDevSecondary('catálogo de logros', fallbackError);
              return of([] as Logro[]);
            }),
          ),
        }).pipe(
          map(({ asignados, catalogo }) => this.mapLogrosFallback(asignados, catalogo)),
        );
      }),
    );
  }

  private mapLogrosFallback(asignados: LogroUsuario[], catalogo: Logro[]): MiLogro[] {
    const catalogoPorId = new Map(catalogo.map((logro) => [logro.id, logro]));

    return asignados
      .map((item, index): MiLogro | null => {
        const raw = item as Record<string, unknown>;
        const logroRaw =
          raw['logro'] && typeof raw['logro'] === 'object'
            ? raw['logro'] as Logro
            : catalogoPorId.get(item.logroId);

        if (!logroRaw) {
          return null;
        }

        const logroUsuarioId = Number(raw['id']);
        const logro = {
          id: logroRaw.id,
          titulo: logroRaw.titulo,
          descripcion: logroRaw.descripcion,
          tipo: logroRaw.tipo,
          dificultad: logroRaw.dificultad,
          umbral: logroRaw.umbral,
          recompensaPuntos: logroRaw.recompensaPuntos,
          accion: typeof logroRaw['accion'] === 'string'
            ? logroRaw['accion']
            : undefined,
        } satisfies MiLogro['logro'];

        return {
          id: Number.isFinite(logroUsuarioId) && logroUsuarioId > 0
            ? logroUsuarioId
            : Number(`${item.usuarioId}${item.logroId}${index}`),
          conseguidoEn: String(raw['conseguidoEn'] ?? raw['createdAt'] ?? new Date().toISOString()),
          logro,
        } satisfies MiLogro;
      })
      .filter((item): item is MiLogro => item !== null);
  }

  private logDevSecondary(area: string, error: unknown): void {
    if (!environment.production) {
      console.warn(`[MisLogrosComponent] ${area} no disponible`, error);
    }
  }

  escalerasDe(categoria: CategoriaLogros): ProgresoEscalera[] {
    return this.escaleras().filter((e) => categoria.acciones.includes(e.accion));
  }

  tituloAccion(accion: AccionLogro): string {
    const map: Record<string, string> = {
      RESENA_PUBLICADA: 'Reseñas publicadas',
      COMPRA_REALIZADA: 'Compras realizadas',
      RESERVA_HECHA: 'Reservas hechas',
      PROMOCION_CANJEADA: 'Promociones canjeadas',
      VISITA_NEGOCIO: 'Negocios visitados',
      NEGOCIO_SEGUIDO: 'Negocios seguidos',
    };
    return map[accion] ?? accion;
  }

  esNivelActual(escalera: ProgresoEscalera, nivel: NivelProgreso): boolean {
    const siguiente = escalera.niveles.find((n) => !n.desbloqueado);
    return !!siguiente && siguiente.id === nivel.id;
  }

  porcentaje(escalera: ProgresoEscalera): number {
    const siguiente = escalera.niveles.find((n) => !n.desbloqueado);
    if (!siguiente) return 100;
    if (!siguiente.umbral || siguiente.umbral <= 0) return 0;
    return Math.max(0, Math.min(100, (escalera.contador / siguiente.umbral) * 100));
  }

  abrirDetalleNivel(escalera: ProgresoEscalera, nivel: NivelProgreso): void {
    const cat = CATEGORIAS.find((c) => c.acciones.includes(escalera.accion));
    this.detalleAbierto.set({
      titulo: nivel.titulo,
      descripcion: `Alcanza ${nivel.umbral} ${escalera.accionLabel} para desbloquear este logro.`,
      desbloqueado: nivel.desbloqueado,
      progreso: escalera.contador,
      meta: nivel.umbral,
      recompensa: nivel.recompensaPuntos,
      categoria: cat?.nombre ?? 'General',
      conseguidoEn: nivel.conseguidoEn,
    });
  }

  abrirDetalleOculto(logro: LogroOculto): void {
    this.detalleAbierto.set({
      titulo: logro.desbloqueado ? logro.titulo : '???',
      descripcion: logro.desbloqueado ? logro.descripcion : logro.pista,
      desbloqueado: logro.desbloqueado,
      recompensa: logro.recompensa,
      categoria: 'Oculto',
    });
  }

  cerrarDetalle(): void {
    this.detalleAbierto.set(null);
  }

  formatFecha(fecha?: string): string {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
