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

@Injectable({ providedIn: 'root' })
export class LogroServiceService {
  private readonly http = inject(HttpClient);

  create(payload: CreateLogroPayload): Observable<Logro> {
    return this.http.post<Logro>(buildApiUrl('/logros'), payload);
  }

  findAll(): Observable<Logro[]> {
    return this.http
      .get<Logro[] | ApiListResponse<Logro>>(buildApiUrl('/logros'))
      .pipe(map((response) => extractItems(response)));
  }

  update(id: number, payload: UpdateLogroPayload): Observable<Logro> {
    return this.http.patch<Logro>(buildApiUrl(`/logros/${id}`), payload);
  }

  asignar(logroId: number, usuarioId: number): Observable<LogroUsuario> {
    return this.http.post<LogroUsuario>(
      buildApiUrl(`/logros/${logroId}/usuario/${usuarioId}`),
      {},
    );
  }

  porUsuario(usuarioId: number): Observable<LogroUsuario[]> {
    return this.http
      .get<LogroUsuario[] | ApiListResponse<LogroUsuario>>(
        buildApiUrl(`/logros/usuario/${usuarioId}`),
      )
      .pipe(map((response) => extractItems(response)));
  }

  misLogros(): Observable<MiLogro[]> {
    return this.http
      .get<MiLogro[] | ApiListResponse<MiLogro>>(buildApiUrl('/me/logros'))
      .pipe(map((response) => extractItems(response)));
  }

  miProgreso(): Observable<ProgresoEscalera[]> {
    return this.http.get<ProgresoEscalera[]>(buildApiUrl('/me/logros/progreso'));
  }

  findOne(id: number): Observable<Logro> {
    return this.http.get<Logro>(buildApiUrl(`/logros/${id}`));
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete<unknown>(buildApiUrl(`/logros/${id}`));
  }
}
