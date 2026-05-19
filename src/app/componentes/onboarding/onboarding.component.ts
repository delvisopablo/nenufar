import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal
} from '@angular/core';
import { DashboardAnimComponent } from '../animaciones/dashboard-anim/dashboard-anim.component';
import { HorarioNegocioAnimComponent } from '../animaciones/horario-negocio-anim/horario-negocio-anim.component';
import { LogroAnimComponent } from '../animaciones/logro-anim/logro-anim.component';
import { NenufarPondComponent } from '../animaciones/nenufar-pond/nenufar-pond.component';
import { PublicarAnimComponent } from '../animaciones/publicar-anim/publicar-anim.component';
import { ReservaAnimComponent } from '../animaciones/reserva-anim/reserva-anim.component';

export type OnboardingModo = 'usuario' | 'negocio';
type AnimacionTipo =
  | 'nenufar-pond'
  | 'reserva'
  | 'publicar-resena'
  | 'publicar-promo'
  | 'dashboard'
  | 'horario'
  | 'logro'
  | null;

type OnboardingSlide = {
  badge: string;
  descripcion: string;
  gradiente: string;
  kicker: string;
  puntos: string[];
  titulo: string;
};

// ── 5 slides para el track de usuario ──────────────────────────────────────
const SLIDES_USUARIO: OnboardingSlide[] = [
  {
    badge: '01',
    descripcion: 'Cada nenúfar ofrece una cosa nueva.',
    gradiente: 'linear-gradient(135deg, rgba(23, 77, 61, 0.98), rgba(9, 34, 28, 0.94))',
    kicker: 'Bienvenida',
    puntos: [],
    titulo: 'Tu salto empieza aquí'
  },
  {
    badge: '02',
    descripcion: 'Reserva cuando te venga bien y deja que el movimiento del estanque te acompañe sin fricciones.',
    gradiente: 'linear-gradient(135deg, rgba(23, 77, 61, 0.98), rgba(9, 34, 28, 0.94))',
    kicker: 'Reservas',
    puntos: [],
    titulo: 'Reserva con ligereza'
  },
  {
    badge: '03',
    descripcion: 'Tu voz ayuda a que el ecosistema tenga memoria. Cada reseña deja una pequeña onda en el agua.',
    gradiente: 'linear-gradient(135deg, rgba(74, 34, 69, 0.98), rgba(33, 12, 31, 0.94))',
    kicker: 'Comunidad',
    puntos: [],
    titulo: 'Participa y deja huella'
  },
  {
    badge: '04',
    descripcion: 'Sigue negocios y vuelve a encontrarlos cuando quieras. Haz que lo que vives dentro de Nenúfar también cuente.',
    gradiente: 'linear-gradient(135deg, rgba(38, 95, 74, 0.98), rgba(16, 51, 40, 0.94))',
    kicker: 'Conexión',
    puntos: [
      'Sigue negocios y vuelve a encontrarlos fácilmente.',
      'Comparte lo que has vivido con otras ranas.',
      'Forma parte de un ecosistema que se retroalimenta.'
    ],
    titulo: 'Sigue y conecta'
  },
  {
    badge: '05',
    descripcion: 'Nenúfar premia el movimiento bonito: cuanto más participas, más vivo se vuelve tu recorrido.',
    gradiente: 'linear-gradient(135deg, rgba(160, 78, 54, 0.98), rgba(95, 37, 23, 0.94))',
    kicker: 'Pétalos',
    puntos: [],
    titulo: 'Haz crecer tu camino'
  }
];

// ── 5 slides para el track de negocio ──────────────────────────────────────
const SLIDES_NEGOCIO: OnboardingSlide[] = [
  {
    badge: '01',
    descripcion: 'Tu negocio no entra como una ficha más: entra con presencia, historia y personalidad propia.',
    gradiente: 'linear-gradient(135deg, rgba(28, 88, 69, 0.98), rgba(10, 39, 31, 0.94))',
    kicker: 'Escaparate',
    puntos: [],
    titulo: 'Abre tu rincón en Nenúfar'
  },
  {
    badge: '02',
    descripcion: 'Consulta el pulso de tu negocio: ventas, reservas, reseñas y nota media de un vistazo.',
    gradiente: 'linear-gradient(135deg, rgba(31, 71, 112, 0.98), rgba(14, 34, 59, 0.94))',
    kicker: 'Panel',
    puntos: [],
    titulo: 'Tu negocio de un vistazo'
  },
  {
    badge: '03',
    descripcion: 'Define cuándo estás disponible y organiza los huecos de tu agenda con un flujo más claro.',
    gradiente: 'linear-gradient(135deg, rgba(28, 88, 69, 0.98), rgba(10, 39, 31, 0.94))',
    kicker: 'Horario',
    puntos: [],
    titulo: 'Ordena tu ritmo'
  },
  {
    badge: '04',
    descripcion: 'Comparte promociones activas y llega a más clientes con una estética coherente dentro del estanque.',
    gradiente: 'linear-gradient(135deg, rgba(161, 83, 56, 0.98), rgba(102, 43, 29, 0.94))',
    kicker: 'Visibilidad',
    puntos: [],
    titulo: 'Mueve tu presencia'
  },
  {
    badge: '05',
    descripcion: 'Nenúfar quiere ayudarte a construir relación, no solo tráfico. Lo importante es quedarse.',
    gradiente: 'linear-gradient(135deg, rgba(110, 45, 91, 0.98), rgba(48, 20, 40, 0.94))',
    kicker: 'Comunidad',
    puntos: [
      'Conecta con clientes que quieran seguirte.',
      'Genera una reputación más viva y cercana.',
      'Haz crecer tu negocio dentro del estanque con continuidad.'
    ],
    titulo: 'Crea vínculo local'
  }
];

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    DashboardAnimComponent,
    HorarioNegocioAnimComponent,
    LogroAnimComponent,
    NenufarPondComponent,
    PublicarAnimComponent,
    ReservaAnimComponent,
  ],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.scss']
})
export class OnboardingComponent implements OnChanges {
  @Input() visible = false;
  @Input() modo: OnboardingModo = 'usuario';
  @Output() cerrar = new EventEmitter<void>();
  @Output() continuar = new EventEmitter<OnboardingModo>();

  readonly animando = signal(false);
  readonly direccion = signal<'adelante' | 'atras'>('adelante');
  readonly indice = signal(0);
  readonly modoActual = signal<OnboardingModo>('usuario');

  readonly slides = computed(() =>
    this.modoActual() === 'usuario' ? SLIDES_USUARIO : SLIDES_NEGOCIO
  );

  readonly slideActual = computed(() => this.slides()[this.indice()] ?? this.slides()[0]);
  readonly total = computed(() => this.slides().length);
  readonly esPrimero = computed(() => this.indice() === 0);
  readonly esUltimo = computed(() => this.indice() === this.total() - 1);

  // ── Animación asignada al slide actual ─────────────────────────────────
  readonly animacionActual = computed<AnimacionTipo>(() => {
    const modo = this.modoActual();
    const idx = this.indice();

    if (modo === 'usuario') {
      if (idx === 0) return 'nenufar-pond';     // Bienvenida
      if (idx === 1) return 'reserva';           // Reserva con ligereza
      if (idx === 2) return 'publicar-resena';   // Participa y deja huella
      if (idx === 4) return 'logro';             // Haz crecer tu camino
    }

    if (modo === 'negocio') {
      if (idx === 0) return 'nenufar-pond';      // Abre tu rincón
      if (idx === 1) return 'dashboard';         // Tu negocio de un vistazo
      if (idx === 2) return 'horario';           // Ordena tu ritmo
      if (idx === 3) return 'publicar-promo';    // Mueve tu presencia
    }

    return null;
  });

  readonly cabecera = computed(() => (
    this.modoActual() === 'usuario'
      ? {
          descripcion: 'Así se mueve el nenúfar si entras como rana: puedes volver o seguir hacia tu registro real cuando quieras.',
          kicker: 'Camino rana',
          titulo: 'Tu salto empieza aquí'
        }
      : {
          descripcion: 'Así florece tu presencia dentro del estanque si entras como nenúfar. Mira el recorrido y sigue solo si te encaja.',
          kicker: 'Camino nenúfar',
          titulo: 'Tu nenúfar entra al estanque'
        }
  ));

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['modo']) {
      this.modoActual.set(this.modo);
      this.indice.set(0);
    }

    if (changes['visible']?.currentValue === true) {
      this.indice.set(0);
      this.animando.set(false);
    }
  }

  anterior(): void {
    if (this.animando() || this.esPrimero()) return;
    this.direccion.set('atras');
    this.transicionar(() => this.indice.update((value) => value - 1));
  }

  continuarRegistro(): void {
    this.continuar.emit(this.modoActual());
  }

  irA(index: number): void {
    if (this.animando() || index === this.indice()) return;
    this.direccion.set(index > this.indice() ? 'adelante' : 'atras');
    this.transicionar(() => this.indice.set(index));
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('onboarding-overlay')) {
      this.cerrar.emit();
    }
  }

  siguiente(): void {
    if (this.animando() || this.esUltimo()) return;
    this.direccion.set('adelante');
    this.transicionar(() => this.indice.update((value) => value + 1));
  }

  private transicionar(update: () => void): void {
    this.animando.set(true);
    update();
    setTimeout(() => this.animando.set(false), 420);
  }
}
