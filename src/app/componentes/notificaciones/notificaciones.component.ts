import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import {
  Notificacion,
  NotificacionService,
  NotificacionTipo,
} from '../../servicios/notificacionServicio/notificacionService.service';

type TipoVisual = {
  label: string;
  className: string;
};

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notificaciones.component.html',
  styleUrl: './notificaciones.component.css',
})
export class NotificacionesComponent implements OnInit {
  private readonly notificaciones = inject(NotificacionService);
  private readonly router = inject(Router);

  readonly cargando = signal(true);
  readonly errorMensaje = signal('');
  readonly items = signal<Notificacion[]>([]);
  readonly countNoLeidas = signal(0);
  readonly tieneItems = computed(() => this.items().length > 0);

  ngOnInit(): void {
    this.cargarTodo();
    this.cargarCount();
  }

  cargarTodo(): void {
    this.cargando.set(true);
    this.errorMensaje.set('');

    this.notificaciones.list({ limit: 50 }).pipe(
      catchError((error: unknown) => {
        this.items.set([]);
        this.errorMensaje.set(
          getUserErrorMessage(error, 'Tus notificaciones no se cargaron.'),
        );
        this.cargando.set(false);
        return of([]);
      }),
    ).subscribe((items) => {
      this.items.set(items);
      this.cargando.set(false);
    });
  }

  cargarCount(): void {
    this.notificaciones.unreadCount().pipe(
      catchError(() => of({ count: 0 })),
    ).subscribe((response) => {
      this.countNoLeidas.set(Number(response.count ?? 0) || 0);
    });
  }

  marcarLeida(n: Notificacion): void {
    if (n.leida) {
      return;
    }

    this.notificaciones.markAsRead(n.id, true).pipe(
      catchError((error: unknown) => {
        this.errorMensaje.set(
          getUserErrorMessage(error, 'La notificación no se marcó como leída.'),
        );
        return of(null);
      }),
    ).subscribe((updated) => {
      if (!updated) {
        return;
      }

      this.items.update((items) =>
        items.map((item) => item.id === n.id ? updated : item),
      );
      this.countNoLeidas.update((count) => Math.max(0, count - 1));
    });
  }

  marcarTodas(): void {
    if (this.countNoLeidas() === 0) {
      return;
    }

    this.notificaciones.markAllRead().pipe(
      catchError((error: unknown) => {
        this.errorMensaje.set(
          getUserErrorMessage(error, 'Tus notificaciones no se marcaron como leídas.'),
        );
        return of({ actualizadas: 0 });
      }),
    ).subscribe(() => {
      this.items.update((items) =>
        items.map((item) => item.leida ? item : { ...item, leida: true }),
      );
      this.countNoLeidas.set(0);
    });
  }

  borrar(n: Notificacion): void {
    this.notificaciones.remove(n.id).pipe(
      catchError((error: unknown) => {
        this.errorMensaje.set(
          getUserErrorMessage(error, 'La notificación no se borró.'),
        );
        return of(null);
      }),
    ).subscribe((response) => {
      if (response === null) {
        return;
      }

      const eraNoLeida = !n.leida;
      this.items.update((items) => items.filter((item) => item.id !== n.id));
      if (eraNoLeida) {
        this.countNoLeidas.update((count) => Math.max(0, count - 1));
      }
    });
  }

  abrir(n: Notificacion): void {
    const navigate = () => {
      if (n.link) {
        void this.router.navigateByUrl(n.link);
      }
    };

    if (n.leida) {
      navigate();
      return;
    }

    this.notificaciones.markAsRead(n.id, true).pipe(
      catchError(() => of(null)),
    ).subscribe((updated) => {
      if (updated) {
        this.items.update((items) =>
          items.map((item) => item.id === n.id ? updated : item),
        );
        this.countNoLeidas.update((count) => Math.max(0, count - 1));
      }

      navigate();
    });
  }

  getTipoVisual(tipo: NotificacionTipo): TipoVisual {
    switch (tipo) {
      case 'PROMOCION':
        return { label: 'PR', className: 'tipo-badge--promo' };
      case 'POST':
        return { label: 'PO', className: 'tipo-badge--post' };
      case 'NEGOCIO':
        return { label: 'NG', className: 'tipo-badge--negocio' };
      case 'RESENA':
        return { label: 'RE', className: 'tipo-badge--resena' };
      default:
        return { label: 'SI', className: 'tipo-badge--sistema' };
    }
  }

  getRelativeDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

    if (diffMinutes < 60) {
      return `hace ${diffMinutes} min`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `hace ${diffHours} h`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return `hace ${diffDays} d`;
    }

    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
