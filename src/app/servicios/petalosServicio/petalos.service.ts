import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export interface PetalosBalance {
  saldo: number;
  [key: string]: unknown;
}

export interface PetalosTx {
  id: number;
  delta: number;
  saldoResultante?: number;
  motivo?: string;
  creadoEn?: string;
  [key: string]: unknown;
}

export interface PetalosLedgerOptions {
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class PetalosService {
  private readonly http = inject(HttpClient);

  /** GET /api/me/petalos/balance */
  balance(): Observable<PetalosBalance> {
    return this.http.get<PetalosBalance>(buildApiUrl('/me/petalos/balance'));
  }

  /** GET /api/me/petalos/tx */
  ledger(options: PetalosLedgerOptions = {}): Observable<PetalosTx[]> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', String(options.page));
    if (options.limit) params = params.set('limit', String(options.limit));

    return this.http
      .get<PetalosTx[] | ApiListResponse<PetalosTx>>(
        buildApiUrl('/me/petalos/tx'),
        { params },
      )
      .pipe(map((response) => extractItems(response)));
  }
}
