/** Tipos MIME de imagen aceptados en toda la app (registro, perfiles, productos, promociones, reseñas). */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Valor listo para usar en el atributo `accept` de los `<input type="file">` de imagen. */
export const IMAGE_FILE_ACCEPT = ALLOWED_IMAGE_MIME_TYPES.join(',');

/** Tamaño máximo permitido para una imagen subida desde el frontend. */
export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const IMAGE_FILE_TYPE_ERROR = 'Solo se permiten imágenes JPG, PNG o WEBP.';
export const IMAGE_FILE_SIZE_ERROR = 'La imagen no puede superar los 5 MB.';

/**
 * Valida un archivo de imagen antes de previsualizarlo o enviarlo al backend.
 * Devuelve `null` si es válido, o el mensaje de error a mostrar si no lo es.
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return IMAGE_FILE_TYPE_ERROR;
  }

  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return IMAGE_FILE_SIZE_ERROR;
  }

  return null;
}
