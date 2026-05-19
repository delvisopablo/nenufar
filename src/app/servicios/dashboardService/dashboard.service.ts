import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, map, Observable, of } from 'rxjs';
import { buildApiUrl, extractItems } from '../../config/api.config';

export type EstadoReserva =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'CANCELADA'
  | 'COMPLETADA'
  | 'NO_SHOW'
  | string;

export interface DashboardUsuario {
  id?: number;
  nombre: string;
  nickname?: string;
  foto?: string;
}

export interface DashboardReserva {
  id: number;
  fecha: string;
  estado: EstadoReserva;
  numPersonas: number;
  nota: string;
  duracionMinutos?: number;
  usuario: DashboardUsuario;
  recurso?: {
    id?: number;
    nombre: string;
  };
}

export interface DashboardNegocio {
  id: number;
  nombre: string;
  foto?: string;
  fotoPerfil?: string;
  fotoPortada?: string;
  nenufarAsset?: string;
  nenufarKey?: string;
  aceptaReservas: boolean;
  intervaloReserva?: number | null;
  categoria?: {
    nombre?: string;
  };
  horario?: {
    apertura?: string;
    cierre?: string;
    intervalo?: number;
    diasAbre?: string[];
    weekly?: Record<string, [string, string][]>;
  };
}

export interface DashboardResumen {
  totalReservas: number;
  pendientes: number;
  confirmadas: number;
  canceladas: number;
  completadas: number;
  noShow: number;
  puntuacionMedia: number;
  totalResenas: number;
  aceptaReservas: boolean;
  tieneHorario: boolean;
}

export interface DashboardMetrica {
  label: string;
  value: number;
}

export interface DashboardDisponibilidad {
  date: string;
  intervalo: number;
  slots: string[];
}

function normalizeCollection<T>(response: unknown): T[] {
  if (Array.isArray(response)) {
    return response as T[];
  }

  return extractItems(response as any);
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  obtenerNegocio(negocioId: number): Observable<DashboardNegocio> {
    return this.http
      .get<unknown>(buildApiUrl(`/negocios/${negocioId}`))
      .pipe(map((response) => this.normalizeNegocio(response)));
  }

  obtenerHorario(negocioId: number): Observable<DashboardNegocio['horario'] | null> {
    return this.http
      .get<unknown>(buildApiUrl(`/negocios/${negocioId}/horario`))
      .pipe(map((response) => this.normalizeHorario(response)));
  }

  obtenerResenas(negocioId: number): Observable<Array<{ puntuacion: number }>> {
    return this.http
      .get<unknown>(buildApiUrl(`/negocios/${negocioId}/resenas`))
      .pipe(
        map((response) => normalizeCollection<any>(response)),
        map((items) =>
          items.map((item) => ({
            puntuacion: Number(item?.puntuacion ?? 0) || 0
          }))
        )
      );
  }

  obtenerReservasNegocio(
    negocioId: number,
    options: { fecha?: string; estado?: string; page?: number; limit?: number } = {}
  ): Observable<DashboardReserva[]> {
    let params = new HttpParams();

    if (options.fecha) {
      params = params.set('fecha', options.fecha);
    }

    if (options.estado) {
      params = params.set('estado', options.estado);
    }

    if (options.page) {
      params = params.set('page', options.page);
    }

    if (options.limit) {
      params = params.set('limit', options.limit);
    }

    return this.http
      .get<unknown>(buildApiUrl(`/negocios/${negocioId}/reservas`), {
        params
      })
      .pipe(
        map((response) => normalizeCollection<any>(response)),
        map((items) => items.map((item) => this.normalizeReserva(item)))
      );
  }

  obtenerDisponibilidad(negocioId: number, fecha: string): Observable<DashboardDisponibilidad> {
    const params = new HttpParams().set('date', fecha);

    return this.http
      .get<unknown>(buildApiUrl(`/negocios/${negocioId}/availability`), {
        params
      })
      .pipe(map((response) => this.normalizeDisponibilidad(response, fecha)));
  }

  actualizarReservaEstado(reservaId: number, estado: EstadoReserva): Observable<DashboardReserva> {
    // TODO(backend): no existe PATCH /reservas/:id/estado en el backend actual.
    // Usamos PATCH /reservas/:id con el payload { estado }.
    return this.http
      .patch<unknown>(
        buildApiUrl(`/reservas/${reservaId}`),
        { estado }
      )
      .pipe(map((response) => this.normalizeReserva(response)));
  }

  actualizarReserva(
    reservaId: number,
    payload: Partial<{ estado: EstadoReserva; nota: string; fecha: string }>
  ): Observable<DashboardReserva> {
    return this.http
      .patch<unknown>(buildApiUrl(`/reservas/${reservaId}`), payload)
      .pipe(map((response) => this.normalizeReserva(response)));
  }

  getResumen(negocioId: number): Observable<DashboardResumen> {
    // TODO(backend): no existe GET /negocios/:id/dashboard/resumen en el backend actual.
    // Se construye el resumen usando /negocios/:id, /negocios/:id/resenas y /negocios/:id/reservas.
    return forkJoin({
      negocio: this.obtenerNegocio(negocioId),
      horario: this.obtenerHorario(negocioId),
      resenas: this.obtenerResenas(negocioId),
      reservas: this.obtenerReservasNegocio(negocioId, { limit: 200 })
    }).pipe(
      map(({ negocio, horario, resenas, reservas }) => {
        const tieneHorario = this.hasHorarioConfigurado(horario ?? negocio.horario);
        const totalResenas = resenas.length;
        const sumaPuntuacion = resenas.reduce((acc, item) => acc + item.puntuacion, 0);

        return {
          totalReservas: reservas.length,
          pendientes: reservas.filter((item) => item.estado === 'PENDIENTE').length,
          confirmadas: reservas.filter((item) => item.estado === 'CONFIRMADA').length,
          canceladas: reservas.filter((item) => item.estado === 'CANCELADA').length,
          completadas: reservas.filter((item) => item.estado === 'COMPLETADA').length,
          noShow: reservas.filter((item) => item.estado === 'NO_SHOW').length,
          puntuacionMedia: totalResenas ? Number((sumaPuntuacion / totalResenas).toFixed(1)) : 0,
          totalResenas,
          aceptaReservas: Boolean(negocio.aceptaReservas),
          tieneHorario
        };
      })
    );
  }

  getMetricas(negocioId: number): Observable<DashboardMetrica[]> {
    // TODO(backend): no existe GET /negocios/:id/dashboard/metricas en el backend actual.
    // Se calculan métricas de reservas por día con /negocios/:id/reservas.
    return this.obtenerReservasNegocio(negocioId, { limit: 300 }).pipe(
      map((reservas) => {
        const today = new Date();
        const labels = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(today);
          date.setDate(today.getDate() - (6 - index));
          const key = date.toISOString().slice(0, 10);

          return {
            key,
            label: date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
          };
        });

        return labels.map(({ key, label }) => ({
          label,
          value: reservas.filter((item) => item.fecha.slice(0, 10) === key).length
        }));
      })
    );
  }

  getReservasDashboard(negocioId: number): Observable<DashboardReserva[]> {
    // TODO(backend): no existe GET /negocios/:id/dashboard/reservas en el backend actual.
    // Reutilizamos GET /negocios/:id/reservas.
    return this.obtenerReservasNegocio(negocioId, { limit: 50 });
  }

  private normalizeDisponibilidad(response: unknown, fallbackDate: string): DashboardDisponibilidad {
    if (!response || typeof response !== 'object') {
      return {
        date: fallbackDate,
        intervalo: 30,
        slots: []
      };
    }

    const raw = response as { date?: string; fecha?: string; intervalo?: number; slots?: unknown[] };

    return {
      date: raw.date || raw.fecha || fallbackDate,
      intervalo: Number(raw.intervalo ?? 30) || 30,
      slots: Array.isArray(raw.slots)
        ? raw.slots
            .map((slot) => (typeof slot === 'string' ? slot : ''))
            .filter(Boolean)
        : []
    };
  }

  private normalizeHorario(response: unknown): DashboardNegocio['horario'] | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    return response as DashboardNegocio['horario'];
  }

  private normalizeNegocio(response: unknown): DashboardNegocio {
    const raw = (response && typeof response === 'object' ? response : {}) as Record<string, any>;
    const horario = this.normalizeHorario(raw['horario']);

    return {
      id: Number(raw['id'] ?? 0) || 0,
      nombre: String(raw['nombre'] ?? 'Negocio'),
      foto: raw['foto'] ?? undefined,
      fotoPerfil: raw['fotoPerfil'] ?? undefined,
      fotoPortada: raw['fotoPortada'] ?? undefined,
      nenufarAsset: raw['nenufarAsset'] ?? undefined,
      nenufarKey: raw['nenufarKey'] ?? undefined,
      aceptaReservas: Boolean(raw['aceptaReservas']),
      intervaloReserva: Number(raw['intervaloReserva'] ?? horario?.intervalo ?? 0) || null,
      categoria: raw['categoria'] ?? undefined,
      horario: horario ?? undefined
    };
  }

  private normalizeReserva(response: unknown): DashboardReserva {
    const raw = (response && typeof response === 'object' ? response : {}) as Record<string, any>;
    const usuarioRaw = (raw['usuario'] ?? raw['user'] ?? raw['cliente'] ?? {}) as Record<string, any>;
    const recursoRaw = (raw['recurso'] ?? raw['recursoReserva'] ?? null) as Record<string, any> | null;

    return {
      id: Number(raw['id'] ?? 0) || 0,
      fecha: String(raw['fecha'] ?? raw['startAt'] ?? raw['fechaReserva'] ?? new Date().toISOString()),
      estado: String(raw['estado'] ?? 'PENDIENTE'),
      numPersonas: Number(raw['numPersonas'] ?? raw['personas'] ?? raw['comensales'] ?? 1) || 1,
      nota: String(raw['nota'] ?? raw['observaciones'] ?? ''),
      duracionMinutos: raw['duracionMinutos'] ? Number(raw['duracionMinutos']) : undefined,
      usuario: {
        id: usuarioRaw['id'] ? Number(usuarioRaw['id']) : undefined,
        nombre: String(
          usuarioRaw['nombre'] ??
            usuarioRaw['autorNombre'] ??
            usuarioRaw['nickname'] ??
            'Cliente de Nenúfar'
        ),
        nickname: usuarioRaw['nickname'] ? String(usuarioRaw['nickname']) : undefined,
        foto: usuarioRaw['foto'] ?? usuarioRaw['foto_perfil'] ?? undefined
      },
      recurso: recursoRaw
        ? {
            id: recursoRaw['id'] ? Number(recursoRaw['id']) : undefined,
            nombre: String(recursoRaw['nombre'] ?? 'Mesa')
          }
        : undefined
    };
  }

  private hasHorarioConfigurado(horario: DashboardNegocio['horario'] | null | undefined): boolean {
    if (!horario) {
      return false;
    }

    if (horario.apertura && horario.cierre) {
      return true;
    }

    const weeklyRanges = Object.values(horario.weekly ?? {}).flat();
    return weeklyRanges.length > 0;
  }

  // ── Endpoints REALES /api/negocios/:id/dashboard/* (añadidos sin tocar la
  // lógica anterior; los métodos getResumen/getMetricas/getReservasDashboard
  // siguen siendo los que el componente actualmente consume) ──────────────────

  private buildRangeParams(range?: { from?: string; to?: string; days?: number }): HttpParams {
    let params = new HttpParams();
    if (range?.from) params = params.set('from', range.from);
    if (range?.to) params = params.set('to', range.to);
    if (range?.days) params = params.set('days', String(range.days));
    return params;
  }

  /** GET /api/negocios/:id/dashboard/resumen */
  getDashboardResumen(negocioId: number, range?: { from?: string; to?: string; days?: number }): Observable<unknown> {
    return this.http.get<unknown>(
      buildApiUrl(`/negocios/${negocioId}/dashboard/resumen`),
      { params: this.buildRangeParams(range) },
    );
  }

  /** GET /api/negocios/:id/dashboard/ventas */
  getDashboardVentas(negocioId: number, range?: { from?: string; to?: string; days?: number }): Observable<unknown> {
    return this.http.get<unknown>(
      buildApiUrl(`/negocios/${negocioId}/dashboard/ventas`),
      { params: this.buildRangeParams(range) },
    );
  }

  /** GET /api/negocios/:id/dashboard/ingresos */
  getDashboardIngresos(negocioId: number, range?: { from?: string; to?: string; days?: number }): Observable<unknown> {
    return this.http.get<unknown>(
      buildApiUrl(`/negocios/${negocioId}/dashboard/ingresos`),
      { params: this.buildRangeParams(range) },
    );
  }

  /** GET /api/negocios/:id/dashboard/pedidos */
  getDashboardPedidos(negocioId: number, range?: { from?: string; to?: string; days?: number }): Observable<unknown> {
    return this.http.get<unknown>(
      buildApiUrl(`/negocios/${negocioId}/dashboard/pedidos`),
      { params: this.buildRangeParams(range) },
    );
  }

  /** GET /api/negocios/:id/dashboard/reservas */
  getDashboardReservas(negocioId: number, range?: { from?: string; to?: string; days?: number }): Observable<unknown> {
    return this.http.get<unknown>(
      buildApiUrl(`/negocios/${negocioId}/dashboard/reservas`),
      { params: this.buildRangeParams(range) },
    );
  }

  /** GET /api/negocios/:id/dashboard/productos */
  getDashboardProductos(negocioId: number, range?: { from?: string; to?: string; days?: number }): Observable<unknown> {
    return this.http.get<unknown>(
      buildApiUrl(`/negocios/${negocioId}/dashboard/productos`),
      { params: this.buildRangeParams(range) },
    );
  }

  /** GET /api/negocios/:id/dashboard/clientes */
  getDashboardClientes(negocioId: number, range?: { from?: string; to?: string; days?: number }): Observable<unknown> {
    return this.http.get<unknown>(
      buildApiUrl(`/negocios/${negocioId}/dashboard/clientes`),
      { params: this.buildRangeParams(range) },
    );
  }

  /** GET /api/negocios/:id/dashboard/conversion */
  getDashboardConversion(negocioId: number, range?: { from?: string; to?: string; days?: number }): Observable<unknown> {
    return this.http.get<unknown>(
      buildApiUrl(`/negocios/${negocioId}/dashboard/conversion`),
      { params: this.buildRangeParams(range) },
    );
  }

  /** GET /api/negocios/:id/dashboard/categorias */
  getDashboardCategorias(negocioId: number, range?: { from?: string; to?: string; days?: number }): Observable<unknown> {
    return this.http.get<unknown>(
      buildApiUrl(`/negocios/${negocioId}/dashboard/categorias`),
      { params: this.buildRangeParams(range) },
    );
  }

}
