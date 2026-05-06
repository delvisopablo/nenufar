import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-logos-nenufar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="logos-shell">
      <div class="logos-card">
        <p class="logos-kicker">Próximamente</p>
        <h1>Menú de logos y nenúfares</h1>
        <p>
          Esta ruta queda preparada para conectar el selector visual del negocio
          sin romper el editor actual.
        </p>
        <a class="logos-link" routerLink="/mi-negocio">Volver al perfil</a>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100%;
      padding: 2rem;
      background: var(--bg-base, #0b2d3f);
      color: var(--text-primary, #f7fff9);
    }

    .logos-shell {
      max-width: 44rem;
      margin: 0 auto;
    }

    .logos-card {
      display: grid;
      gap: 0.9rem;
      padding: 1.6rem;
      border-radius: 28px;
      background: linear-gradient(180deg, var(--surface-1, #133f4f), var(--surface-2, #0f3342));
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 20px 36px rgba(0, 0, 0, 0.2);
    }

    .logos-kicker {
      margin: 0;
      color: var(--nenufar-gold-400, #f5c66b);
      font-size: 0.8rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    h1, p {
      margin: 0;
    }

    .logos-link {
      display: inline-flex;
      width: fit-content;
      padding: 0.72rem 1rem;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--accent-primary, #f05c9c), var(--accent-primary-hover, #e94884));
      color: var(--text-on-accent, #fffafc);
      text-decoration: none;
      font-weight: 800;
    }
  `],
})
export class LogosNenufarComponent {}
