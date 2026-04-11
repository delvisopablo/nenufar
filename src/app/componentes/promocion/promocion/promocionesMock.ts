export type PromoMock = {
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
    descripcionCorta: 'Pide una caña y la segunda cae al momento hasta agotar barril.',
    descuentoTexto: '2x1',
    fechaCaducidadISO: '2026-04-18T23:59:59.000Z'
  },
  {
    id: 2,
    negocioId: 3,
    negocioNombre: 'El Café Olvidado',
    titulo: 'Desayuno de barrio',
    descripcionCorta: 'Café de especialidad más tostada de masa madre a primera hora.',
    descuentoTexto: '-30%',
    fechaCaducidadISO: '2026-04-14T11:30:00.000Z'
  },
  {
    id: 3,
    negocioId: 4,
    negocioNombre: 'Mercado Temporal',
    titulo: 'Pack tarde improvisada',
    descripcionCorta: 'Llévate bebida fría y picoteo listo para salir directo al paseo.',
    descuentoTexto: 'Pack 6€',
    fechaCaducidadISO: '2026-04-20T20:00:00.000Z'
  },
  {
    id: 4,
    negocioId: 5,
    negocioNombre: 'Biblioteca Subterránea',
    titulo: 'Club de lectura abierto',
    descripcionCorta: 'Entrada libre a la sesión de este viernes con té incluido para quien llegue pronto.',
    descuentoTexto: 'Entrada libre',
    fechaCaducidadISO: '2026-04-12T19:00:00.000Z'
  }
];

export const promocionesMock = PROMOS_MOCK;
