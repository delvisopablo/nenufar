import {
  resolveNegocioRouteCommands,
  resolveNegocioRouteKey,
} from './negocio.service';

describe('negocio route helpers', () => {
  it('prioritizes the negocio slug over any other identifier', () => {
    expect(
      resolveNegocioRouteKey({
        id: 18,
        slug: 'casa-verde',
        nickname: 'casa-verde-owner',
        nombre: 'Casa Verde',
      }),
    ).toBe('casa-verde');
  });

  it('does not build a public route from the negocio name', () => {
    expect(
      resolveNegocioRouteKey({
        id: 24,
        nombre: 'Cafe con Patio',
      }),
    ).toBeNull();
  });

  it('falls back to the negocio id route when there is no slug or nickname', () => {
    expect(
      resolveNegocioRouteCommands({
        id: 24,
        nombre: 'Cafe con Patio',
      }),
    ).toEqual(['/negocio', 24]);
  });
});
