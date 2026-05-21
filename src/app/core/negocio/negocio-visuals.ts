export interface NenufarOption {
  id: string;
  label: string;
  asset: string;
  description: string;
}

export interface NegocioVisualData {
  foto?: string | null;
  fotoPerfil?: string | null;
  fotoPortada?: string | null;
  avatar?: string | null;
  imagenNenufar?: string | null;
  nenufarActivo?: string | null;
  nenufarColor?: string | null;
  nenufarAsset?: string | null;
  nenufarKey?: string | null;
  assetNenufar?: string | null;
}

const NENUFAR_ASSET_BASE = 'assets/nenufares_colores';

export const NENUFAR_OPTIONS: NenufarOption[] = [
  { id: 'nenufar_var1', label: 'Nenufar original', asset: `${NENUFAR_ASSET_BASE}/nenufar_var1.png`, description: 'Fucsia sobre verde.' },
  { id: 'nenufar_var2', label: 'Nenufar gris', asset: `${NENUFAR_ASSET_BASE}/nenufar_var2.png`, description: 'Gris suave y aguamarina.' },
  { id: 'nenufar_var3', label: 'Nenufar azul', asset: `${NENUFAR_ASSET_BASE}/nenufar_var3.png`, description: 'Azul vivo sobre verde.' },
  { id: 'nenufar_var4', label: 'Nenufar naranja', asset: `${NENUFAR_ASSET_BASE}/nenufar_var4.png`, description: 'Naranja sobre turquesa.' },
  { id: 'nenufar_var5', label: 'Nenufar verde', asset: `${NENUFAR_ASSET_BASE}/nenufar_var5.png`, description: 'Verde jade y petroleo.' },
  { id: 'nenufar_var6', label: 'Nenufar rojo', asset: `${NENUFAR_ASSET_BASE}/nenufar_var6.png`, description: 'Rojo intenso sobre verde.' },
  { id: 'nenufar_var7', label: 'Nenufar dorado', asset: `${NENUFAR_ASSET_BASE}/nenufar_var7.png`, description: 'Dorado sobre violeta.' },
  { id: 'nenufar_var8', label: 'Nenufar celeste', asset: `${NENUFAR_ASSET_BASE}/nenufar_var8.png`, description: 'Celeste luminoso.' },
  { id: 'nenufar_var9', label: 'Nenufar rosado', asset: `${NENUFAR_ASSET_BASE}/nenufar_var9.png`, description: 'Crema sobre rosa.' },
  { id: 'nenufar_var10', label: 'Nenufar brillante', asset: `${NENUFAR_ASSET_BASE}/nenufar_var10.png`, description: 'Fucsia sobre lima.' },
  { id: 'nenufar_var11', label: 'Nenufar menta', asset: `${NENUFAR_ASSET_BASE}/nenufar_var11.png`, description: 'Menta sobre azul noche.' },
  { id: 'nenufar_var12', label: 'Nenufar violeta', asset: `${NENUFAR_ASSET_BASE}/nenufar_var12.png`, description: 'Violeta sobre turquesa.' },
  { id: 'nenufar_var13', label: 'Nenufar coral', asset: `${NENUFAR_ASSET_BASE}/nenufar_var13.png`, description: 'Coral con fondo salvia.' },
  { id: 'nenufar_var14', label: 'Nenufar amarillo', asset: `${NENUFAR_ASSET_BASE}/nenufar_var14.png`, description: 'Amarillo sobre lavanda.' },
  { id: 'nenufar_var15', label: 'Nenufar melocoton', asset: `${NENUFAR_ASSET_BASE}/nenufar_var15.png`, description: 'Melocoton sobre azul.' },
  { id: 'nenufar_var16', label: 'Nenufar atardecer', asset: `${NENUFAR_ASSET_BASE}/nenufar_var16.png`, description: 'Coral sobre verde agua.' },
  { id: 'nenufar_var17', label: 'Nenufar negro', asset: `${NENUFAR_ASSET_BASE}/nenufar_var17.png`, description: 'Negro sobre oliva.' },
];

export const DEFAULT_NENUFAR_ASSET = NENUFAR_OPTIONS[0].asset;
export const DEFAULT_NENUFAR_SMALL_ASSET = 'assets/imagenes/nenufar_small.png';
export const DEFAULT_NENUFAR_FALLBACK_ASSET = 'assets/imagenes/nenufar.png';

const LEGACY_NENUFAR_ALIASES: Record<string, string> = {
  'loto-rosa': 'nenufar_var1',
  'nenufar-loto-rosa': 'nenufar_var1',
  'nenufar-rosa-01': 'nenufar_var1',
  rosa: 'nenufar_var1',
  gris: 'nenufar_var2',
  azul: 'nenufar_var3',
  naranja: 'nenufar_var4',
  verde: 'nenufar_var5',
  rojo: 'nenufar_var6',
  dorado: 'nenufar_var7',
  celeste: 'nenufar_var8',
  rosado: 'nenufar_var9',
  brillante: 'nenufar_var10',
  menta: 'nenufar_var11',
  violeta: 'nenufar_var12',
  coral: 'nenufar_var13',
  amarillo: 'nenufar_var14',
  melocoton: 'nenufar_var15',
  atardecer: 'nenufar_var16',
  negro: 'nenufar_var17',
};

function normalizeVisualValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function isResolvableAsset(value: string): boolean {
  return (
    value.startsWith('assets/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  );
}

function normalizeNenufarAlias(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/_/g, '-')
    .trim();
}

export function resolveNenufarAsset(
  value: string | number | null | undefined,
  options: NenufarOption[] = NENUFAR_OPTIONS,
): string | null {
  if (value == null) {
    return null;
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue) {
    return null;
  }

  const valueToResolve =
    LEGACY_NENUFAR_ALIASES[normalizeNenufarAlias(normalizedValue)] ?? normalizedValue;
  const option = options.find(
    (candidate) =>
      String(candidate.id) === valueToResolve ||
      candidate.asset === valueToResolve ||
      normalizeNenufarAlias(String(candidate.id)) === normalizeNenufarAlias(valueToResolve),
  );

  if (option) {
    return option.asset;
  }

  return isResolvableAsset(normalizedValue) ? normalizedValue : null;
}

export function resolveNenufarKey(
  value: string | number | null | undefined,
  options: NenufarOption[] = NENUFAR_OPTIONS,
): string | null {
  if (value == null) {
    return null;
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue) {
    return null;
  }

  const option = options.find(
    (candidate) =>
      String(candidate.id) === normalizedValue || candidate.asset === normalizedValue,
  );

  return option?.id ?? null;
}

function resolveNegocioNenufarAsset(
  negocio: NegocioVisualData | null | undefined,
  fallback: string,
): string {
  const candidates = [
    negocio?.nenufarAsset,
    negocio?.nenufarActivo,
    negocio?.assetNenufar,
    negocio?.imagenNenufar,
    negocio?.nenufarKey,
    negocio?.nenufarColor,
  ];

  for (const candidate of candidates) {
    const resolved = resolveNenufarAsset(normalizeVisualValue(candidate));
    if (resolved) {
      return resolved;
    }
  }

  return fallback;
}

export function resolveBusinessNenufarAsset(
  negocio: NegocioVisualData | null | undefined,
  fallback: string = DEFAULT_NENUFAR_FALLBACK_ASSET,
): string {
  return resolveNegocioNenufarAsset(negocio, fallback);
}

export function getNenufarNegocio(
  negocio: NegocioVisualData | null | undefined,
): string {
  return resolveNegocioNenufarAsset(negocio, DEFAULT_NENUFAR_SMALL_ASSET);
}

export function resolveBusinessImage(
  negocio: NegocioVisualData | null | undefined,
  options?: {
    fallback?: string;
    preferCover?: boolean;
  },
): string {
  const fallback = options?.fallback ?? DEFAULT_NENUFAR_FALLBACK_ASSET;
  const cover = normalizeVisualValue(negocio?.fotoPortada);
  const profile =
    resolveBusinessNenufarAsset(negocio, '') ||
    normalizeVisualValue(negocio?.fotoPerfil) ||
    normalizeVisualValue(negocio?.foto) ||
    normalizeVisualValue(negocio?.avatar);

  if (options?.preferCover) {
    return cover || profile || fallback;
  }

  return profile || cover || fallback;
}

export function addUnsplashParams(url: string, width: number): string {
  if (!url.includes('images.unsplash.com')) return url;
  return `${url.split('?')[0]}?auto=format&fit=max&q=75&w=${width}`;
}

export function buildUnsplashSrcset(url: string, widths: number[]): string {
  if (!url.includes('images.unsplash.com')) return '';
  const base = url.split('?')[0];
  return widths.map(w => `${base}?auto=format&fit=max&q=75&w=${w} ${w}w`).join(', ');
}
