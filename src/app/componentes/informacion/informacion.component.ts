import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Elemento (bullet) de una diapositiva.
 */
interface Punto {
  texto: string;
}

interface Slide {
  id: string;
  etiqueta: string;   // pequeño rótulo superior (eyebrow)
  icono: IconKey;     // clave del icono del badge
  titulo: string;
  intro?: string;     // párrafo de entrada
  puntos?: Punto[];   // lista de bullets
  nota?: string;      // nota al pie de la diapositiva
}

/** Iconos disponibles (SVG en línea, estilo Lucide, sin dependencias). */
type IconKey =
  | 'droplet' | 'waves' | 'user' | 'store'
  | 'calendar' | 'star' | 'tag' | 'bell' | 'trophy' | 'receipt' | 'help';

@Component({
  selector: 'app-informacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="nf-info" (touchstart)="onTouchStart($event)" (touchend)="onTouchEnd($event)">
      <!-- Fondo decorativo tipo estanque -->
      <div class="nf-pond" aria-hidden="true">
        <span class="nf-lily nf-lily--1" [innerHTML]="lilySvg"></span>
        <span class="nf-lily nf-lily--2" [innerHTML]="lilySvg"></span>
        <span class="nf-lily nf-lily--3" [innerHTML]="lilySvg"></span>
      </div>

      <article class="nf-card">
        <header class="nf-card__top">
          <span class="nf-eyebrow">{{ actual().etiqueta }}</span>
          <span class="nf-counter">{{ indice() + 1 }} / {{ slides.length }}</span>
        </header>

        <div class="nf-card__body" [attr.data-slide]="actual().id">
          <div class="nf-badge" [innerHTML]="badge()"></div>

          <h2 class="nf-title">{{ actual().titulo }}</h2>

          @if (actual().intro) {
            <p class="nf-intro">{{ actual().intro }}</p>
          }

          @if (actual().puntos?.length) {
            <ul class="nf-list">
              @for (p of actual().puntos; track p.texto) {
                <li class="nf-list__item">
                  <span class="nf-list__icon" [innerHTML]="marcador"></span>
                  <span>{{ p.texto }}</span>
                </li>
              }
            </ul>
          }

          @if (actual().nota) {
            <p class="nf-note">{{ actual().nota }}</p>
          }

          <div class="nf-scroll-fade" aria-hidden="true"></div>
        </div>

        <footer class="nf-card__nav">
          <button
            type="button"
            class="nf-btn nf-btn--ghost"
            (click)="anterior()"
            [disabled]="indice() === 0"
            aria-label="Diapositiva anterior">
            ‹ Anterior
          </button>

          <nav class="nf-dots" aria-label="Ir a una diapositiva">
            @for (s of slides; track s.id; let i = $index) {
              <button
                type="button"
                class="nf-dot"
                [class.is-active]="i === indice()"
                (click)="irA(i)"
                [attr.aria-label]="'Diapositiva ' + (i + 1) + ': ' + s.titulo"
                [attr.aria-current]="i === indice() ? 'true' : null">
              </button>
            }
          </nav>

          <button
            type="button"
            class="nf-btn"
            (click)="siguiente()"
            [disabled]="indice() === slides.length - 1"
            aria-label="Siguiente diapositiva">
            Siguiente ›
          </button>
        </footer>

        <div class="nf-progress" aria-hidden="true">
          <span class="nf-progress__bar" [style.width.%]="progreso()"></span>
        </div>
      </article>
    </section>
  `,
  styles: [`
    :host {
      --nf-verde: #2f7d5b;
      --nf-verde-claro: #6fbf8f;
      --nf-agua: #d8f0f8;
      --nf-agua-honda: #b2dce9;
      --nf-tinta: #1f3b2f;
      display: block;
      width: 100%;
    }

    .nf-info {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 520px;
      padding: 32px 16px;
      background: radial-gradient(120% 120% at 50% 0%, var(--nf-agua) 0%, var(--nf-agua-honda) 100%);
      border-radius: 24px;
      overflow: hidden;
    }

    .nf-pond { position: absolute; inset: 0; pointer-events: none; }
    .nf-lily {
      position: absolute;
      display: block;
      color: var(--nf-verde-claro);
      opacity: .3;
      animation: nf-float 9s ease-in-out infinite;
    }
    .nf-lily ::ng-deep svg { width: 46px; height: 46px; }
    .nf-lily--1 { top: 12%; left: 8%; animation-delay: 0s; }
    .nf-lily--2 { bottom: 14%; right: 10%; transform: scale(1.3); animation-delay: 1.5s; }
    .nf-lily--3 { top: 55%; left: 18%; transform: scale(.7); animation-delay: 3s; }

    @keyframes nf-float {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50% { transform: translateY(-10px) rotate(4deg); }
    }

    .nf-card {
      position: relative;
      width: min(680px, 100%);
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 18px 45px rgba(31, 59, 47, .16);
      padding: 26px 30px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      overflow: hidden;
    }

    .nf-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .nf-eyebrow {
      text-transform: uppercase;
      letter-spacing: .12em;
      font-size: 12px;
      font-weight: 700;
      color: var(--nf-verde);
    }
    .nf-counter {
      font-size: 12px;
      font-weight: 600;
      color: #8aa79a;
    }

    .nf-card__body {
      height: 320px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
      padding-right: 6px;
      animation: nf-in .45s ease;
      scrollbar-width: thin;
      scrollbar-color: var(--nf-agua-honda) transparent;
    }
    @keyframes nf-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .nf-scroll-fade {
      position: sticky;
      bottom: -1px;
      left: 0;
      right: 0;
      flex: 0 0 20px;
      background: linear-gradient(to bottom, rgba(255, 255, 255, 0), #ffffff);
      pointer-events: none;
    }

    .nf-badge {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: #ffffff;
      background: linear-gradient(135deg, var(--nf-verde-claro), var(--nf-verde));
      box-shadow: 0 8px 18px rgba(47, 125, 91, .3);
    }
    .nf-badge ::ng-deep svg { width: 30px; height: 30px; }

    .nf-title {
      margin: 4px 0 0;
      font-size: 26px;
      line-height: 1.2;
      color: var(--nf-tinta);
      font-weight: 800;
    }
    .nf-intro {
      margin: 0;
      font-size: 16px;
      line-height: 1.6;
      color: #3f5b4e;
    }

    .nf-list { margin: 4px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
    .nf-list__item {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      font-size: 15px;
      line-height: 1.45;
      color: #35513f;
    }
    .nf-list__icon {
      flex: 0 0 auto;
      display: inline-flex;
      margin-top: 3px;
      color: var(--nf-verde);
    }
    .nf-list__icon ::ng-deep svg { width: 15px; height: 15px; }

    .nf-note {
      margin: 6px 0 0;
      font-size: 13px;
      font-style: italic;
      color: #7c948a;
      border-left: 3px solid var(--nf-agua-honda);
      padding-left: 10px;
    }

    .nf-card__nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 6px;
    }

    .nf-btn {
      border: none;
      cursor: pointer;
      font-weight: 700;
      font-size: 14px;
      padding: 10px 16px;
      border-radius: 999px;
      color: #fff;
      background: var(--nf-verde);
      transition: transform .12s ease, background .2s ease, opacity .2s ease;
    }
    .nf-btn:hover:not(:disabled) { background: #276a4d; transform: translateY(-1px); }
    .nf-btn--ghost { background: transparent; color: var(--nf-verde); }
    .nf-btn--ghost:hover:not(:disabled) { background: var(--nf-agua); }
    .nf-btn:disabled { opacity: .35; cursor: default; }

    .nf-dots { display: flex; gap: 7px; flex-wrap: wrap; justify-content: center; max-width: 260px; }
    .nf-dot {
      width: 9px; height: 9px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: var(--nf-agua-honda);
      cursor: pointer;
      transition: transform .15s ease, background .2s ease;
    }
    .nf-dot:hover { background: var(--nf-verde-claro); }
    .nf-dot.is-active { background: var(--nf-verde); transform: scale(1.35); }

    .nf-progress {
      position: absolute;
      left: 0; right: 0; bottom: 0;
      height: 4px;
      background: var(--nf-agua);
    }
    .nf-progress__bar {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, var(--nf-verde-claro), var(--nf-verde));
      transition: width .4s ease;
    }

    @media (max-width: 520px) {
      .nf-card { padding: 20px; }
      .nf-title { font-size: 22px; }
      .nf-card__nav { flex-wrap: wrap; }
      .nf-dots { order: 3; width: 100%; }
    }
  `],
})
export class InformacionComponent {
  constructor(private readonly sanitizer: DomSanitizer) {
    // Pre-sanitiza los iconos una sola vez.
    this.iconos = Object.fromEntries(
      Object.entries(InformacionComponent.RAW).map(([k, v]) => [
        k,
        this.sanitizer.bypassSecurityTrustHtml(this.wrap(v)),
      ]),
    ) as Record<IconKey, SafeHtml>;

    this.marcador = this.sanitizer.bypassSecurityTrustHtml(
      this.wrap('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="currentColor" stroke="none"/>'),
    );
    this.lilySvg = this.sanitizer.bypassSecurityTrustHtml(
      this.wrap('<ellipse cx="12" cy="12" rx="9" ry="9" fill="currentColor" stroke="none"/><path d="M12 12L20 7" stroke="#d8f0f8"/>'),
    );
  }

  /** Índice de la diapositiva visible. */
  readonly indice = signal(0);

  /** Diapositiva actual derivada del índice. */
  readonly actual = computed(() => this.slides[this.indice()]);

  /** Progreso (0-100) para la barra inferior. */
  readonly progreso = computed(
    () => ((this.indice() + 1) / this.slides.length) * 100,
  );

  /** SVG del badge de la diapositiva actual. */
  readonly badge = computed(() => this.iconos[this.actual().icono]);

  private readonly iconos: Record<IconKey, SafeHtml>;
  readonly marcador: SafeHtml;
  readonly lilySvg: SafeHtml;
  private touchX = 0;

  private wrap(inner: string): string {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      inner +
      '</svg>'
    );
  }

  siguiente(): void {
    this.indice.update((i) => Math.min(i + 1, this.slides.length - 1));
  }

  anterior(): void {
    this.indice.update((i) => Math.max(i - 1, 0));
  }

  irA(i: number): void {
    this.indice.set(Math.max(0, Math.min(i, this.slides.length - 1)));
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight') this.siguiente();
    if (e.key === 'ArrowLeft') this.anterior();
  }

  onTouchStart(e: TouchEvent): void {
    this.touchX = e.changedTouches[0].clientX;
  }

  onTouchEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this.touchX;
    if (Math.abs(dx) < 45) return;
    dx < 0 ? this.siguiente() : this.anterior();
  }

  /** Contenido interno (paths) de cada icono. */
  private static readonly RAW: Record<IconKey, string> = {
    droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5s2.4 2 5 2c1.3 0 1.9-.5 2.5-1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.4 2 5 2c1.3 0 1.9-.5 2.5-1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.4 2 5 2c1.3 0 1.9-.5 2.5-1"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    star: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    trophy: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a2 2 0 0 0 0 4h1M17 5h3a2 2 0 0 1 0 4h-1"/>',
    receipt: '<path d="M5 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  };

  /** Contenido del pase informativo. */
  readonly slides: readonly Slide[] = [
    {
      id: 'bienvenida',
      etiqueta: 'Bienvenida',
      icono: 'droplet',
      titulo: 'Nenúfar',
      intro:
        'Nenúfar es un sitio web para descubrir negocios locales, reseñas, promociones y experiencias cercanas de una forma visual y participativa.',
    },
    {
      id: 'estanque',
      etiqueta: 'El estanque',
      icono: 'waves',
      titulo: 'Así funciona el estanque',
      intro:
        'En el inicio puedes explorar el estanque, descubrir negocios cercanos, ver reseñas y encontrar promociones.',
      puntos: [
        { texto: 'Cada nenúfar representa una pieza del ecosistema local: un negocio, una reseña o una promoción.' },
        { texto: 'Los nenúfares grandes destacan reseñas.' },
        { texto: 'Los nenúfares pequeños destacan promociones.' },
        { texto: 'Los negocios aparecen en el estanque para que los descubras explorando.' },
      ],
    },
    {
      id: 'funcionalidades-negocios',
      etiqueta: 'Funcionalidades',
      icono: 'store',
      titulo: 'Para negocios / Nenúfares',
      puntos: [
        { texto: 'Tener un perfil público con identidad propia.' },
        { texto: 'Configurar horario y disponibilidad.' },
        { texto: 'Gestionar sus reservas desde un panel propio.' },
        { texto: 'Publicar promociones.' },
        { texto: 'Recibir reseñas y seguidores.' },
      ],
    },
    {
      id: 'funcionalidades-usuarios',
      etiqueta: 'Funcionalidades',
      icono: 'user',
      titulo: 'Para ranas / usuarios',
      puntos: [
        { texto: 'Descubrir negocios locales de forma visual y sencilla.' },
        { texto: 'Reservar en los negocios que lo permiten, desde su perfil.' },
        { texto: 'Dejar reseñas y ayudar a otros a decidir.' },
        { texto: 'Seguir negocios para tenerlos más presentes.' },
        { texto: 'Marcar productos como favoritos y guardarlos en tu Nenulista.' },
        { texto: 'Conseguir pétalos y logros por participar.' },
      ],
    },
    {
      id: 'reservas',
      etiqueta: 'Funcionalidades',
      icono: 'calendar',
      titulo: 'Reservas',
      intro:
        'Algunos negocios permiten hacer reservas directamente desde su perfil, de forma rápida y sencilla.',
    },
    {
      id: 'resenas',
      etiqueta: 'Funcionalidades',
      icono: 'star',
      titulo: 'Reseñas y reputación',
      intro:
        'Las reseñas ayudan a otros usuarios a decidir y permiten que los negocios construyan confianza dentro de la comunidad.',
      puntos: [
        { texto: 'Puntúa, cuenta tu experiencia y menciona productos.' },
        { texto: 'El sello Nenúfar destaca las reseñas más útiles.' },
      ],
    },
    {
      id: 'promociones',
      etiqueta: 'Funcionalidades',
      icono: 'tag',
      titulo: 'Promociones',
      intro:
        'Los negocios pueden publicar promociones para destacar productos, ofertas o momentos especiales.',
    },
    {
      id: 'seguimiento',
      etiqueta: 'Funcionalidades',
      icono: 'bell',
      titulo: 'Seguimiento',
      intro:
        'Puedes seguir negocios para no perderles la pista y recibir novedades sobre su actividad.',
    },
    {
      id: 'petalos',
      etiqueta: 'Funcionalidades',
      icono: 'trophy',
      titulo: 'Pétalos y logros',
      intro:
        'Los pétalos reflejan tu participación en Nenúfar. Puedes conseguirlos al reseñar, participar, explorar y completar logros.',
    },
    {
      id: 'nenulista',
      etiqueta: 'Funcionalidades',
      icono: 'receipt',
      titulo: 'Nenulista',
      intro:
        'Nenulista te permite buscar productos, marcarlos como favoritos, guardarlos en listas, preparar pedidos y compartir tus listas con otras personas.',
      puntos: [
        { texto: 'Buscar productos.' },
        { texto: 'Marcar productos como favoritos.' },
        { texto: 'Guardarlos en listas.' },
        { texto: 'Preparar pedidos.' },
        { texto: 'Compartir listas.' },
      ],
    },
    {
      id: 'ayuda',
      etiqueta: 'Ayuda',
      icono: 'help',
      titulo: 'Ayuda',
      intro: 'Si tienes alguna pregunta o necesitas ayuda, puedes escribirnos a:',
      puntos: [
        { texto: 'libeluladennenufar@gmail.com' },
      ],
    },
  ];
}
