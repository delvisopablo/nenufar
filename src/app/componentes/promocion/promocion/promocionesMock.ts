export type PromoMock = {
  condiciones: string;
  descripcion: string;
  descripcionCorta: string;
  descuentoTexto: string;
  fechaCaducidadISO: string;
  id: number;
  negocioId: number;
  negocioNombre: string;
  titulo: string;
};

export const PROMOS_MOCK: PromoMock[] = [
  {
    id: 1,
    negocioId: 1,
    negocioNombre: 'Bar del Extremo',
    titulo: 'Jueves de cañas dobles',
    descripcion:
      'Pide una caña y la segunda cae al momento hasta agotar barril. Ideal para quien va saliendo del trabajo y quiere arrancar la tarde sin pensar demasiado.',
    condiciones: 'Valida los jueves de 19:00 a 22:30. No acumulable con otras promos.',
    descripcionCorta: 'Pide una caña y la segunda cae al momento hasta agotar barril.',
    descuentoTexto: '2x1',
    fechaCaducidadISO: '2026-04-18T23:59:59.000Z'
  },
  {
    id: 2,
    negocioId: 3,
    negocioNombre: 'El Café Olvidado',
    titulo: 'Desayuno de barrio',
    descripcion:
      'Cafe de especialidad mas tostada de masa madre en la primera franja del dia. Una promo pensada para entrar, desayunar bien y salir sin perder tiempo.',
    condiciones: 'Disponible de 08:00 a 11:30 mientras dure stock de pan del dia.',
    descripcionCorta: 'Café de especialidad más tostada de masa madre a primera hora.',
    descuentoTexto: '-30%',
    fechaCaducidadISO: '2026-04-14T11:30:00.000Z'
  },
  {
    id: 3,
    negocioId: 4,
    negocioNombre: 'Mercado Temporal',
    titulo: 'Pack tarde improvisada',
    descripcion:
      'Llevate bebida fria y picoteo listo para salir directo al paseo. La idea es resolver una compra rapida con una seleccion cerrada y precio compacto.',
    condiciones: 'Pack cerrado para dos personas. Disponible hasta fin de existencias.',
    descripcionCorta: 'Llévate bebida fría y picoteo listo para salir directo al paseo.',
    descuentoTexto: 'Pack 6€',
    fechaCaducidadISO: '2026-04-20T20:00:00.000Z'
  },
  {
    id: 4,
    negocioId: 5,
    negocioNombre: 'Biblioteca Subterránea',
    titulo: 'Club de lectura abierto',
    descripcion:
      'Entrada libre a la sesion de este viernes con te incluido para quien llegue pronto. Una promo pensada para probar el espacio sin reserva previa.',
    condiciones: 'Aforo limitado. El te se sirve a las primeras 20 personas.',
    descripcionCorta: 'Entrada libre a la sesión de este viernes con té incluido para quien llegue pronto.',
    descuentoTexto: 'Entrada libre',
    fechaCaducidadISO: '2026-04-12T19:00:00.000Z'
  }
];

export const promocionesMock = PROMOS_MOCK;
