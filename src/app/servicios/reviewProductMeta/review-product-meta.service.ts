import { Injectable } from '@angular/core';
import {
  ReviewProductChip,
  SuggestedReviewProduct,
  buildSuggestedProductLocalId,
  dedupeReviewProductChips,
  dedupeSuggestedReviewProducts,
  extractPendingSuggestedProductLabels,
  extractReviewProductChips,
  extractReviewProductLabels,
  extractSuggestedReviewProducts,
  getPrimaryReviewProductLabel,
  normalizeSuggestedReviewProduct,
} from '../../core/reviews/review-products';

export interface PendingProductSuggestionRequest extends SuggestedReviewProduct {
  localId: string;
  reviewId: number;
  negocioId: number;
  createdAt: string;
  reviewContenido?: string | null;
  usuarioId?: number | null;
  usuarioNombre?: string | null;
  source: 'local';
}

interface StoredReviewProductMeta {
  reviewId: number;
  negocioId: number;
  productos: ReviewProductChip[];
  productosSugeridos: SuggestedReviewProduct[];
  createdAt: string;
  reviewContenido?: string | null;
  usuarioId?: number | null;
  usuarioNombre?: string | null;
}

const STORAGE_KEY = 'nenufar.review-product-meta.v1';
const MAX_META_AGE_MS = 45 * 24 * 60 * 60 * 1000;

function asRecord<T>(value: T): T & Record<string, unknown> {
  return value as T & Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class ReviewProductMetaService {
  rememberReviewMeta(options: {
    reviewId: number;
    negocioId: number;
    productos?: ReviewProductChip[];
    productosSugeridos?: SuggestedReviewProduct[];
    reviewContenido?: string | null;
    usuarioId?: number | null;
    usuarioNombre?: string | null;
  }): void {
    const reviewId = Number(options.reviewId);
    const negocioId = Number(options.negocioId);

    if (!Number.isFinite(reviewId) || reviewId <= 0 || !Number.isFinite(negocioId) || negocioId <= 0) {
      return;
    }

    const productos = dedupeReviewProductChips(options.productos ?? []);
    const productosSugeridos = dedupeSuggestedReviewProducts(
      (options.productosSugeridos ?? []).map((item, index) => ({
        ...item,
        localId:
          item.localId ||
          buildSuggestedProductLocalId(reviewId, item.nombre, index),
        estado: item.estado || 'pendiente',
      })),
    );

    const state = this.readState().filter((item) => item.reviewId !== reviewId);

    if (!productos.length && !productosSugeridos.length) {
      this.writeState(state);
      return;
    }

    state.unshift({
      reviewId,
      negocioId,
      productos,
      productosSugeridos,
      createdAt: new Date().toISOString(),
      reviewContenido: options.reviewContenido ?? null,
      usuarioId: options.usuarioId ?? null,
      usuarioNombre: options.usuarioNombre ?? null,
    });

    this.writeState(state);
  }

  mergeReview<T>(review: T): T {
    if (!review || typeof review !== 'object') {
      return review;
    }

    const reviewId = Number(asRecord(review)['id'] ?? 0);
    if (!Number.isFinite(reviewId) || reviewId <= 0) {
      return review;
    }

    const state = this.readState();
    const stored = state.find((item) => item.reviewId === reviewId);

    if (!stored) {
      return review;
    }

    const rawProducts = extractReviewProductChips(review);
    const rawSuggestions = extractSuggestedReviewProducts(review);

    const productos = dedupeReviewProductChips([
      ...rawProducts,
      ...stored.productos,
    ]);
    const productosSugeridos = dedupeSuggestedReviewProducts([
      ...rawSuggestions,
      ...stored.productosSugeridos,
    ]);
    const record = asRecord(review);

    return {
      ...review,
      ...(productos.length ? { productos } : {}),
      ...(productosSugeridos.length ? { productosSugeridos } : {}),
      ...(!record['productoNombre'] && productos[0]?.nombre
        ? { productoNombre: productos[0].nombre }
        : {}),
    };
  }

  mergeReviews<T>(reviews: T[]): T[] {
    return reviews.map((review) => this.mergeReview(review));
  }

  getProductLabels(review: unknown): string[] {
    return extractReviewProductLabels(this.mergeReview(review));
  }

  getPendingSuggestionLabels(review: unknown): string[] {
    return extractPendingSuggestedProductLabels(this.mergeReview(review));
  }

  getPrimaryProductLabel(review: unknown): string | null {
    return getPrimaryReviewProductLabel(this.mergeReview(review));
  }

  listPendingRequests(negocioId: number): PendingProductSuggestionRequest[] {
    const normalizedNegocioId = Number(negocioId);
    if (!Number.isFinite(normalizedNegocioId) || normalizedNegocioId <= 0) {
      return [];
    }

    return this.readState()
      .filter((item) => item.negocioId === normalizedNegocioId)
      .flatMap((item) =>
        item.productosSugeridos
          .filter((suggestion) => {
            const estado = String(suggestion.estado ?? 'pendiente').trim().toLowerCase();
            return !estado || estado === 'pendiente' || estado === 'pending';
          })
          .map((suggestion) => ({
            ...suggestion,
            localId:
              suggestion.localId ||
              buildSuggestedProductLocalId(item.reviewId, suggestion.nombre),
            reviewId: item.reviewId,
            negocioId: item.negocioId,
            createdAt: item.createdAt,
            reviewContenido: item.reviewContenido ?? null,
            usuarioId: item.usuarioId ?? null,
            usuarioNombre: item.usuarioNombre ?? null,
            source: 'local' as const,
          })),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  markSuggestionApproved(localId: string): void {
    this.updateSuggestionStatus(localId, 'aprobada');
  }

  markSuggestionRejected(localId: string): void {
    this.updateSuggestionStatus(localId, 'rechazada');
  }

  private updateSuggestionStatus(localId: string, status: string): void {
    const normalizedId = String(localId ?? '').trim();
    if (!normalizedId) {
      return;
    }

    const nextState = this.readState().map((entry) => ({
      ...entry,
      productosSugeridos: entry.productosSugeridos.map((item) =>
        item.localId === normalizedId ? { ...item, estado: status } : item,
      ),
    }));

    this.writeState(nextState);
  }

  private readState(): StoredReviewProductMeta[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        localStorage.removeItem(STORAGE_KEY);
        return [];
      }

      const now = Date.now();
      return parsed
        .map((item) => this.normalizeStoredEntry(item))
        .filter((item): item is StoredReviewProductMeta => item !== null)
        .filter((item) => now - new Date(item.createdAt).getTime() <= MAX_META_AGE_MS);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  }

  private writeState(state: StoredReviewProductMeta[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const sanitized = state
      .map((item) => this.normalizeStoredEntry(item))
      .filter((item): item is StoredReviewProductMeta => item !== null)
      .slice(0, 120);

    if (!sanitized.length) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  }

  private normalizeStoredEntry(value: unknown): StoredReviewProductMeta | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    const reviewId = Number(record['reviewId'] ?? 0);
    const negocioId = Number(record['negocioId'] ?? 0);
    const createdAt = String(record['createdAt'] ?? '').trim() || new Date().toISOString();

    if (!Number.isFinite(reviewId) || reviewId <= 0 || !Number.isFinite(negocioId) || negocioId <= 0) {
      return null;
    }

    return {
      reviewId,
      negocioId,
      productos: dedupeReviewProductChips(
        Array.isArray(record['productos'])
          ? record['productos']
              .map((item) => {
                if (!item || typeof item !== 'object') {
                  return null;
                }
                const normalized = item as ReviewProductChip;
                return normalized.nombre ? normalized : null;
              })
              .filter((item): item is ReviewProductChip => item !== null)
          : [],
      ),
      productosSugeridos: dedupeSuggestedReviewProducts(
        Array.isArray(record['productosSugeridos'])
          ? record['productosSugeridos']
              .map((item, index) =>
                normalizeSuggestedReviewProduct(
                  item,
                  buildSuggestedProductLocalId(
                    reviewId,
                    String(
                      (item as { nombre?: unknown } | null)?.nombre ?? '',
                    ),
                    index,
                  ),
                ),
              )
              .filter((item): item is SuggestedReviewProduct => item !== null)
          : [],
      ),
      createdAt,
      reviewContenido:
        typeof record['reviewContenido'] === 'string' ? record['reviewContenido'] : null,
      usuarioId: Number.isFinite(Number(record['usuarioId']))
        ? Number(record['usuarioId'])
        : null,
      usuarioNombre:
        typeof record['usuarioNombre'] === 'string' ? record['usuarioNombre'] : null,
    };
  }
}
