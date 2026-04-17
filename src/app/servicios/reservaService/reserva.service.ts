import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import {
  API_BASE_URL,
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

@Injectable({ providedIn: 'root' })
export class ReservaService {
  private readonly baseUrl = API_BASE_URL;

  constructor(private http: HttpClient) {}

  crearReserva(data: any) {
    return this.http.post(
      buildApiUrl(`/negocios/${data.negocioId}/reservas`),
      {
        fecha: new Date(data.fecha).toISOString(),
        nota: data.nota,
      },
    );
  }

  reservasPorUsuario(_usuarioId: number) {
    return this.http
      .get<ApiListResponse<any>>(buildApiUrl('/me/reservas'))
      .pipe(map((response) => extractItems(response)));
  }

  crear(reserva: {
    fecha: string;
    nota: string;
    negocioId: number;
    usuarioId: number;
  }): Observable<any> {
    return this.http.post<any>(
      buildApiUrl(`/negocios/${reserva.negocioId}/reservas`),
      {
        fecha: new Date(reserva.fecha).toISOString(),
        nota: reserva.nota,
      },
    );
  }

  cancelarReserva(id: number) {
    return this.http.delete(buildApiUrl(`/reservas/${id}`));
  }
}
