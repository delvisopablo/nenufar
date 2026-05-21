import {
  HorarioLike,
  getHorarioResumen,
  hasHorarioConfigurado,
} from './negocio-horario';

describe('negocio horario helpers', () => {
  it('detects empty or incomplete horarios as not configured', () => {
    expect(hasHorarioConfigurado(null)).toBeFalse();
    expect(hasHorarioConfigurado(undefined)).toBeFalse();
    expect(hasHorarioConfigurado({})).toBeFalse();
    expect(
      hasHorarioConfigurado({
        weekly: {
          mon: [['10:00', '']],
          tue: [],
          wed: [],
          thu: [],
          fri: [],
          sat: [],
          sun: [],
        },
      }),
    ).toBeFalse();
  });

  it('groups stable weekly schedules into compact lines', () => {
    const horario: HorarioLike = {
      weekly: {
        mon: [['10:00', '20:00']],
        tue: [['10:00', '20:00']],
        wed: [['10:00', '20:00']],
        thu: [['10:00', '20:00']],
        fri: [['10:00', '20:00']],
        sat: [['10:00', '14:00']],
        sun: [],
      },
    };

    expect(
      getHorarioResumen(horario, {
        intervaloReserva: 30,
        reservasActivas: true,
      }),
    ).toEqual([
      'Lun - Vie · 10:00 - 20:00',
      'Sáb · 10:00 - 14:00',
      'Dom · Cerrado',
      'Reservas cada 30 min',
    ]);
  });

  it('does not append reservation cadence when reservations are inactive', () => {
    expect(
      getHorarioResumen(
        {
          weekly: {
            mon: [['10:00', '20:00']],
            tue: [],
            wed: [],
            thu: [],
            fri: [],
            sat: [],
            sun: [],
          },
          intervalo: 30,
        },
        { reservasActivas: false },
      ),
    ).not.toContain('Reservas cada 30 min');
  });
});
