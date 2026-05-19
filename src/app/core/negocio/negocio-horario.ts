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
  mon: 'Lu',
  tue: 'Ma',
  wed: 'Mi',
  thu: 'Ju',
  fri: 'Vi',
  sat: 'Sa',
  sun: 'Do',
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

function normalizeScheduleValue(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
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

  if (normalizeScheduleValue(horario.apertura) && normalizeScheduleValue(horario.cierre)) {
    return true;
  }

  return Object.values(horario.weekly ?? {}).some(
    (ranges) => Array.isArray(ranges) && ranges.length > 0,
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
            .filter((range): range is [string, string] => Array.isArray(range) && range.length >= 2)
            .map((range) => [String(range[0]), String(range[1])])
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
    return HORARIO_DAY_LABELS[HORARIO_DAY_ORDER[startIndex]];
  }

  return `${HORARIO_DAY_LABELS[HORARIO_DAY_ORDER[startIndex]]} a ${HORARIO_DAY_LABELS[HORARIO_DAY_ORDER[endIndex]]}`;
}

export function buildHorarioSummaryLines(
  horario: HorarioLike | null | undefined,
  intervaloReserva?: number | null,
): string[] {
  if (!horario) {
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

  const interval = Number(intervaloReserva ?? horario.intervalo ?? 0);
  if (Number.isFinite(interval) && interval > 0) {
    lines.push(`Reservas cada ${interval} min`);
  }

  return lines;
}
