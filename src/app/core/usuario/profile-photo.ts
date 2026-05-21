export type UserProfilePhotoSource = {
  foto?: string | null;
  fotoPerfil?: string | null;
  foto_perfil?: string | null;
};

export const DEFAULT_PROFILE_PHOTO = 'assets/imagenes/rana1_profile_foto.png';
export const MAX_PROFILE_PHOTO_BYTES = 3 * 1024 * 1024;
export const ALLOWED_PROFILE_PHOTO_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export function resolveProfilePhoto(
  usuario: UserProfilePhotoSource | null | undefined,
): string | null {
  const foto =
    usuario?.fotoPerfil ??
    usuario?.foto_perfil ??
    (typeof usuario?.foto === 'string' ? usuario.foto : null);

  return typeof foto === 'string' && foto.trim() ? foto.trim() : null;
}

export function getProfilePhotoFileError(file: File): string {
  if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) {
    return 'La foto debe ser JPG, PNG o WEBP.';
  }

  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    return 'La foto no puede superar 3 MB.';
  }

  return '';
}
