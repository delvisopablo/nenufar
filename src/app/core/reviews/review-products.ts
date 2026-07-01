export interface ReviewProductChip {
  id?: number | null;
  nombre: string;
  foto?: string | null;
  /** Cantidad local del composer de reseñas; no se persiste en backend (no soportado por POST /resena). */
  cantidad?: number;
}

export interface SuggestedReviewProduct {
  localId?: string;
  nombre: string;
  precioSugerido?: number | null;
  descripcion?: string | null;
  estado?: string | null;
}

type ReviewRecord = Record<string, unknown>;

function asRecord(value: unknown): ReviewRecord | null {
  return value && typeof value === 'object' ? (value as ReviewRecord) : null;
}

function cleanText(value: unknown): string {
  return String(value ?? '').trim();
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function toFiniteNumber(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeProductChip(value: unknown): ReviewProductChip | null {
  const record = asRecord(value);

  if (!record) {
    const nombre = cleanText(value);
    return nombre ? { nombre } : null;
  }

  const nombre =
    cleanText(record['nombre']) ||
    cleanText(record['productoNombre']) ||
    cleanText(record['servicioNombre']);

  if (!nombre) {
    return null;
  }

  const id = toFiniteNumber(record['id']);
  const foto =
    cleanText(record['foto']) ||
    cleanText(record['imagen']) ||
    cleanText(record['imageUrl']) ||
    cleanText(record['fotoUrl']) ||
    '';

  return {
    nombre,
    ...(id !== null ? { id } : {}),
    ...(foto ? { foto } : {}),
  };
}

export function normalizeSuggestedReviewProduct(
  value: unknown,
  fallbackId?: string,
): SuggestedReviewProduct | null {
  const record = asRecord(value);

  if (!record) {
    const nombre = cleanText(value);
    return nombre
      ? {
          nombre,
          ...(fallbackId ? { localId: fallbackId } : {}),
          estado: 'pendiente',
        }
      : null;
  }

  const nombre =
    cleanText(record['nombre']) ||
    cleanText(record['productoNombre']) ||
    cleanText(record['servicioNombre']);

  if (!nombre) {
    return null;
  }

  const precioSugerido = toFiniteNumber(
    record['precioSugerido'] ?? record['precio'] ?? record['precioProducto'],
  );
  const descripcion = cleanText(record['descripcion']) || cleanText(record['detalle']);
  const estado = cleanText(record['estado']) || 'pendiente';
  const localId =
    cleanText(record['localId']) ||
    cleanText(record['id']) ||
    fallbackId ||
    `suggested-${slugify(nombre)}`;

  return {
    localId,
    nombre,
    ...(precioSugerido !== null ? { precioSugerido } : {}),
    ...(descripcion ? { descripcion } : {}),
    estado,
  };
}

export function dedupeReviewProductChips(items: ReviewProductChip[]): ReviewProductChip[] {
  const seen = new Set<string>();
  const output: ReviewProductChip[] = [];

  for (const item of items) {
    const nombre = cleanText(item.nombre);
    if (!nombre) {
      continue;
    }

    const key = item.id != null ? `id:${item.id}` : `name:${slugify(nombre)}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push({
      ...item,
      nombre,
    });
  }

  return output;
}

export function dedupeSuggestedReviewProducts(
  items: SuggestedReviewProduct[],
): SuggestedReviewProduct[] {
  const seen = new Set<string>();
  const output: SuggestedReviewProduct[] = [];

  for (const item of items) {
    const nombre = cleanText(item.nombre);
    if (!nombre) {
      continue;
    }

    const key =
      cleanText(item.localId) ||
      `name:${slugify(nombre)}:${cleanText(item.estado || 'pendiente').toLowerCase()}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push({
      ...item,
      nombre,
      ...(item.localId ? { localId: item.localId } : {}),
      estado: cleanText(item.estado) || 'pendiente',
    });
  }

  return output;
}

export function extractReviewProductChips(review: unknown): ReviewProductChip[] {
  const record = asRecord(review);
  if (!record) {
    return [];
  }

  const fromArray = Array.isArray(record['productos'])
    ? record['productos']
        .map((item) => normalizeProductChip(item))
        .filter((item): item is ReviewProductChip => item !== null)
    : [];

  if (fromArray.length) {
    return dedupeReviewProductChips(fromArray);
  }

  const producto = normalizeProductChip(record['producto']);
  if (producto) {
    return [producto];
  }

  const legacyNombre =
    cleanText(record['productoNombre']) ||
    cleanText(record['nombreProducto']) ||
    cleanText(record['servicioNombre']);

  return legacyNombre ? [{ nombre: legacyNombre }] : [];
}

export function extractSuggestedReviewProducts(review: unknown): SuggestedReviewProduct[] {
  const record = asRecord(review);
  if (!record || !Array.isArray(record['productosSugeridos'])) {
    return [];
  }

  return dedupeSuggestedReviewProducts(
    record['productosSugeridos']
      .map((item, index) =>
        normalizeSuggestedReviewProduct(item, `suggested-${index}`),
      )
      .filter((item): item is SuggestedReviewProduct => item !== null),
  );
}

export function extractReviewProductLabels(review: unknown): string[] {
  return extractReviewProductChips(review).map((item) => item.nombre);
}

function isPendingStatus(value: string | null | undefined): boolean {
  const normalized = cleanText(value).toLowerCase();
  return !normalized || normalized === 'pendiente' || normalized === 'pending';
}

export function extractPendingSuggestedProductLabels(review: unknown): string[] {
  return extractSuggestedReviewProducts(review)
    .filter((item) => isPendingStatus(item.estado))
    .map((item) => `${item.nombre} · pendiente`);
}

export function getPrimaryReviewProductLabel(review: unknown): string | null {
  const labels = extractReviewProductLabels(review);
  return labels[0] ?? null;
}

export function buildSuggestedProductLocalId(
  reviewId: number,
  nombre: string,
  index = 0,
): string {
  return `review-${reviewId}-product-${index}-${slugify(nombre) || 'sugerido'}`;
}
