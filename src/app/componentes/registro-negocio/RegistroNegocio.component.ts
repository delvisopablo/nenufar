import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import { buildApiUrl } from '../../config/api.config';
import { hasHorarioConfigurado } from '../../core/negocio/negocio-horario';
import {
  AuthResponse,
  AuthService,
  AuthUser,
  RegisterPayload,
} from '../../servicios/authService/auth.service';
import { savePendingEmailVerification } from '../../servicios/authService/email-verification.storage';
import {
  ConfigHorarioPayload,
  NegocioService,
} from '../../servicios/negocioService/negocio.service';
import {
  Categoria,
  CategoriaServiceService,
  Subcategoria,
} from '../../servicios/categoriaServicio/categoriaService.service';
import {
  NenufarSelectorComponent,
} from '../../components/shared/nenufar-selector/nenufar-selector.component';
import {
  NENUFAR_OPTIONS,
  resolveNenufarAsset,
} from '../../core/negocio/negocio-visuals';
import { EstanqueBackgroundComponent } from '../shared/estanque-background/estanque-background.component';

type CodigoEstado = 'idle' | 'comprobando' | 'valido' | 'invalido';

@Component({
  selector: 'app-registro-negocio',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    EstanqueBackgroundComponent,
    NenufarSelectorComponent,
  ],
  templateUrl: './RegistroNegocio.component.html',
  styleUrls: ['./RegistroNegocio.component.css']
})
export class RegistroNegocioComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly negocioService = inject(NegocioService);
  private readonly http = inject(HttpClient);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly categoriaService = inject(CategoriaServiceService);

  private readonly codigoInput$ = new Subject<string>();

  readonly categorias = signal<Categoria[]>([]);
  readonly cargandoCategorias = signal(true);
  readonly categoriasError = signal('');
  readonly categoriaSeleccionadaId = signal<number | null>(null);

  readonly subcategorias = signal<Subcategoria[]>([]);
  readonly cargandoSubcategorias = signal(false);
  readonly subcategoriasError = signal('');

  readonly nenufarOptions = NENUFAR_OPTIONS;
  readonly mostrarSelectorNenufar = signal(false);
  readonly mostrarCodigoNenufarizacion = signal(false);
  readonly codigoEstado = signal<CodigoEstado>('idle');
  readonly registrando = signal(false);
  readonly errorMensaje = signal('');

  readonly tieneHorario = signal<boolean | null>(null);
  readonly horarioLV = signal({ apertura: '10:00', cierre: '20:00' });
  readonly horarioSabado = signal({ abierto: false, apertura: '10:00', cierre: '14:00' });
  readonly horarioDomingo = signal({ abierto: false, apertura: '10:00', cierre: '14:00' });
  readonly intervaloReservaValue = signal(30);
  readonly intervalosReserva = [
    { value: 15, label: '15 min' },
    { value: 20, label: '20 min' },
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '1 hora' },
  ];

  readonly negocioForm = this.fb.group(
    {
      nombreDueno: ['', [Validators.required, Validators.minLength(2)]],
      nickname: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmarContrasena: ['', [Validators.required]],
      nombreNegocio: ['', [Validators.required, Validators.minLength(2)]],
      categoriaId: [null as number | null, [Validators.required]],
      subcategoriaId: [null as number | null],
      fechaFundacion: [''],
      nenufarActivo: [null as string | null],
      codigoNenufarizacion: [''],
      direccion: [''],
      historia: ['', [Validators.maxLength(320)]],
      descripcionCorta: ['', [Validators.maxLength(160)]],
    },
    { validators: this.passwordMatchValidator }
  );

  ngOnInit(): void {
    this.title.setTitle('Registra tu negocio');
    this.configurarCambioCategoria();
    this.cargarCategorias();
    this.configurarValidacionCodigo();
  }

  registrar(): void {
    this.errorMensaje.set('');

    if (this.negocioForm.invalid) {
      this.negocioForm.markAllAsTouched();
      return;
    }

    const datos = this.negocioForm.getRawValue();
    const categoriaId = this.normalizarNumeroPositivo(datos.categoriaId);
    const subcategoriaId = this.normalizarNumeroPositivo(datos.subcategoriaId);
    const fechaFundacion = this.normalizarFechaFundacion(datos.fechaFundacion);
    const codigoNenufarizacion = this.normalizarTextoOpcional(datos.codigoNenufarizacion)?.toUpperCase();
    const direccion = this.normalizarTextoOpcional(datos.direccion);
    const historia = this.normalizarTextoOpcional(datos.historia);
    const nenufarActivo = this.normalizarTextoOpcional(datos.nenufarActivo);
    const descripcionCorta = this.normalizarTextoOpcional(datos['descripcionCorta'] as string | null);
    const horario = this.buildHorarioJson();

    if (!categoriaId) {
      this.negocioForm.get('categoriaId')?.markAsTouched();
      this.errorMensaje.set('Selecciona una categoría válida.');
      return;
    }

    if (codigoNenufarizacion && this.codigoEstado() === 'comprobando') {
      this.mostrarCodigoNenufarizacion.set(true);
      this.errorMensaje.set('Estamos comprobando tu código de nenufarización. Espera un instante.');
      return;
    }

    if (codigoNenufarizacion && this.codigoEstado() === 'invalido') {
      this.mostrarCodigoNenufarizacion.set(true);
      this.errorMensaje.set('Ese código de nenufarización no es válido. Corrígelo o elimínalo para continuar.');
      return;
    }

    const payload: RegisterPayload = {
      nombreDueno: datos.nombreDueno?.trim() ?? '',
      nickname: datos.nickname?.trim() ?? '',
      email: datos.email?.trim().toLowerCase() ?? '',
      password: datos.password ?? '',
      nombreNegocio: datos.nombreNegocio?.trim() ?? '',
      categoriaId,
      ...(subcategoriaId ? { subcategoriaId } : {}),
      ...(direccion ? { direccion } : {}),
      ...(fechaFundacion ? { fechaFundacion } : {}),
      ...(historia ? { historia } : {}),
      ...(descripcionCorta ? { descripcionCorta } : {}),
      ...(codigoNenufarizacion ? { codigoNenufarizacion } : {}),
      nenufarActivo,
      ...(horario
        ? {
            horario,
            intervaloReserva: this.intervaloReservaValue(),
            reservasActivas: true,
          }
        : {}),
    };

    this.registrando.set(true);

    this.auth.registerNegocio(payload).subscribe({
      next: (response: AuthResponse) => {
        if (response.requiresEmailVerification === true) {
          this.guardarVerificacionPendiente(response, payload.email);
          this.registrando.set(false);
          void this.router.navigate(['/confirmar-email']);
          return;
        }

        localStorage.setItem('accesoPermitido', 'true');
        localStorage.removeItem('guestMode');
        this.sincronizarSesionTrasRegistro(response, payload);
      },
      error: (error: unknown) => {
        this.registrando.set(false);
        this.errorMensaje.set(this.extraerMensajeError(error));
      }
    });
  }

  onNenufarChange(value: string | null): void {
    this.negocioForm.get('nenufarActivo')?.setValue(value);
  }

  toggleSelectorNenufar(): void {
    this.mostrarSelectorNenufar.update((open) => !open);
  }

  onCodigoInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.codigoInput$.next(value);
  }

  toggleCodigoNenufarizacion(): void {
    const siguienteEstado = !this.mostrarCodigoNenufarizacion();
    this.mostrarCodigoNenufarizacion.set(siguienteEstado);

    if (!siguienteEstado && !this.normalizarTextoOpcional(this.negocioForm.get('codigoNenufarizacion')?.value)) {
      this.codigoEstado.set('idle');
    }
  }

  setTieneHorario(value: boolean): void {
    this.tieneHorario.set(value);
  }

  onLVApertura(event: Event): void {
    this.horarioLV.update(h => ({ ...h, apertura: (event.target as HTMLInputElement).value }));
  }

  onLVCierre(event: Event): void {
    this.horarioLV.update(h => ({ ...h, cierre: (event.target as HTMLInputElement).value }));
  }

  onSabadoToggle(event: Event): void {
    this.horarioSabado.update(h => ({ ...h, abierto: (event.target as HTMLInputElement).checked }));
  }

  onSabApertura(event: Event): void {
    this.horarioSabado.update(h => ({ ...h, apertura: (event.target as HTMLInputElement).value }));
  }

  onSabCierre(event: Event): void {
    this.horarioSabado.update(h => ({ ...h, cierre: (event.target as HTMLInputElement).value }));
  }

  onDomingoToggle(event: Event): void {
    this.horarioDomingo.update(h => ({ ...h, abierto: (event.target as HTMLInputElement).checked }));
  }

  onDomApertura(event: Event): void {
    this.horarioDomingo.update(h => ({ ...h, apertura: (event.target as HTMLInputElement).value }));
  }

  onDomCierre(event: Event): void {
    this.horarioDomingo.update(h => ({ ...h, cierre: (event.target as HTMLInputElement).value }));
  }

  onIntervaloChange(event: Event): void {
    this.intervaloReservaValue.set(Number((event.target as HTMLSelectElement).value));
  }

  volverAOpciones(): void {
    void this.router.navigate(['/registro-opciones']);
  }

  irAlEstanque(): void {
    void this.router.navigate(['/estanque']);
  }

  campoInvalido(nombreCampo: string): boolean {
    const control = this.negocioForm.get(nombreCampo);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  getErrorCampo(nombreCampo: string): string {
    const control = this.negocioForm.get(nombreCampo);

    if (!control || !(control.touched || control.dirty)) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }

    if (control.hasError('email')) {
      return 'Escribe un correo válido.';
    }

    if (control.hasError('minlength')) {
      const requiredLength = control.getError('minlength')?.requiredLength ?? 0;
      return `Necesitas al menos ${requiredLength} caracteres.`;
    }

    if (control.hasError('maxlength')) {
      return 'Intenta resumirlo un poco más.';
    }

    if (nombreCampo === 'confirmarContrasena' && this.negocioForm.hasError('passwordMismatch')) {
      return 'Las contraseñas no coinciden.';
    }

    return 'Revisa este campo.';
  }

  get nenufarSeleccionadoLabel(): string {
    const asset = resolveNenufarAsset(this.negocioForm.get('nenufarActivo')?.value, this.nenufarOptions);

    return (
      this.nenufarOptions.find((option) => option.asset === asset)?.label ?? ''
    );
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmacion = control.get('confirmarContrasena')?.value;

    if (!password || !confirmacion) {
      return null;
    }

    return password === confirmacion ? null : { passwordMismatch: true };
  }

  private configurarValidacionCodigo(): void {
    this.codigoInput$
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((codigo) => {
          if (!codigo) {
            this.codigoEstado.set('idle');
            return of(null);
          }
          this.codigoEstado.set('comprobando');
          return this.http
            .get<{ valido: boolean }>(
              buildApiUrl(`/codigos-nenufarizacion/validar?codigo=${encodeURIComponent(codigo)}`)
            )
            .pipe(
              switchMap((r) => of(r)),
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (response === null) return;
          this.codigoEstado.set(response.valido ? 'valido' : 'invalido');
        },
        error: () => {
          this.codigoEstado.set('invalido');
        }
      });
  }

  private configurarCambioCategoria(): void {
    const categoriaControl = this.negocioForm.get('categoriaId');

    if (!categoriaControl) {
      return;
    }

    categoriaControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const categoriaId = this.normalizarNumeroPositivo(value);

        this.categoriaSeleccionadaId.set(categoriaId);
        this.subcategorias.set([]);
        this.subcategoriasError.set('');
        this.negocioForm.get('subcategoriaId')?.setValue(null, { emitEvent: false });

        if (!categoriaId) {
          this.cargandoSubcategorias.set(false);
          return;
        }

        this.cargarSubcategorias(categoriaId);
      });
  }

  private cargarSubcategorias(categoriaId: number): void {
    this.cargandoSubcategorias.set(true);
    this.subcategoriasError.set('');

    this.categoriaService.listSubcategorias(categoriaId).subscribe({
      next: (data) => {
        this.subcategorias.set(data);
        this.cargandoSubcategorias.set(false);
      },
      error: (error: unknown) => {
        this.cargandoSubcategorias.set(false);
        this.subcategoriasError.set(
          getUserErrorMessage(error, 'Las subcategorías del registro no se cargaron.')
        );
      }
    });
  }

  private cargarCategorias(): void {
    this.categoriaService.list().subscribe({
      next: (categorias) => {
        this.categorias.set(categorias);
        this.cargandoCategorias.set(false);
      },
      error: (error: unknown) => {
        this.cargandoCategorias.set(false);
        this.categoriasError.set(
          getUserErrorMessage(error, 'Las categorías del registro no se cargaron.')
        );
      }
    });
  }

  private extraerMensajeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 409) {
        return 'Ese email o nickname ya pertenece a otra cuenta de negocio.';
      }
      if (error.status === 400) {
        return 'El alta del negocio tiene datos pendientes o inválidos.';
      }
      if (error.status === 401) {
        return 'La sesión del nuevo negocio no se inició. Vuelve a entrar con esa cuenta.';
      }
      if (error.status >= 500) {
        return 'El servidor no completó el alta del negocio. Repite el registro en unos minutos.';
      }
    }

    return getUserErrorMessage(
      error,
      'El negocio no se registró. Revisa los datos del alta.'
    );
  }

  private normalizarTextoOpcional(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private normalizarFechaFundacion(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return null;
    }

    return `${normalized}T00:00:00.000Z`;
  }

  private normalizarNumeroPositivo(value: unknown): number | null {
    const normalized = Number(value);

    if (!Number.isFinite(normalized) || normalized <= 0) {
      return null;
    }

    return normalized;
  }

  private buildHorarioJson(): ConfigHorarioPayload['horario'] | null {
    if (!this.tieneHorario()) {
      return null;
    }

    const lv = this.horarioLV();
    const sat = this.horarioSabado();
    const sun = this.horarioDomingo();
    const daySlot: [string, string][] = [[lv.apertura, lv.cierre]];

    return {
      weekly: {
        mon: daySlot,
        tue: daySlot,
        wed: daySlot,
        thu: daySlot,
        fri: daySlot,
        sat: sat.abierto ? [[sat.apertura, sat.cierre] as [string, string]] : [],
        sun: sun.abierto ? [[sun.apertura, sun.cierre] as [string, string]] : [],
      },
      exceptions: {}
    };
  }

  private sincronizarSesionTrasRegistro(
    response: AuthResponse,
    payload: RegisterPayload,
  ): void {
    const horarioPayload = this.getHorarioPayloadDesdeRegistro(payload);

    this.auth.me().subscribe({
      next: (usuario) => {
        const usuarioRespuesta = this.getUsuarioDesdeRespuesta(response);
        const usuarioActual =
          usuario ?? this.auth.obtenerUsuario() ?? usuarioRespuesta;
        const negocioId =
          this.resolveNegocioId(usuarioActual) ?? this.resolveNegocioId(usuarioRespuesta);
        const usuarioConNegocio =
          this.getNegocioDesdeUsuario(usuarioActual) ? usuarioActual : usuarioRespuesta;

        if (
          horarioPayload &&
          negocioId &&
          this.necesitaSincronizarHorario(usuarioConNegocio, horarioPayload)
        ) {
          this.guardarHorarioPostRegistro(negocioId, horarioPayload);
          return;
        }

        this.finalizarRegistroExitoso();
      },
      error: () => {
        const usuarioRespuesta = this.getUsuarioDesdeRespuesta(response);
        const negocioId = this.resolveNegocioId(usuarioRespuesta);

        if (horarioPayload && negocioId) {
          this.guardarHorarioPostRegistro(negocioId, horarioPayload);
          return;
        }

        this.finalizarRegistroExitoso();
      },
    });
  }

  private guardarHorarioPostRegistro(
    negocioId: number,
    horarioPayload: ConfigHorarioPayload,
  ): void {
    this.negocioService.guardarHorario(negocioId, horarioPayload).subscribe({
      next: () => {
        this.auth.me().subscribe({
          next: () => this.finalizarRegistroExitoso(),
          error: () => this.finalizarRegistroExitoso(),
        });
      },
      error: (error: unknown) => {
        this.registrando.set(false);
        this.errorMensaje.set(
          getUserErrorMessage(
            error,
            'Tu negocio se creó, pero el horario no se guardó. Abre tu perfil para completarlo.',
          ),
        );
      },
    });
  }

  private finalizarRegistroExitoso(): void {
    this.registrando.set(false);
    void this.router.navigate(['/inicio']);
  }

  private guardarVerificacionPendiente(
    response: AuthResponse,
    emailFormulario: unknown,
  ): void {
    const usuario = this.getUsuarioDesdeRespuesta(response);
    const emailReal =
      typeof usuario?.email === 'string' && usuario.email.trim()
        ? usuario.email.trim().toLowerCase()
        : typeof emailFormulario === 'string'
          ? emailFormulario.trim().toLowerCase()
          : '';

    savePendingEmailVerification({
      email: emailReal,
      maskedEmail: response.emailVerification?.email ?? emailReal,
      expiresInMinutes: response.emailVerification?.expiresInMinutes ?? null,
    });
  }

  private getHorarioPayloadDesdeRegistro(
    payload: RegisterPayload,
  ): ConfigHorarioPayload | null {
    if (!payload.horario || !hasHorarioConfigurado(payload.horario as ConfigHorarioPayload['horario'])) {
      return null;
    }

    return {
      horario: payload.horario as ConfigHorarioPayload['horario'],
      intervaloReserva: Number(payload.intervaloReserva ?? 30) || 30,
      reservasActivas: payload.reservasActivas ?? true,
    };
  }

  private necesitaSincronizarHorario(
    usuario: AuthUser | null,
    horarioPayload: ConfigHorarioPayload,
  ): boolean {
    const negocio = this.getNegocioDesdeUsuario(usuario);
    if (!negocio) {
      return true;
    }

    const intervaloActual = Number(negocio.intervaloReserva ?? 0) || null;

    return (
      !hasHorarioConfigurado(negocio.horario as ConfigHorarioPayload['horario']) ||
      intervaloActual !== horarioPayload.intervaloReserva ||
      negocio.reservasActivas !== true
    );
  }

  private getUsuarioDesdeRespuesta(response: AuthResponse): AuthUser | null {
    return response.usuario ?? response.user ?? response.data ?? null;
  }

  private getNegocioDesdeUsuario(usuario: AuthUser | null): AuthUser['negocio'] | null {
    return usuario?.negocio ?? usuario?.negocios?.[0] ?? null;
  }

  private resolveNegocioId(usuario: AuthUser | null): number | null {
    const id = Number(this.getNegocioDesdeUsuario(usuario)?.id ?? 0);
    return Number.isFinite(id) && id > 0 ? id : null;
  }
}
