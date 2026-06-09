import { Injectable, inject } from '@angular/core';
import {
  Compra,
  CompraServiceService,
} from '../compraServicio/compraService.service';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import {
  MetodoPago,
  Pago,
  PagoServiceService,
} from '../pagoServicio/pagoService.service';
import {
  Pedido,
  PedidoService,
} from '../pedidoServicio/pedido.service';
import {
  Producto,
  ProductoServiceService,
} from '../productoServicio/productoService.service';
import {
  Observable,
  concatMap,
  delay,
  from,
  map,
  of,
  switchMap,
  throwError,
  toArray,
} from 'rxjs';

export interface TicketScannerLine {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number | null;
}

export interface TicketScannerAnalysis {
  storeName: string;
  ticketDate: string;
  total: number | null;
  items: TicketScannerLine[];
  source: 'fallback';
  note?: string;
}

export interface TicketScannerSubmitItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number | null;
}

export interface TicketScannerSubmitInput {
  negocioId: number;
  negocioNombre?: string | null;
  canCreateProducts?: boolean;
  ticketDate?: string | null;
  total?: number | null;
  items: TicketScannerSubmitItem[];
  paymentMethod?: MetodoPago;
  paid?: boolean;
}

export interface TicketScannerSubmitResult {
  pedido: Pedido;
  compra: Compra;
  pago?: Pago | null;
  createdProducts: Producto[];
  reusedProducts: Producto[];
  total: number;
}

type ResolvedTicketItem = {
  item: TicketScannerSubmitItem;
  product: Producto;
  created: boolean;
};

const TICKET_HELP_NOTE =
  'El proyecto todavía no tiene un OCR interno conectado. Hemos preparado el ticket para revisión manual antes de guardar.';

@Injectable({ providedIn: 'root' })
export class TicketScannerService {
  private readonly productoService = inject(ProductoServiceService);
  private readonly pedidoService = inject(PedidoService);
  private readonly compraService = inject(CompraServiceService);
  private readonly pagoService = inject(PagoServiceService);

  analyzeImage(
    fileName: string | null | undefined,
    negocioNombre?: string | null,
  ): Observable<TicketScannerAnalysis> {
    return of(this.buildFallbackAnalysis(fileName, negocioNombre)).pipe(delay(900));
  }

  submitTicket(input: TicketScannerSubmitInput): Observable<TicketScannerSubmitResult> {
    const negocioId = Number(input.negocioId);
    if (!Number.isInteger(negocioId) || negocioId <= 0) {
      return throwError(() => new Error('El negocio del ticket no se identificó.'));
    }

    const items = input.items
      .map((item) => this.normalizeTicketItem(item))
      .filter((item): item is TicketScannerSubmitItem => item !== null);

    if (!items.length) {
      return throwError(() => new Error('Añade al menos un producto válido antes de guardar.'));
    }

    return this.productoService.listByNegocio(negocioId).pipe(
      switchMap((catalogo) =>
        this.resolveProductsForTicket(
          negocioId,
          items,
          catalogo,
          Boolean(input.canCreateProducts),
        ),
      ),
      switchMap((resolvedItems) =>
        this.pedidoService.createPedido(negocioId).pipe(
          switchMap((pedido) =>
            from(resolvedItems).pipe(
              concatMap((resolvedItem) =>
                this.pedidoService
                  .addItem(pedido.id, {
                    productoId: resolvedItem.product.id,
                    cantidad: resolvedItem.item.quantity,
                  })
                  .pipe(map(() => resolvedItem)),
              ),
              toArray(),
              switchMap((resolvedAfterItems) =>
                this.compraService.createCompra(pedido.id, { moneda: 'EUR' }).pipe(
                  switchMap((compra) => {
                    const total = this.resolveTicketTotal(items, input.total);
                    if (!input.paid) {
                      return of({
                        pedido,
                        compra,
                        pago: null,
                        createdProducts: resolvedAfterItems
                          .filter((entry) => entry.created)
                          .map((entry) => entry.product),
                        reusedProducts: resolvedAfterItems
                          .filter((entry) => !entry.created)
                          .map((entry) => entry.product),
                        total,
                      });
                    }

                    return this.pagoService
                      .createPago(compra.id, {
                        metodoPago: input.paymentMethod ?? 'EFECTIVO',
                        cantidad: total,
                        estado: 'PAGADO',
                        moneda: 'EUR',
                        refExterna: input.ticketDate?.trim() || undefined,
                      })
                      .pipe(
                        map((pago) => ({
                          pedido,
                          compra,
                          pago,
                          createdProducts: resolvedAfterItems
                            .filter((entry) => entry.created)
                            .map((entry) => entry.product),
                          reusedProducts: resolvedAfterItems
                            .filter((entry) => !entry.created)
                            .map((entry) => entry.product),
                          total,
                        })),
                      );
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  getFriendlySubmitError(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return getUserErrorMessage(
      error,
      'La compra del ticket no se guardó.',
    );
  }

  private buildFallbackAnalysis(
    fileName: string | null | undefined,
    negocioNombre?: string | null,
  ): TicketScannerAnalysis {
    return {
      storeName:
        negocioNombre?.trim() ||
        this.guessStoreNameFromFileName(fileName) ||
        'Establecimiento',
      ticketDate: new Date().toISOString().slice(0, 10),
      total: null,
      items: [
        {
          id: this.createLineId(),
          name: '',
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
        },
      ],
      source: 'fallback',
      note: TICKET_HELP_NOTE,
    };
  }

  private guessStoreNameFromFileName(fileName: string | null | undefined): string | null {
    if (!fileName?.trim()) {
      return null;
    }

    const withoutExtension = fileName.replace(/\.[^.]+$/, '');
    const cleaned = withoutExtension
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || null;
  }

  private normalizeTicketItem(item: TicketScannerSubmitItem): TicketScannerSubmitItem | null {
    const name = item.name?.trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const subtotal =
      item.subtotal === null || item.subtotal === undefined
        ? null
        : Number(item.subtotal);

    if (!name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return null;
    }

    return {
      name,
      quantity,
      unitPrice,
      subtotal: Number.isFinite(subtotal as number) && (subtotal as number) >= 0
        ? Number(subtotal)
        : null,
    };
  }

  private resolveTicketTotal(items: TicketScannerSubmitItem[], detectedTotal?: number | null): number {
    const computed = items.reduce((sum, item) => {
      const subtotal =
        item.subtotal !== null && item.subtotal !== undefined
          ? Number(item.subtotal)
          : item.quantity * item.unitPrice;
      return sum + (Number.isFinite(subtotal) ? subtotal : 0);
    }, 0);

    const total = Number(detectedTotal);
    if (Number.isFinite(total) && total > 0) {
      return Number(total.toFixed(2));
    }

    return Number(computed.toFixed(2));
  }

  private resolveProductsForTicket(
    negocioId: number,
    items: TicketScannerSubmitItem[],
    catalogo: Producto[],
    canCreateProducts: boolean,
  ): Observable<ResolvedTicketItem[]> {
    const knownProducts = [...catalogo];

    return from(items).pipe(
      concatMap((item) => {
        const existing = this.findMatchingProduct(knownProducts, item.name);
        if (existing) {
          return of({
            item,
            product: existing,
            created: false,
          });
        }

        if (!canCreateProducts) {
          return throwError(
            () =>
              new Error(
                `El producto "${item.name}" no existe todavía en el catálogo de este negocio. La creación automática está reservada a la cuenta propietaria o a un admin.`,
              ),
          );
        }

        return this.productoService
          .create(negocioId, {
            nombre: item.name,
            precio: item.unitPrice,
            descripcion: 'Producto detectado desde ticket',
            stockDisponible: 0,
            stockReservado: 0,
          })
          .pipe(
            map((createdProduct) => {
              knownProducts.unshift(createdProduct);
              return {
                item,
                product: createdProduct,
                created: true,
              };
            }),
          );
      }),
      toArray(),
    );
  }

  private findMatchingProduct(catalogo: Producto[], name: string): Producto | null {
    const normalizedTarget = this.normalizeName(name);
    return (
      catalogo.find((product) => this.normalizeName(product.nombre) === normalizedTarget) ??
      null
    );
  }

  private normalizeName(value: string | undefined | null): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private createLineId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `ticket-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
