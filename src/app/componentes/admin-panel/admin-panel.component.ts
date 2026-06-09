import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { AuthService, AuthUser } from '../../servicios/authService/auth.service';
import {
  AdminActionResponse,
  AdminLogEntry,
  AdminNegocio,
  AdminPromocion,
  AdminReserva,
  AdminResena,
  AdminService,
  AdminUsuario,
} from '../../servicios/adminService/admin.service';

type AdminTab =
  | 'usuarios'
  | 'negocios'
  | 'resenas'
  | 'promociones'
  | 'reservas'
  | 'logs';

type ActionKey = string;

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.css',
})
export class AdminPanelComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);

  readonly usuarioActual = signal<AuthUser | null>(this.authService.obtenerUsuario());
  readonly accesoDenegado = signal(false);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly accionEnCurso = signal<ActionKey | null>(null);
  readonly tabActiva = signal<AdminTab>('usuarios');

  readonly tabs: Array<{ id: AdminTab; label: string }> = [
    { id: 'usuarios', label: 'Usuarios' },
    { id: 'negocios', label: 'Negocios' },
    { id: 'resenas', label: 'Reseñas' },
    { id: 'promociones', label: 'Promociones' },
    { id: 'reservas', label: 'Reservas' },
    { id: 'logs', label: 'Logs' },
  ];

  readonly usuarios = signal<AdminUsuario[]>([]);
  readonly negocios = signal<AdminNegocio[]>([]);
  readonly resenas = signal<AdminResena[]>([]);
  readonly promociones = signal<AdminPromocion[]>([]);
  readonly reservas = signal<AdminReserva[]>([]);
  readonly logs = signal<AdminLogEntry[]>([]);

  ngOnInit(): void {
    const usuario = this.authService.obtenerUsuario();

    if (this.authService.esAdmin(usuario)) {
      this.usuarioActual.set(usuario);
      this.cargarPestana(this.tabActiva());
      return;
    }

    this.cargando.set(true);
    this.authService.me().subscribe({
      next: (actual) => {
        this.usuarioActual.set(actual);

        if (actual?.rolGlobal === 'ADMIN') {
          this.cargarPestana(this.tabActiva());
          return;
        }

        this.cargando.set(false);
        this.accesoDenegado.set(true);
        void this.router.navigate(['/mi-perfil']);
      },
      error: () => {
        this.cargando.set(false);
        this.accesoDenegado.set(true);
        void this.router.navigate(['/mi-perfil']);
      },
    });
  }

  seleccionarPestana(tab: AdminTab): void {
    this.tabActiva.set(tab);
    this.mensaje.set('');
    this.error.set('');
    this.cargarPestana(tab);
  }

  irAVerUsuario(usuarioId?: number): (string | number)[] | null {
    return this.buildRoute('/usuario', usuarioId);
  }

  irAVerNegocio(negocioId?: number): (string | number)[] | null {
    return this.buildRoute('/negocio', negocioId);
  }

  suspenderUsuario(usuario: AdminUsuario): void {
    this.ejecutarAccion(
      `usuarios:${usuario.id}:suspender`,
      this.adminService.suspenderUsuario(usuario.id),
      'usuarios',
    );
  }

  activarUsuario(usuario: AdminUsuario): void {
    this.ejecutarAccion(
      `usuarios:${usuario.id}:activar`,
      this.adminService.activarUsuario(usuario.id),
      'usuarios',
    );
  }

  borrarUsuario(usuario: AdminUsuario): void {
    if (!this.confirmarBorrado()) {
      return;
    }

    this.ejecutarAccion(
      `usuarios:${usuario.id}:borrar`,
      this.adminService.deleteUsuario(usuario.id),
      'usuarios',
    );
  }

  activarNegocio(negocio: AdminNegocio): void {
    this.ejecutarAccion(
      `negocios:${negocio.id}:activar`,
      this.adminService.activarNegocio(negocio.id),
      'negocios',
    );
  }

  desactivarNegocio(negocio: AdminNegocio): void {
    this.ejecutarAccion(
      `negocios:${negocio.id}:desactivar`,
      this.adminService.desactivarNegocio(negocio.id),
      'negocios',
    );
  }

  borrarNegocio(negocio: AdminNegocio): void {
    if (!this.confirmarBorrado()) {
      return;
    }

    this.ejecutarAccion(
      `negocios:${negocio.id}:borrar`,
      this.adminService.deleteNegocio(negocio.id),
      'negocios',
    );
  }

  ocultarResena(resena: AdminResena): void {
    this.ejecutarAccion(
      `resenas:${resena.id}:ocultar`,
      this.adminService.ocultarResena(resena.id),
      'resenas',
    );
  }

  publicarResena(resena: AdminResena): void {
    this.ejecutarAccion(
      `resenas:${resena.id}:publicar`,
      this.adminService.publicarResena(resena.id),
      'resenas',
    );
  }

  borrarResena(resena: AdminResena): void {
    if (!this.confirmarBorrado()) {
      return;
    }

    this.ejecutarAccion(
      `resenas:${resena.id}:borrar`,
      this.adminService.deleteResena(resena.id),
      'resenas',
    );
  }

  ocultarPromocion(promocion: AdminPromocion): void {
    this.ejecutarAccion(
      `promociones:${promocion.id}:ocultar`,
      this.adminService.ocultarPromocion(promocion.id),
      'promociones',
    );
  }

  publicarPromocion(promocion: AdminPromocion): void {
    this.ejecutarAccion(
      `promociones:${promocion.id}:publicar`,
      this.adminService.publicarPromocion(promocion.id),
      'promociones',
    );
  }

  borrarPromocion(promocion: AdminPromocion): void {
    if (!this.confirmarBorrado()) {
      return;
    }

    this.ejecutarAccion(
      `promociones:${promocion.id}:borrar`,
      this.adminService.deletePromocion(promocion.id),
      'promociones',
    );
  }

  cancelarReserva(reserva: AdminReserva): void {
    this.ejecutarAccion(
      `reservas:${reserva.id}:cancelar`,
      this.adminService.cancelarReserva(reserva.id),
      'reservas',
    );
  }

  borrarReserva(reserva: AdminReserva): void {
    if (!this.confirmarBorrado()) {
      return;
    }

    this.ejecutarAccion(
      `reservas:${reserva.id}:borrar`,
      this.adminService.deleteReserva(reserva.id),
      'reservas',
    );
  }

  estaAccionActiva(key: string): boolean {
    return this.accionEnCurso() === key;
  }

  getActionKey(tab: AdminTab, id: number, action: string): string {
    return `${tab}:${id}:${action}`;
  }

  esAdmin(): boolean {
    return this.authService.esAdmin(this.usuarioActual());
  }

  formatEstado(value?: string | null): string {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized.replaceAll('_', ' ') : 'Sin estado';
  }

  formatFecha(value?: string | null): string {
    if (!value) {
      return 'Sin fecha';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Sin fecha';
    }

    return parsed.toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  getUsuarioStats(usuario: AdminUsuario): string {
    const counts = usuario._count;

    return [
      `${counts?.negocios ?? 0} negocios`,
      `${counts?.resenas ?? 0} reseñas`,
      `${counts?.reservas ?? 0} reservas`,
    ].join(' · ');
  }

  getNegocioStats(negocio: AdminNegocio): string {
    const counts = negocio._count;

    return [
      `${counts?.productos ?? 0} productos`,
      `${counts?.promociones ?? 0} promociones`,
      `${counts?.resenas ?? 0} reseñas`,
      `${counts?.reservas ?? 0} reservas`,
    ].join(' · ');
  }

  getPromocionDescuento(promocion: AdminPromocion): string {
    if (promocion.descuento == null && !promocion.tipoDescuento) {
      return 'Sin detalle';
    }

    const value = promocion.descuento ?? 0;
    const type = promocion.tipoDescuento ?? '';

    return `${value} ${type}`.trim();
  }

  private cargarPestana(tab: AdminTab): void {
    switch (tab) {
      case 'usuarios':
        this.cargarColeccion(tab, this.adminService.listUsuarios(), (items) =>
          this.usuarios.set(items),
        );
        break;
      case 'negocios':
        this.cargarColeccion(tab, this.adminService.listNegocios(), (items) =>
          this.negocios.set(items),
        );
        break;
      case 'resenas':
        this.cargarColeccion(tab, this.adminService.listResenas(), (items) =>
          this.resenas.set(items),
        );
        break;
      case 'promociones':
        this.cargarColeccion(
          tab,
          this.adminService.listPromociones(),
          (items) => this.promociones.set(items),
        );
        break;
      case 'reservas':
        this.cargarColeccion(tab, this.adminService.listReservas(), (items) =>
          this.reservas.set(items),
        );
        break;
      case 'logs':
        this.cargarColeccion(tab, this.adminService.listLogs(), (items) =>
          this.logs.set(items),
        );
        break;
    }
  }

  private cargarColeccion<T>(
    _tab: AdminTab,
    request$: Observable<T[]>,
    onSuccess: (items: T[]) => void,
  ): void {
    this.cargando.set(true);
    this.accionEnCurso.set('carga');
    this.error.set('');

    request$
      .pipe(
        finalize(() => {
          this.cargando.set(false);
          this.accionEnCurso.set(null);
        }),
      )
      .subscribe({
        next: (items) => onSuccess(items),
        error: (error: unknown) => {
          this.error.set(
            this.extractErrorMessage(
              error,
              'La información del panel de administración no se cargó.',
            ),
          );
        },
      });
  }

  private ejecutarAccion<T>(
    key: ActionKey,
    request$: Observable<AdminActionResponse<T>>,
    tab: AdminTab,
  ): void {
    this.accionEnCurso.set(key);
    this.error.set('');
    this.mensaje.set('');

    request$
      .pipe(finalize(() => this.accionEnCurso.set(null)))
      .subscribe({
        next: (response) => {
          this.mensaje.set(
            response.message || 'Acción de administración completada correctamente.',
          );
          this.cargarPestana(tab);
        },
        error: (error: unknown) => {
          this.error.set(
            this.extractErrorMessage(
              error,
              'La acción de administración no se completó.',
            ),
          );
        },
      });
  }

  private confirmarBorrado(): boolean {
    return window.confirm(
      '¿Seguro que quieres borrar esto? Esta acción puede afectar a la plataforma.',
    );
  }

  private buildRoute(
    base: '/usuario' | '/negocio',
    id?: number,
  ): (string | number)[] | null {
    const normalizedId = Number(id);

    return Number.isInteger(normalizedId) && normalizedId > 0
      ? [base, normalizedId]
      : null;
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage =
        typeof error.error?.message === 'string'
          ? error.error.message
          : Array.isArray(error.error?.message)
            ? error.error.message.join(' ')
            : '';

      return backendMessage || fallback;
    }

    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message.trim();
      }
    }

    return fallback;
  }
}
