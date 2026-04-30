import { Component, OnInit, ViewChild, inject } from '@angular/core';
import {
  FormBuilder, FormGroup, Validators, ReactiveFormsModule,
  FormArray, FormControl
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import {
  DEFAULT_NENUFAR_ASSET,
  resolveNenufarAsset,
  resolveNenufarKey,
} from '../../core/negocio/negocio-visuals';
import { NegocioService } from '../../servicios/negocioService/negocio.service';
import {
  NenufarSelectorComponent,
} from '../../components/shared/nenufar-selector/nenufar-selector.component';

interface NegocioDetalle {
  id?: number;
  nombre?: string;
  nickname?: string | null;
  slug?: string | null;
  direccion?: string;
  historia?: string;
  nenufarAsset?: string | null;
  nenufarKey?: string | null;
  aceptaReservas?: boolean;
  intervaloReserva?: number;
  dueno?: {
    nickname?: string;
  };
  categoria?: {
    nombre?: string;
  };
  horario?: {
    apertura?: string;
    cierre?: string;
    intervalo?: number;
    diasAbre?: string[];
    weekly?: Record<string, [string, string][]>;
  };
}

@Component({
  selector: 'app-editar-negocio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NenufarSelectorComponent],
  templateUrl: './editar-negocio.component.html',
  styleUrl: './editar-negocio.component.css'
})
export class EditarNegocioComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private negocioService = inject(NegocioService);
  @ViewChild(NenufarSelectorComponent)
  private readonly nenufarSelector?: NenufarSelectorComponent;

  negocioForm!: FormGroup;
  negocioId!: number;
  negocioRouteKey = '';
  diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  matrizHoraria: { hora: string, ocupado: boolean }[][] = [];
  cargando = true;
  guardando = false;
  errorMensaje = '';

  ngOnInit(): void {
    const routeParam = this.negocioService.normalizeRouteParam(
      this.route.snapshot.paramMap.get('nickname') ??
      this.route.snapshot.paramMap.get('slug'),
    );

    this.negocioForm = this.fb.group({
      nombre: ['', Validators.required],
      nickname: ['', Validators.required],
      direccion: [''],
      historia: [''],
      nenufarAsset: [DEFAULT_NENUFAR_ASSET, Validators.required],
      categoria: [''],
      aceptaReservas: [false],
      horario: this.fb.group({
        apertura: [''],
        cierre: [''],
        intervalo: [30],
        diasAbre: this.fb.array([]) // String[]
      })
    });

    // Regenerar slots si cambia algo
    this.negocioForm.get('horario.apertura')?.valueChanges.subscribe(() => this.generarMatrizHoraria());
    this.negocioForm.get('horario.cierre')?.valueChanges.subscribe(() => this.generarMatrizHoraria());
    this.negocioForm.get('horario.intervalo')?.valueChanges.subscribe(() => this.generarMatrizHoraria());

    if (!routeParam) {
      this.cargando = false;
      this.errorMensaje = 'No hemos podido identificar el negocio que quieres editar.';
      return;
    }

    this.negocioService.resolveNegocioFromRouteParam(routeParam).subscribe({
      next: (negocio) => {
        if (!negocio) {
          this.cargando = false;
          this.errorMensaje = 'No hemos podido resolver el negocio que quieres editar.';
          return;
        }

        this.negocioId = negocio.id;
        this.negocioRouteKey = this.negocioService.getRouteKey(negocio) ?? routeParam;
        this.cargarDatos();
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.errorMensaje = getUserErrorMessage(error, 'No hemos podido resolver el negocio que quieres editar.');
      },
    });
  }

  get diasAbre(): FormArray {
    return this.negocioForm.get('horario.diasAbre') as FormArray;
  }

  toggleDia(dia: string) {
    const index = this.diasAbre.controls.findIndex(c => c.value === dia);
    if (index === -1) {
      this.diasAbre.push(new FormControl(dia));
    } else {
      this.diasAbre.removeAt(index);
    }
    this.generarMatrizHoraria();
  }

  cargarDatos() {
    this.errorMensaje = '';
    this.cargando = true;

    forkJoin({
      negocio: this.negocioService.getNegocioById(this.negocioId).pipe(
        map((negocio) => negocio as NegocioDetalle),
      ),
      horario: this.negocioService.getHorario(this.negocioId).pipe(
        catchError(() => of(null)),
      ),
    }).subscribe({
      next: ({ negocio, horario }) => {
        const horarioActual = horario ?? negocio.horario ?? null;
        const rangoBase = this.resolveHorarioBase(horarioActual);

        this.diasAbre.clear();
        this.negocioForm.patchValue({
          nombre: negocio.nombre,
          nickname: negocio.nickname || negocio.dueno?.nickname || '',
          direccion: negocio.direccion,
          historia: negocio.historia,
          nenufarAsset:
            negocio.nenufarAsset ??
            resolveNenufarAsset(negocio.nenufarKey) ??
            DEFAULT_NENUFAR_ASSET,
          categoria: negocio.categoria?.nombre || '',
          aceptaReservas: negocio.aceptaReservas || false,
          horario: {
            apertura: rangoBase.apertura,
            cierre: rangoBase.cierre,
            intervalo:
              Number(
                negocio.intervaloReserva ??
                horarioActual?.intervalo ??
                30,
              ) || 30,
          }
        });

        if (Array.isArray(horarioActual?.diasAbre)) {
          horarioActual.diasAbre.forEach((dia: string) => {
            this.diasAbre.push(new FormControl(dia));
          });
        }

        this.generarMatrizHoraria();
        this.cargando = false;
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.errorMensaje = getUserErrorMessage(error, 'No hemos podido cargar el negocio.');
      }
    });
  }

  generarMatrizHoraria() {
    const apertura = this.negocioForm.get('horario.apertura')?.value;
    const cierre = this.negocioForm.get('horario.cierre')?.value;
    const intervalo = +this.negocioForm.get('horario.intervalo')?.value || 30;

    if (!apertura || !cierre) {
      this.matrizHoraria = [];
      return;
    }

    const [hStart, mStart] = apertura.split(':').map(Number);
    const [hEnd, mEnd] = cierre.split(':').map(Number);
    const start = hStart * 60 + mStart;
    const end = hEnd * 60 + mEnd;

    this.matrizHoraria = this.diasSemana.map(() => {
      const slots: { hora: string, ocupado: boolean }[] = [];
      for (let t = start; t < end; t += intervalo) {
        const h = Math.floor(t / 60).toString().padStart(2, '0');
        const m = (t % 60).toString().padStart(2, '0');
        slots.push({ hora: `${h}:${m}`, ocupado: false });
      }
      return slots;
    });
  }

  reservar(hora: string) {
    const ok = confirm(`¿Reservar a las ${hora}?`);
    if (!ok) return;
    alert(`✅ ¡Reserva confirmada a las ${hora}!`);
  }

  guardarCambios() {
    this.errorMensaje = '';

    if (this.negocioForm.invalid) {
      this.negocioForm.markAllAsTouched();
      return;
    }

    const datos = this.negocioForm.getRawValue();
    const nenufarAsset =
      resolveNenufarAsset(datos.nenufarAsset) ?? DEFAULT_NENUFAR_ASSET;
    const nenufarKey = resolveNenufarKey(nenufarAsset);
    const negocioPayload = {
      nombre: datos.nombre,
      direccion: datos.direccion,
      historia: datos.historia,
      aceptaReservas: Boolean(datos.aceptaReservas),
      nenufarAsset,
      ...(nenufarKey ? { nenufarKey } : {}),
    };
    const horarioPayload = this.buildHorarioPayload(datos);

    this.guardando = true;

    forkJoin({
      negocioActualizado: this.negocioService.update(this.negocioId, negocioPayload),
      horarioActualizado: this.negocioService.configHorario(this.negocioId, horarioPayload).pipe(
        catchError((error: unknown) => {
          if ((error as { status?: number })?.status === 404) {
            return this.negocioService.update(this.negocioId, {
              horario: horarioPayload.horario,
              intervaloReserva: horarioPayload.intervaloReserva,
            });
          }

          throw error;
        }),
      ),
    })
      .pipe(
        switchMap(() =>
          this.negocioService.getNegocioById(this.negocioId).pipe(
            map((negocio) => negocio as NegocioDetalle),
          ),
        ),
      )
      .subscribe({
        next: (negocioActualizado) => {
          const routeKey =
            this.negocioService.getRouteKey(negocioActualizado) ?? this.negocioRouteKey;

          this.guardando = false;
          this.sincronizarNegocioEnSesion(negocioActualizado);
          this.nenufarSelector?.markAsSaved(
            negocioActualizado.nenufarAsset ?? DEFAULT_NENUFAR_ASSET,
          );
          void this.router.navigate(['/', routeKey]);
        },
        error: (error: unknown) => {
          this.guardando = false;
          this.errorMensaje = getUserErrorMessage(error, 'No hemos podido actualizar el negocio.');
        }
      });
  }

  private resolveHorarioBase(
    horario: NegocioDetalle['horario'] | null | undefined,
  ): { apertura: string; cierre: string } {
    if (!horario) {
      return { apertura: '', cierre: '' };
    }

    if (horario.apertura && horario.cierre) {
      return {
        apertura: horario.apertura,
        cierre: horario.cierre,
      };
    }

    const ranges = horario.weekly && typeof horario.weekly === 'object'
      ? Object.values(horario.weekly).flat()
      : [];
    const firstRange = ranges.find(
      (range): range is [string, string] =>
        Array.isArray(range) && range.length >= 2,
    );

    return {
      apertura: firstRange?.[0] ?? '',
      cierre: firstRange?.[1] ?? '',
    };
  }

  private buildHorarioPayload(datos: ReturnType<FormGroup['getRawValue']>) {
    const apertura = String(datos.horario?.apertura ?? '').trim();
    const cierre = String(datos.horario?.cierre ?? '').trim();
    const intervalo = Number(datos.horario?.intervalo ?? 30) || 30;
    const diasAbre = Array.isArray(datos.horario?.diasAbre)
      ? datos.horario.diasAbre.filter((dia: unknown): dia is string => typeof dia === 'string')
      : [];

    return {
      intervaloReserva: intervalo,
      horario: Boolean(datos.aceptaReservas)
        ? { apertura, cierre, intervalo, diasAbre }
        : { apertura: '', cierre: '', intervalo, diasAbre: [] as string[] },
    };
  }

  private sincronizarNegocioEnSesion(negocioActualizado: NegocioDetalle): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const raw = localStorage.getItem('usuarioLogueado');
    if (!raw || raw === 'undefined' || raw === 'null') {
      return;
    }

    try {
      const usuario = JSON.parse(raw) as {
        negocio?: Record<string, unknown> & { id?: number };
      };

      if (usuario?.negocio?.id !== this.negocioId) {
        return;
      }

      usuario.negocio = {
        ...usuario.negocio,
        ...negocioActualizado,
      };

      localStorage.setItem('usuarioLogueado', JSON.stringify(usuario));
    } catch {
      localStorage.removeItem('usuarioLogueado');
    }
  }
}
