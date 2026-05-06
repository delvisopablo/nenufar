import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../config/api.config';

export interface Referido {
  id: number;
  nickname: string;
  foto?: string;
  creadoEn: string;
}

@Injectable({ providedIn: 'root' })
export class NenufarizarService {
  private readonly http = inject(HttpClient);

  readonly codigoReferido = signal<string>('');
  readonly referidos = signal<Referido[]>([]);

  loadCodigo(): Observable<string> {
    return this.http
      .get<{ codigoReferido?: string | null }>(
        buildApiUrl('/usuarios/me/codigo-referido'),
      )
      .pipe(
        map((response) => String(response?.codigoReferido ?? '').trim()),
        tap((codigoReferido) => this.codigoReferido.set(codigoReferido)),
      );
  }

  regenerarCodigo(): Observable<string> {
    return this.http
      .post<{ codigoReferido?: string | null }>(
        buildApiUrl('/usuarios/me/codigo-referido/regenerar'),
        {},
      )
      .pipe(
        map((response) => String(response?.codigoReferido ?? '').trim()),
        tap((codigoReferido) => this.codigoReferido.set(codigoReferido)),
      );
  }

  loadReferidos(): Observable<Referido[]> {
    return this.http
      .get<Referido[] | ApiListResponse<Referido>>(
        buildApiUrl('/usuarios/me/referidos'),
      )
      .pipe(
        map((response) =>
          extractItems(response)
            .map((item) => this.normalizarReferido(item))
            .filter((item): item is Referido => item !== null),
        ),
        tap((referidos) => this.referidos.set(referidos)),
      );
  }

  private normalizarReferido(value: unknown): Referido | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const referido = value as {
      id?: number | string;
      nickname?: string | null;
      foto?: string | null;
      creadoEn?: string | null;
    };

    const id = Number(referido.id);
    const nickname = String(referido.nickname ?? '').trim();
    const creadoEn = String(referido.creadoEn ?? '').trim();

    if (!Number.isFinite(id) || id <= 0 || !nickname || !creadoEn) {
      return null;
    }

    return {
      id,
      nickname,
      ...(typeof referido.foto === 'string' && referido.foto.trim()
        ? { foto: referido.foto.trim() }
        : {}),
      creadoEn,
    };
  }
}
