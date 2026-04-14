export type ResenaMock = {
  autorNombre: string;
  contenido: string;
  contenidoCorto: string;
  fechaISO: string;
  id: number;
  lanzable: boolean;
  negocioId: number;
  negocioNombre: string;
  puntuacion: number;
  selloNenufar: boolean;
};

export const RESENAS_MOCK: ResenaMock[] = [
  {
    id: 1,
    negocioId: 1,
    negocioNombre: 'Bar del Extremo',
    autorNombre: 'Lucía García',
    puntuacion: 5,
    contenido:
      'Las croquetas llegaron crujientes, la barra iba rapidisima y todo el equipo tenia muy buen ritmo incluso con el local lleno. Es de esos sitios donde apetece quedarse un rato mas de lo previsto.',
    contenidoCorto: 'Las croquetas llegaron crujientes, el sitio estaba vivo y el equipo fue rapidísimo.',
    selloNenufar: true,
    fechaISO: '2026-04-01T19:15:00.000Z',
    lanzable: true
  },
  {
    id: 2,
    negocioId: 3,
    negocioNombre: 'El Café Olvidado',
    autorNombre: 'Diego Navarro',
    puntuacion: 4,
    contenido:
      'Buen cafe, enchufes a mano y una barra larga perfecta para trabajar una hora sin prisa. El espacio se siente calmado y el servicio acompana sin agobiar.',
    contenidoCorto: 'Buen café, ambiente tranquilo y una barra perfecta para ir con portátil una hora.',
    selloNenufar: false,
    fechaISO: '2026-04-03T08:42:00.000Z',
    lanzable: false
  },
  {
    id: 3,
    negocioId: 2,
    negocioNombre: 'La Frutería Psicológica',
    autorNombre: 'María Fernández',
    puntuacion: 5,
    contenido:
      'Se nota muchisimo carino en el producto y en como te explican cada recomendacion. Entre con una compra pequena y sali con la sensacion de haber descubierto un sitio de confianza.',
    contenidoCorto: 'Se nota muchísimo cariño en el producto y en cómo te recomiendan cada cosa.',
    selloNenufar: true,
    fechaISO: '2026-04-04T12:06:00.000Z',
    lanzable: true
  },
  {
    id: 4,
    negocioId: 4,
    negocioNombre: 'Mercado Temporal',
    autorNombre: 'Hugo Pérez',
    puntuacion: 3,
    contenido:
      'Buen sitio para picar algo rapido si te pilla de camino. A media tarde se llena bastante y cuesta encontrar hueco, pero la oferta resuelve bien una parada corta.',
    contenidoCorto: 'Buen sitio para pasar a picar algo rápido, aunque a media tarde se pone bastante lleno.',
    selloNenufar: false,
    fechaISO: '2026-04-05T17:22:00.000Z',
    lanzable: false
  },
  {
    id: 5,
    negocioId: 5,
    negocioNombre: 'Biblioteca Subterránea',
    autorNombre: 'Irene Ramos',
    puntuacion: 2,
    contenido:
      'Muy comoda para quedarse leyendo y desconectar del ruido, aunque la ultima vez eche en falta algo mas de movimiento y mejor luz en la zona del fondo.',
    contenidoCorto: 'Muy cómoda para quedarse leyendo, aunque la última vez faltaba algo más de movimiento.',
    selloNenufar: false,
    fechaISO: '2026-04-06T10:18:00.000Z',
    lanzable: true
  },
  {
    id: 6,
    negocioId: 1,
    negocioNombre: 'Bar del Extremo',
    autorNombre: 'Sergio León',
    puntuacion: 4,
    contenido:
      'Las tapas van rapidas, la musica acompana y el local tiene energia sin volverse agobiante. Ideal para arrancar la noche sin cerrar plan todavia.',
    contenidoCorto: 'Las tapas van rápidas y el local tiene energía, ideal para arrancar la noche sin plan cerrado.',
    selloNenufar: true,
    fechaISO: '2026-04-08T21:04:00.000Z',
    lanzable: false
  },
  {
    id: 7,
    negocioId: 6,
    negocioNombre: 'Panadería Acústica',
    autorNombre: 'Paula Torres',
    puntuacion: 5,
    contenido:
      'Entre por casualidad y sali con media barra, bollos y ganas de volver el domingo. Huele increible y el personal te recomienda sin empujarte a comprar de mas.',
    contenidoCorto: 'Entré por casualidad y salí con media barra, bollos y ganas de volver el domingo.',
    selloNenufar: true,
    fechaISO: '2026-04-09T08:20:00.000Z',
    lanzable: true
  },
  {
    id: 8,
    negocioId: 7,
    negocioNombre: 'Museo de Sillas',
    autorNombre: 'Carlos Rodríguez',
    puntuacion: 1,
    contenido:
      'Curioso por raro, pero le vendria bien una vuelta al recorrido y a la iluminacion. Tiene potencial, aunque ahora mismo se queda un poco a medias para repetir pronto.',
    contenidoCorto: 'Curioso por raro, aunque le vendría bien una vuelta al recorrido y a la iluminación.',
    selloNenufar: false,
    fechaISO: '2026-04-10T16:05:00.000Z',
    lanzable: true
  }
];

export const resenasMock = RESENAS_MOCK;
