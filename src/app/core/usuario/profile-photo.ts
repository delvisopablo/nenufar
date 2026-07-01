import {
  MAX_IMAGE_FILE_SIZE_BYTES,
  validateImageFile,
} from '../forms/image-file-validators';

export type UserProfilePhotoSource = {
  foto?: string | null;
  fotoPerfil?: string | null;
  foto_perfil?: string | null;
};

export const DEFAULT_PROFILE_PHOTO = 'assets/imagenes/rana1_profile_foto.png';
/** @deprecated usa MAX_IMAGE_FILE_SIZE_BYTES de core/forms/image-file-validators */
export const MAX_PROFILE_PHOTO_BYTES = MAX_IMAGE_FILE_SIZE_BYTES;

export function resolveProfilePhoto(
  usuario: UserProfilePhotoSource | null | undefined,
): string | null {
  const foto =
    usuario?.fotoPerfil ??
    usuario?.foto_perfil ??
    (typeof usuario?.foto === 'string' ? usuario.foto : null);

  return typeof foto === 'string' && foto.trim() ? foto.trim() : null;
}

/** Valida la foto de perfil de usuario con la misma regla común de imágenes de toda la app. */
export function getProfilePhotoFileError(file: File): string {
  return validateImageFile(file) ?? '';
}
