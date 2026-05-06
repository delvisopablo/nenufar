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
  { id: 'nenufar_var1', label: 'Nenufar 01', asset: `${NENUFAR_ASSET_BASE}/nenufar_var1.png`, description: 'Base fresca y botanica.' },
  { id: 'nenufar_var2', label: 'Nenufar 02', asset: `${NENUFAR_ASSET_BASE}/nenufar_var2.png`, description: 'Tono suave y equilibrado.' },
  { id: 'nenufar_var3', label: 'Nenufar 03', asset: `${NENUFAR_ASSET_BASE}/nenufar_var3.png`, description: 'Acento vivo y cercano.' },
  { id: 'nenufar_var4', label: 'Nenufar 04', asset: `${NENUFAR_ASSET_BASE}/nenufar_var4.png`, description: 'Presencia limpia y luminosa.' },
  { id: 'nenufar_var5', label: 'Nenufar 05', asset: `${NENUFAR_ASSET_BASE}/nenufar_var5.png`, description: 'Un toque alegre sin recargar.' },
  { id: 'nenufar_var6', label: 'Nenufar 06', asset: `${NENUFAR_ASSET_BASE}/nenufar_var6.png`, description: 'Perfil sereno y natural.' },
  { id: 'nenufar_var7', label: 'Nenufar 07', asset: `${NENUFAR_ASSET_BASE}/nenufar_var7.png`, description: 'Contraste amable para destacar.' },
  { id: 'nenufar_var8', label: 'Nenufar 08', asset: `${NENUFAR_ASSET_BASE}/nenufar_var8.png`, description: 'Lectura clara y muy versatil.' },
  { id: 'nenufar_var9', label: 'Nenufar 09', asset: `${NENUFAR_ASSET_BASE}/nenufar_var9.png`, description: 'Aspecto calido y acogedor.' },
  { id: 'nenufar_var10', label: 'Nenufar 10', asset: `${NENUFAR_ASSET_BASE}/nenufar_var10.png`, description: 'Equilibrio entre energia y calma.' },
  { id: 'nenufar_var11', label: 'Nenufar 11', asset: `${NENUFAR_ASSET_BASE}/nenufar_var11.png`, description: 'Ideal para una identidad alegre.' },
  { id: 'nenufar_var12', label: 'Nenufar 12', asset: `${NENUFAR_ASSET_BASE}/nenufar_var12.png`, description: 'Matiz delicado y luminoso.' },
  { id: 'nenufar_var13', label: 'Nenufar 13', asset: `${NENUFAR_ASSET_BASE}/nenufar_var13.png`, description: 'Tono marcado con aire artesanal.' },
  { id: 'nenufar_var14', label: 'Nenufar 14', asset: `${NENUFAR_ASSET_BASE}/nenufar_var14.png`, description: 'Acabado vegetal y elegante.' },
  { id: 'nenufar_var15', label: 'Nenufar 15', asset: `${NENUFAR_ASSET_BASE}/nenufar_var15.png`, description: 'Variante vibrante pero limpia.' },
  { id: 'nenufar_var16', label: 'Nenufar 16', asset: `${NENUFAR_ASSET_BASE}/nenufar_var16.png`, description: 'Tono expresivo para diferenciarse.' },
  { id: 'nenufar_var17', label: 'Nenufar 17', asset: `${NENUFAR_ASSET_BASE}/nenufar_var17.png`, description: 'Cierre intenso y memorable.' },
];

export const DEFAULT_NENUFAR_ASSET = NENUFAR_OPTIONS[0].asset;
export const DEFAULT_NENUFAR_SMALL_ASSET = 'assets/imagenes/nenufar_small.png';
export const DEFAULT_NENUFAR_FALLBACK_ASSET = 'assets/imagenes/nenufar.png';

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

  const option = options.find(
    (candidate) =>
      String(candidate.id) === normalizedValue || candidate.asset === normalizedValue,
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
  return (
    resolveNenufarAsset(
      normalizeVisualValue(negocio?.nenufarActivo) ??
        normalizeVisualValue(negocio?.assetNenufar) ??
        normalizeVisualValue(negocio?.nenufarAsset) ??
        normalizeVisualValue(negocio?.imagenNenufar),
    ) ??
    resolveNenufarAsset(
      normalizeVisualValue(negocio?.nenufarKey) ??
        normalizeVisualValue(negocio?.nenufarColor),
    ) ??
    resolveNenufarAsset(normalizeVisualValue(negocio?.fotoPerfil)) ??
    fallback
  );
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
