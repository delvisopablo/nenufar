export type LogroIconLevel = 'normal' | 'bronce' | 'plata' | 'oro';

export interface LogroVisualData {
  id: number;
  titulo: string;
  descripcion?: string;
  tipo?: string;
  categoriaKey: string;
  dificultad?: string;
  umbral?: number;
  recompensaPuntos?: number;
  conseguidoEn?: string;
  motivo?: string;
  progreso?: string;
  raw?: unknown;
}

export const LOGRO_ICON_ASSETS: Record<LogroIconLevel, string> = {
  normal: 'assets/imagenes/nenufar_small.png',
  bronce: 'assets/nenufares_logros/nenufar_bronce.png',
  plata: 'assets/nenufares_logros/nenufar_plata.png',
  oro: 'assets/nenufares_logros/nenufar_oro.png',
};

const DIFICULTAD_ORDER: Record<string, number> = {
  FACIL: 1,
  FÁCIL: 1,
  MEDIA: 2,
  DIFICIL: 3,
  DIFÍCIL: 3,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
}

function asNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nestedLogro(source: Record<string, unknown>): Record<string, unknown> {
  return asRecord(source['logro']) ?? source;
}

export function normalizeLogroVisual(source: unknown): LogroVisualData | null {
  const raw = asRecord(source);
  if (!raw) {
    return null;
  }

  const logro = nestedLogro(raw);
  const id = asNumber(logro['id'] ?? raw['logroId'] ?? raw['id']);
  if (!id || id <= 0) {
    return null;
  }

  const categoria = asRecord(logro['categoria']) ?? asRecord(raw['categoria']);
  const categoriaKey =
    asString(logro['categoriaLogro']) ??
    asString(logro['categoria_logro']) ??
    asString(categoria?.['nombre']) ??
    asString(logro['categoria']) ??
    asString(raw['categoriaLogro']) ??
    asString(raw['tipo']) ??
    asString(logro['tipo']) ??
    asString(raw['accion']) ??
    asString(logro['accion']) ??
    'general';

  return {
    id,
    titulo: asString(logro['titulo'] ?? raw['titulo']) ?? 'Logro',
    descripcion: asString(logro['descripcion'] ?? raw['descripcion']),
    tipo: asString(logro['tipo'] ?? raw['tipo'] ?? logro['accion'] ?? raw['accion']),
    categoriaKey: categoriaKey.toLowerCase(),
    dificultad: asString(logro['dificultad'] ?? raw['dificultad']),
    umbral: asNumber(logro['umbral'] ?? raw['umbral']),
    recompensaPuntos: asNumber(logro['recompensaPuntos'] ?? raw['recompensaPuntos']),
    conseguidoEn: asString(raw['conseguidoEn'] ?? raw['createdAt'] ?? logro['conseguidoEn']),
    motivo: asString(raw['motivo'] ?? raw['razon'] ?? raw['reason']),
    progreso: asString(raw['progreso'] ?? raw['progress'] ?? raw['contador'] ?? raw['total']),
    raw: source,
  };
}

export function getLogroIconLevelByPosition(position: number): LogroIconLevel {
  if (position <= 0) {
    return 'normal';
  }

  if (position === 1) {
    return 'bronce';
  }

  if (position === 2) {
    return 'plata';
  }

  return 'oro';
}

export function getLogroIconAssetByPosition(position: number): string {
  return LOGRO_ICON_ASSETS[getLogroIconLevelByPosition(position)];
}

export function sortLogrosByProgression(items: LogroVisualData[]): LogroVisualData[] {
  return items.slice().sort((a, b) => {
    const umbralA = a.umbral ?? Number.MAX_SAFE_INTEGER;
    const umbralB = b.umbral ?? Number.MAX_SAFE_INTEGER;
    if (umbralA !== umbralB) {
      return umbralA - umbralB;
    }

    const dificultadA = DIFICULTAD_ORDER[(a.dificultad ?? '').toUpperCase()] ?? 99;
    const dificultadB = DIFICULTAD_ORDER[(b.dificultad ?? '').toUpperCase()] ?? 99;
    if (dificultadA !== dificultadB) {
      return dificultadA - dificultadB;
    }

    return a.id - b.id;
  });
}

export function resolveLogroIconAsset(
  source: unknown,
  collection: readonly unknown[] = [],
): string {
  const logro = normalizeLogroVisual(source);
  if (!logro) {
    return LOGRO_ICON_ASSETS.normal;
  }

  const normalizedCollection = collection
    .map((item) => normalizeLogroVisual(item))
    .filter((item): item is LogroVisualData => Boolean(item));
  const group = normalizedCollection.filter(
    (item) => item.categoriaKey === logro.categoriaKey,
  );
  const sortedGroup = sortLogrosByProgression(group.length ? group : [logro]);
  const index = sortedGroup.findIndex((item) => item.id === logro.id);

  return getLogroIconAssetByPosition(index >= 0 ? index : 0);
}

export function extractEmbeddedLogrosDestacados(source: unknown): LogroVisualData[] {
  const raw = asRecord(source);
  if (!raw) {
    return [];
  }

  const directKeys = [
    'logrosDestacados',
    'logros_destacados',
    'insignias',
    'insigniasPerfil',
    'insignias_perfil',
    'destacados',
  ];

  for (const key of directKeys) {
    const value = raw[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => normalizeLogroVisual(item))
        .filter((item): item is LogroVisualData => Boolean(item))
        .slice(0, 3);
    }
  }

  const logros = raw['logros'];
  if (!Array.isArray(logros)) {
    return [];
  }

  return logros
    .filter((item) => {
      const record = asRecord(item);
      return Boolean(
        record?.['destacado'] ??
        record?.['perfilDestacado'] ??
        record?.['esDestacado'],
      );
    })
    .map((item) => normalizeLogroVisual(item))
    .filter((item): item is LogroVisualData => Boolean(item))
    .slice(0, 3);
}

export function extractBusinessLogros(source: unknown): LogroVisualData[] {
  const raw = asRecord(source);
  if (!raw) {
    return [];
  }

  const keys = ['logrosNegocio', 'negocioLogros', 'logros', 'achievements'];
  for (const key of keys) {
    const value = raw[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => normalizeLogroVisual(item))
        .filter((item): item is LogroVisualData => Boolean(item));
    }
  }

  return [];
}

export function getBusinessLogroText(logro: LogroVisualData): string {
  const text = `${logro.tipo ?? ''} ${logro.titulo} ${logro.descripcion ?? ''}`.toLowerCase();
  const amount = logro.progreso ?? (logro.umbral != null ? String(logro.umbral) : '0');

  if (text.includes('rese')) return `Has recibido ${amount} reseñas.`;
  if (text.includes('promoc')) return `Has creado ${amount} promociones.`;
  if (text.includes('pedido') || text.includes('compra')) return `Has completado ${amount} pedidos.`;
  if (text.includes('reserva')) return `Has recibido ${amount} reservas.`;
  if (text.includes('seguidor')) return `Has conseguido ${amount} seguidores.`;
  if (text.includes('producto') || text.includes('catalog')) return `Has añadido ${amount} productos al catálogo.`;

  return logro.descripcion || logro.titulo;
}
