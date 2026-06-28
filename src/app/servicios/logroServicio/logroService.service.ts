import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export type LogroTipo =
  | 'RESENAS_CONTADOR'
  | 'COMPRAS_CONTADOR'
  | 'VISITAS_CONTADOR'
  | string;
export type Dificultad = 'FACIL' | 'MEDIA' | 'DIFICIL' | string;
export type AccionLogro =
  | 'RESENA_PUBLICADA'
  | 'COMPRA_REALIZADA'
  | 'RESERVA_HECHA'
  | 'PROMOCION_CANJEADA'
  | 'VISITA_NEGOCIO'
  | 'NEGOCIO_SEGUIDO'
  | string;

export interface Logro {
  id: number;
  titulo: string;
  descripcion?: string;
  tipo: LogroTipo;
  dificultad: Dificultad;
  umbral: number;
  recompensaPuntos: number;
  categoriaId?: number;
  subcategoriaId?: number;
  negocioId?: number;
  productoId?: number;
  [key: string]: unknown;
}

export interface LogroBasico {
  id: number;
  titulo: string;
  descripcion?: string;
  tipo: LogroTipo;
  dificultad: Dificultad;
  umbral: number;
  recompensaPuntos: number;
  accion?: AccionLogro;
}

export interface MiLogro {
  id: number;
  conseguidoEn: string;
  logro: LogroBasico;
  [key: string]: unknown;
}

export interface MisLogrosResumen {
  logros: MiLogro[];
  petalosSaldo?: number;
}

export interface NivelProgreso {
  id: number;
  titulo: string;
  umbral: number;
  recompensaPuntos: number;
  desbloqueado: boolean;
  conseguidoEn?: string;
}

export interface ProgresoEscalera {
  accion: AccionLogro;
  accionLabel: string;
  contador: number;
  niveles: NivelProgreso[];
}

export interface CreateLogroPayload {
  titulo: string;
  descripcion?: string;
  tipo: LogroTipo;
  dificultad?: Dificultad;
  umbral: number;
  recompensaPuntos: number;
  categoriaId?: number;
  subcategoriaId?: number;
  negocioId?: number;
  productoId?: number;
}

export type UpdateLogroPayload = Partial<CreateLogroPayload>;

export interface LogroUsuario {
  logroId: number;
  usuarioId: number;
  [key: string]: unknown;
}

export interface UpdateLogrosDestacadosPayload {
  logroIds: number[];
}

@Injectable({ providedIn: 'root' })
export class LogroServiceService {
  private readonly http = inject(HttpClient);

  create(payload: CreateLogroPayload): Observable<Logro> {
    return this.http.post<Logro>(
      buildApiUrl('/logros'),
      payload,
      { withCredentials: true },
    );
  }

  findAll(): Observable<Logro[]> {
    return this.http
      .get<Logro[] | ApiListResponse<Logro>>(
        buildApiUrl('/logros'),
        { withCredentials: true },
      )
      .pipe(map((response) => extractItems(response)));
  }

  update(id: number, payload: UpdateLogroPayload): Observable<Logro> {
    return this.http.patch<Logro>(
      buildApiUrl(`/logros/${id}`),
      payload,
      { withCredentials: true },
    );
  }

  asignar(logroId: number, usuarioId: number): Observable<LogroUsuario> {
    return this.http.post<LogroUsuario>(
      buildApiUrl(`/logros/${logroId}/usuario/${usuarioId}`),
      {},
      { withCredentials: true },
    );
  }

  porUsuario(usuarioId: number): Observable<LogroUsuario[]> {
    return this.http
      .get<LogroUsuario[] | ApiListResponse<LogroUsuario>>(
        buildApiUrl(`/logros/usuario/${usuarioId}`),
        { withCredentials: true },
      )
      .pipe(map((response) => extractItems(response)));
  }

  misLogros(): Observable<MiLogro[]> {
    return this.misLogrosResumen().pipe(map((response) => response.logros));
  }

  misLogrosResumen(): Observable<MisLogrosResumen> {
    return this.http
      .get<unknown>(
        buildApiUrl('/me/logros'),
        { withCredentials: true },
      )
      .pipe(
        map((response) => ({
          logros: this.extractLogrosResponse(response),
          ...(this.extractPetalosSaldo(response) != null
            ? { petalosSaldo: this.extractPetalosSaldo(response) }
            : {}),
        })),
      );
  }

  misLogrosDestacados(): Observable<MiLogro[]> {
    return this.http
      .get<unknown>(
        buildApiUrl('/me/logros/destacados'),
        { withCredentials: true },
      )
      .pipe(map((response) => this.extractLogrosResponse(response)));
  }

  actualizarMisLogrosDestacados(logroIds: number[]): Observable<MiLogro[]> {
    return this.http
      .put<unknown>(
        buildApiUrl('/me/logros/destacados'),
        { logroIds } satisfies UpdateLogrosDestacadosPayload,
        { withCredentials: true },
      )
      .pipe(map((response) => this.extractLogrosResponse(response)));
  }

  logrosDestacadosUsuario(usuarioId: number): Observable<MiLogro[]> {
    return this.http
      .get<unknown>(
        buildApiUrl(`/usuarios/${usuarioId}/logros/destacados`),
        { withCredentials: true },
      )
      .pipe(map((response) => this.extractLogrosResponse(response)));
  }

  miProgreso(): Observable<ProgresoEscalera[]> {
    return this.http.get<ProgresoEscalera[]>(
      buildApiUrl('/me/logros/progreso'),
      { withCredentials: true },
    );
  }

  findOne(id: number): Observable<Logro> {
    return this.http.get<Logro>(buildApiUrl(`/logros/${id}`));
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete<unknown>(
      buildApiUrl(`/logros/${id}`),
      { withCredentials: true },
    );
  }

  private extractLogrosResponse(response: unknown): MiLogro[] {
    if (Array.isArray(response)) {
      return response as MiLogro[];
    }

    const record = response && typeof response === 'object'
      ? response as Record<string, unknown>
      : null;

    if (!record) {
      return [];
    }

    const items =
      record['items'] ??
      record['logros'] ??
      record['destacados'] ??
      record['logrosDestacados'] ??
      record['data'];

    return Array.isArray(items) ? items as MiLogro[] : [];
  }

  private extractPetalosSaldo(response: unknown): number | undefined {
    const record = response && typeof response === 'object'
      ? response as Record<string, unknown>
      : null;

    if (!record) {
      return undefined;
    }

    const balance = record['balance'] && typeof record['balance'] === 'object'
      ? record['balance'] as Record<string, unknown>
      : null;
    const petalos = record['petalos'] && typeof record['petalos'] === 'object'
      ? record['petalos'] as Record<string, unknown>
      : null;
    const parsed = Number(
      record['petalosSaldo'] ??
      record['saldoPetalos'] ??
      record['saldo'] ??
      balance?.['saldo'] ??
      petalos?.['saldo'],
    );

    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
