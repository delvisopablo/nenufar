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
import { catchError, forkJoin, switchMap } from 'rxjs';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import {
  HORARIO_DAY_LABELS,
  HORARIO_DAY_ORDER,
  HORARIO_DAY_SHORT_LABELS,
  HorarioDayKey,
  HorarioLike,
  buildHorarioSummaryLines,
  hasHorarioConfigurado,
  normalizeHorarioWeekly,
} from '../../core/negocio/negocio-horario';
import {
  ConfigHorarioPayload,
  NegocioService,
  NegocioSummary,
} from '../../servicios/negocioService/negocio.service';

type HorarioNegocioContexto = {
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

  readonly form = this.fb.group({
    aceptaReservas: this.fb.nonNullable.control(true),
    intervaloReserva: this.fb.nonNullable.control(30),
    plantillaApertura: this.fb.nonNullable.control('10:00'),
    plantillaCierre: this.fb.nonNullable.control('20:00'),
    dias: this.fb.array<FormGroup>([]),
  });

  readonly resumenHorario = computed(() => {
    const payload = this.buildHorarioPayload();
    return buildHorarioSummaryLines(
      payload.horario ?? null,
      Number(this.form.controls.intervaloReserva.value ?? 30) || 30,
    );
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
    this.guardando.set(true);

    const aceptaReservas = Boolean(this.form.controls.aceptaReservas.value);
    const intervaloReserva =
      Number(this.form.controls.intervaloReserva.value ?? 30) || 30;
    const horarioPayload = this.buildHorarioPayload();

    forkJoin({
      negocioActualizado: this.negocioService.update(this.negocioId, {
        aceptaReservas,
        intervaloReserva,
      }),
      horarioActualizado: this.negocioService.configHorario(this.negocioId, horarioPayload).pipe(
        catchError((error: unknown) => {
          if ((error as { status?: number })?.status === 404) {
            return this.negocioService.update(this.negocioId, {
              horario: horarioPayload.horario,
              intervaloReserva,
            });
          }

          throw error;
        }),
      ),
    })
      .pipe(switchMap(() => this.negocioService.getNegocioById(this.negocioId)))
      .subscribe({
        next: (negocioActualizado) => {
          this.guardando.set(false);
          this.exitoMensaje.set('Horario guardado correctamente.');
          this.patchFromBusiness(negocioActualizado);
          this.guardado.emit(negocioActualizado);
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          this.errorMensaje.set(
            getUserErrorMessage(error, 'No hemos podido guardar el horario.'),
          );
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
  }

  private patchFromBusiness(source: HorarioNegocioContexto | null): void {
    this.ensureDays();

    const weekly = normalizeHorarioWeekly(source?.horario ?? null);
    const aceptaReservas =
      typeof source?.aceptaReservas === 'boolean'
        ? source.aceptaReservas
        : hasHorarioConfigurado(source?.horario ?? null);
    const intervaloReserva =
      Number(source?.intervaloReserva ?? source?.horario?.intervalo ?? 30) || 30;

    this.form.patchValue(
      {
        aceptaReservas,
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
      horario: {
        intervalo: interval,
        apertura: firstRange?.[0] ?? '',
        cierre: firstRange?.[1] ?? '',
        diasAbre,
        weekly,
      },
    };
  }
}
