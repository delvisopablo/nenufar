import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import {
  HORARIO_DAY_LABELS,
  HORARIO_DAY_ORDER,
  HORARIO_DAY_SHORT_LABELS,
  HorarioDayKey,
  HorarioLike,
  getHorarioResumen,
  hasHorarioConfigurado,
  normalizeHorarioWeekly,
} from '../../core/negocio/negocio-horario';
import {
  ConfigHorarioPayload,
  NegocioService,
  NegocioSummary,
} from '../../servicios/negocioService/negocio.service';
import { environment } from '../../../environments/environment';

type HorarioNegocioContexto = {
  reservasActivas?: boolean;
  aceptaReservas?: boolean;
  intervaloReserva?: number | null;
  horario?: HorarioLike | null;
};

type DayFormValue = {
  activa: boolean;
  apertura: string;
  cierre: string;
};

@Component({
  selector: 'app-horario-negocio-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './horario-negocio-modal.component.html',
  styleUrl: './horario-negocio-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HorarioNegocioModalComponent implements OnChanges {
  @Input() negocioId = 0;
  @Input() negocio: HorarioNegocioContexto | null = null;
  @Output() guardado = new EventEmitter<NegocioSummary>();

  private readonly fb = inject(FormBuilder);
  private readonly negocioService = inject(NegocioService);

  readonly intervalosReserva = [15, 20, 30, 45, 60, 90, 120];
  readonly dayOrder = HORARIO_DAY_ORDER;
  readonly dayLabels = HORARIO_DAY_LABELS;
  readonly dayShortLabels = HORARIO_DAY_SHORT_LABELS;

  readonly guardando = signal(false);
  readonly errorMensaje = signal('');
  readonly exitoMensaje = signal('');
  readonly dayErrors = signal<Record<number, string>>({});

  readonly form = this.fb.group({
    reservasActivas: this.fb.nonNullable.control(true),
    intervaloReserva: this.fb.nonNullable.control(30),
    plantillaApertura: this.fb.nonNullable.control('10:00'),
    plantillaCierre: this.fb.nonNullable.control('20:00'),
    dias: this.fb.array<FormGroup>([]),
  });

  readonly resumenHorario = computed(() => {
    const payload = this.buildHorarioPayload();
    return getHorarioResumen(payload.horario ?? null, {
      intervaloReserva: payload.intervaloReserva,
      reservasActivas: payload.reservasActivas,
    });
  });

  constructor() {
    this.ensureDays();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('negocio' in changes || 'negocioId' in changes) {
      this.patchFromContext();
    }
  }

  get diasFormArray(): FormArray<FormGroup> {
    return this.form.controls.dias;
  }

  toggleDay(dayIndex: number): void {
    const group = this.diasFormArray.at(dayIndex);
    if (!group) {
      return;
    }

    const nextActive = !Boolean(group.get('activa')?.value);
    group.patchValue({ activa: nextActive });
  }

  applyTemplateToWeekdays(): void {
    this.applyTemplateToDays(['mon', 'tue', 'wed', 'thu', 'fri']);
  }

  applyTemplateToWeekend(): void {
    this.applyTemplateToDays(['sat', 'sun']);
  }

  applyTemplateToAllDays(): void {
    this.applyTemplateToDays(this.dayOrder);
  }

  clearAllDays(): void {
    this.dayOrder.forEach((dayKey, index) => {
      this.patchDay(index, dayKey, false, '', '');
    });
    this.exitoMensaje.set('');
  }

  guardarHorario(): void {
    if (!this.negocioId || this.guardando()) {
      return;
    }

    this.errorMensaje.set('');
    this.exitoMensaje.set('');
    const validationError = this.validarHorario();
    if (validationError) {
      this.errorMensaje.set('Revisa el horario antes de guardar.');
      return;
    }

    this.guardando.set(true);

    const reservasActivas = Boolean(this.form.controls.reservasActivas.value);
    const intervaloReserva =
      Number(this.form.controls.intervaloReserva.value ?? 30) || 30;
    const horarioPayload: ConfigHorarioPayload = {
      ...this.buildHorarioPayload(),
      intervaloReserva,
      reservasActivas,
    };

    this.negocioService.guardarHorario(this.negocioId, horarioPayload).subscribe({
      next: (negocioActualizado) => {
        const negocioConHorario = {
          ...(this.negocio ?? {}),
          ...negocioActualizado,
          horario: negocioActualizado.horario ?? horarioPayload.horario,
          intervaloReserva: negocioActualizado.intervaloReserva ?? intervaloReserva,
          reservasActivas:
            negocioActualizado.reservasActivas ?? horarioPayload.reservasActivas,
          aceptaReservas:
            negocioActualizado.reservasActivas ?? horarioPayload.reservasActivas,
        };

        this.guardando.set(false);
        this.exitoMensaje.set('Horario guardado correctamente.');
        this.patchFromBusiness(negocioConHorario);
        this.guardado.emit(negocioConHorario as NegocioSummary);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.errorMensaje.set(
          getUserErrorMessage(error, 'El horario del negocio no se guardó.'),
        );

        if (!environment.production) {
          console.error('[horario-negocio] Error al guardar horario', error);
        }
      },
    });
  }

  private ensureDays(): void {
    if (this.diasFormArray.length) {
      return;
    }

    this.dayOrder.forEach(() => {
      this.diasFormArray.push(
        this.fb.group({
          activa: this.fb.nonNullable.control(false),
          apertura: this.fb.nonNullable.control('10:00'),
          cierre: this.fb.nonNullable.control('20:00'),
        }),
      );
    });
  }

  private patchFromContext(): void {
    this.patchFromBusiness(this.negocio ?? null);
    this.errorMensaje.set('');
    this.dayErrors.set({});
  }

  private patchFromBusiness(source: HorarioNegocioContexto | null): void {
    this.ensureDays();

    const weekly = normalizeHorarioWeekly(source?.horario ?? null);
    const reservasActivas =
      typeof source?.reservasActivas === 'boolean'
        ? source.reservasActivas
        : typeof source?.aceptaReservas === 'boolean'
          ? source.aceptaReservas
        : hasHorarioConfigurado(source?.horario ?? null);
    const intervaloReserva =
      Number(source?.intervaloReserva ?? source?.horario?.intervalo ?? 30) || 30;

    this.form.patchValue(
      {
        reservasActivas,
        intervaloReserva,
      },
      { emitEvent: false },
    );

    let plantillaApertura = '10:00';
    let plantillaCierre = '20:00';

    this.dayOrder.forEach((dayKey, index) => {
      const firstRange = weekly[dayKey]?.[0] ?? null;
      const apertura = firstRange?.[0] ?? '10:00';
      const cierre = firstRange?.[1] ?? '20:00';

      if (firstRange && plantillaApertura === '10:00' && plantillaCierre === '20:00') {
        plantillaApertura = apertura;
        plantillaCierre = cierre;
      }

      this.patchDay(index, dayKey, Boolean(firstRange), apertura, cierre);
    });

    this.form.patchValue(
      {
        plantillaApertura,
        plantillaCierre,
      },
      { emitEvent: false },
    );
  }

  private applyTemplateToDays(dayKeys: HorarioDayKey[]): void {
    const apertura = String(this.form.controls.plantillaApertura.value ?? '').trim() || '10:00';
    const cierre = String(this.form.controls.plantillaCierre.value ?? '').trim() || '20:00';

    dayKeys.forEach((dayKey) => {
      const dayIndex = this.dayOrder.indexOf(dayKey);
      this.patchDay(dayIndex, dayKey, true, apertura, cierre);
    });

    this.exitoMensaje.set('');
  }

  private patchDay(
    dayIndex: number,
    _dayKey: HorarioDayKey,
    activa: boolean,
    apertura: string,
    cierre: string,
  ): void {
    const group = this.diasFormArray.at(dayIndex);
    if (!group) {
      return;
    }

    group.patchValue(
      {
        activa,
        apertura,
        cierre,
      },
      { emitEvent: false },
    );
  }

  private buildHorarioPayload(): ConfigHorarioPayload {
    const interval = Number(this.form.controls.intervaloReserva.value ?? 30) || 30;
    const reservasActivas = Boolean(this.form.controls.reservasActivas.value);
    const weekly: Record<string, [string, string][]> = {};
    const diasAbre: string[] = [];

    this.dayOrder.forEach((dayKey, index) => {
      const group = this.diasFormArray.at(index);
      const value = (group?.getRawValue?.() ?? {}) as DayFormValue;
      const apertura = String(value.apertura ?? '').trim();
      const cierre = String(value.cierre ?? '').trim();
      const activa = Boolean(value.activa) && Boolean(apertura) && Boolean(cierre);

      weekly[dayKey] = activa ? [[apertura, cierre]] : [];
      if (activa) {
        diasAbre.push(this.dayLabels[dayKey]);
      }
    });

    const firstActiveDay = this.dayOrder.find((dayKey) => weekly[dayKey].length > 0) ?? null;
    const firstRange = firstActiveDay ? weekly[firstActiveDay][0] : null;

    return {
      intervaloReserva: interval,
      reservasActivas,
      horario: {
        intervalo: interval,
        apertura: firstRange?.[0] ?? '',
        cierre: firstRange?.[1] ?? '',
        diasAbre,
        weekly,
      },
    };
  }

  private validarHorario(): boolean {
    const errors: Record<number, string> = {};

    this.dayOrder.forEach((_dayKey, index) => {
      const group = this.diasFormArray.at(index);
      const value = (group?.getRawValue?.() ?? {}) as DayFormValue;
      if (!value.activa) {
        return;
      }

      const apertura = this.horaAMinutos(value.apertura);
      const cierre = this.horaAMinutos(value.cierre);

      if (apertura === null || cierre === null) {
        errors[index] = 'El horario introducido no es válido.';
        return;
      }

      if (cierre <= apertura) {
        errors[index] = 'La hora de cierre debe ser posterior a la de apertura.';
      }
    });

    const intervalo = Number(this.form.controls.intervaloReserva.value ?? 0);
    if (!Number.isFinite(intervalo) || intervalo <= 0) {
      this.form.controls.intervaloReserva.setErrors({
        ...(this.form.controls.intervaloReserva.errors ?? {}),
        api: 'El intervalo de reserva introducido no es válido.',
      });
    }

    this.dayErrors.set(errors);
    return Object.keys(errors).length > 0 || this.form.controls.intervaloReserva.invalid;
  }

  private horaAMinutos(value: string): number | null {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      return null;
    }

    const [hour, minute] = value.split(':').map(Number);
    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    return hour * 60 + minute;
  }
}
