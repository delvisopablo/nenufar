export type HorarioDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type HorarioLike = {
  apertura?: string | null;
  cierre?: string | null;
  intervalo?: number | null;
  diasAbre?: string[] | null;
  weekly?: Record<string, [string, string][]> | null;
  exceptions?: Record<string, [string, string][]> | null;
};

export type HorarioDayRangeMap = Record<HorarioDayKey, [string, string][]>;

export const HORARIO_DAY_ORDER: HorarioDayKey[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

export const HORARIO_DAY_LABELS: Record<HorarioDayKey, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

export const HORARIO_DAY_SHORT_LABELS: Record<HorarioDayKey, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom',
};

const DAY_KEY_BY_INPUT = new Map<string, HorarioDayKey>([
  ['mon', 'mon'],
  ['monday', 'mon'],
  ['lunes', 'mon'],
  ['lun', 'mon'],
  ['lu', 'mon'],
  ['tue', 'tue'],
  ['tuesday', 'tue'],
  ['martes', 'tue'],
  ['mar', 'tue'],
  ['ma', 'tue'],
  ['wed', 'wed'],
  ['wednesday', 'wed'],
  ['miercoles', 'wed'],
  ['miércoles', 'wed'],
  ['mie', 'wed'],
  ['mi', 'wed'],
  ['thu', 'thu'],
  ['thursday', 'thu'],
  ['jueves', 'thu'],
  ['jue', 'thu'],
  ['ju', 'thu'],
  ['fri', 'fri'],
  ['friday', 'fri'],
  ['viernes', 'fri'],
  ['vie', 'fri'],
  ['vi', 'fri'],
  ['sat', 'sat'],
  ['saturday', 'sat'],
  ['sabado', 'sat'],
  ['sábado', 'sat'],
  ['sab', 'sat'],
  ['sa', 'sat'],
  ['sun', 'sun'],
  ['sunday', 'sun'],
  ['domingo', 'sun'],
  ['dom', 'sun'],
  ['do', 'sun'],
]);

function normalizeScheduleValue(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeRange(range: unknown): [string, string] | null {
  if (!Array.isArray(range) || range.length < 2) {
    return null;
  }

  const apertura = normalizeScheduleValue(range[0]);
  const cierre = normalizeScheduleValue(range[1]);

  return apertura && cierre ? [apertura, cierre] : null;
}

function normalizeDayKey(value: string | null | undefined): HorarioDayKey | null {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();

  return DAY_KEY_BY_INPUT.get(raw) ?? null;
}

function buildEmptyWeeklyMap(): HorarioDayRangeMap {
  return {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  };
}

export function hasHorarioConfigurado(horario: HorarioLike | null | undefined): boolean {
  if (!horario) {
    return false;
  }

  return HORARIO_DAY_ORDER.some((dayKey) =>
    normalizeHorarioWeekly(horario)[dayKey].some(([apertura, cierre]) =>
      Boolean(normalizeScheduleValue(apertura) && normalizeScheduleValue(cierre)),
    ),
  );
}

export function normalizeHorarioWeekly(
  horario: HorarioLike | null | undefined,
): HorarioDayRangeMap {
  const weekly = buildEmptyWeeklyMap();
  if (!horario) {
    return weekly;
  }

  if (horario.weekly && typeof horario.weekly === 'object') {
    HORARIO_DAY_ORDER.forEach((dayKey) => {
      const ranges = horario.weekly?.[dayKey];
      weekly[dayKey] = Array.isArray(ranges)
        ? ranges
            .map((range) => normalizeRange(range))
            .filter((range): range is [string, string] => Boolean(range))
        : [];
    });

    if (HORARIO_DAY_ORDER.some((dayKey) => weekly[dayKey].length > 0)) {
      return weekly;
    }
  }

  const apertura = normalizeScheduleValue(horario.apertura);
  const cierre = normalizeScheduleValue(horario.cierre);
  if (!apertura || !cierre) {
    return weekly;
  }

  const openDays = Array.isArray(horario.diasAbre)
    ? horario.diasAbre
        .map((day) => normalizeDayKey(day))
        .filter((day): day is HorarioDayKey => Boolean(day))
    : [];

  const targetDays = openDays.length ? openDays : HORARIO_DAY_ORDER;
  targetDays.forEach((dayKey) => {
    weekly[dayKey] = [[apertura, cierre]];
  });

  return weekly;
}

function formatRanges(ranges: [string, string][]): string {
  if (!ranges.length) {
    return 'Cerrado';
  }

  return ranges
    .map(([start, end]) => `${start} - ${end}`)
    .join(' · ');
}

function formatDaySpan(startIndex: number, endIndex: number): string {
  if (startIndex === endIndex) {
    return HORARIO_DAY_SHORT_LABELS[HORARIO_DAY_ORDER[startIndex]];
  }

  return `${HORARIO_DAY_SHORT_LABELS[HORARIO_DAY_ORDER[startIndex]]} - ${HORARIO_DAY_SHORT_LABELS[HORARIO_DAY_ORDER[endIndex]]}`;
}

export function getHorarioResumen(
  horario: HorarioLike | null | undefined,
  options: {
    intervaloReserva?: number | null;
    reservasActivas?: boolean | null;
  } = {},
): string[] {
  if (!hasHorarioConfigurado(horario)) {
    return [];
  }

  const weekly = normalizeHorarioWeekly(horario);
  const lines: string[] = [];
  let blockStart = 0;

  while (blockStart < HORARIO_DAY_ORDER.length) {
    const baseDayKey = HORARIO_DAY_ORDER[blockStart];
    const baseRanges = weekly[baseDayKey];
    const baseSignature = JSON.stringify(baseRanges);
    let blockEnd = blockStart;

    while (blockEnd + 1 < HORARIO_DAY_ORDER.length) {
      const nextSignature = JSON.stringify(weekly[HORARIO_DAY_ORDER[blockEnd + 1]]);
      if (nextSignature !== baseSignature) {
        break;
      }

      blockEnd += 1;
    }

    lines.push(`${formatDaySpan(blockStart, blockEnd)} · ${formatRanges(baseRanges)}`);
    blockStart = blockEnd + 1;
  }

  const interval = Number(options.intervaloReserva ?? horario?.intervalo ?? 0);
  if (options.reservasActivas === true && Number.isFinite(interval) && interval > 0) {
    lines.push(`Reservas cada ${interval} min`);
  }

  return lines;
}

export function buildHorarioSummaryLines(
  horario: HorarioLike | null | undefined,
  intervaloReserva?: number | null,
  reservasActivas?: boolean | null,
): string[] {
  return getHorarioResumen(horario, { intervaloReserva, reservasActivas });
}
