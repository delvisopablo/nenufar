import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../../config/api.config';
import { getUserErrorMessage } from '../../../core/errors/error-parser';
import { SKIP_HTTP_ERROR_HANDLING } from '../../../core/errors/http-error.interceptor';
import { resolveBusinessImage } from '../../../core/negocio/negocio-visuals';

interface NegocioOption {
  id: number;
  nombre: string;
  foto?: string;
  fotoPerfil?: string;
  fotoPortada?: string;
  nenufarAsset?: string;
  nenufarKey?: string;
}

interface UsuarioActual {
  id: number;
}

interface CrearResenaPayload {
  contenido: string;
  puntuacion: number;
  selloNenufar: boolean;
  negocioId: number;
  usuarioId: number;
}

@Component({
  selector: 'app-crear-resena-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './crear-resena-modal.component.html',
  styleUrl: './crear-resena-modal.component.css'
})
export class CrearResenaModalComponent implements OnInit {
  private readonly silentRequestContext = new HttpContext().set(
    SKIP_HTTP_ERROR_HANDLING,
    true,
  );

  // @Output() cerrarModal = new EventEmitter<void>();
  @Output() resenaCreada = new EventEmitter<unknown>();
  @Input() visible = false;
  @Input() negocioId!: number;

  @Input() resenas: unknown[] = [];
  @Input() negocio: unknown;
  @Output() cerrarModal = new EventEmitter<void>();
  usuarioActual: UsuarioActual | null = this.obtenerUsuarioActual();

  textoResena: string = '';
  puntuacion: number = 0;

  form: FormGroup;
  negocios: NegocioOption[] = [];
   negocioIdSeleccionado: number | null = null;

  mostrarLista = signal(false);
  cargandoNegocios = signal(false);
  errorMensaje = signal('');
  enviando = signal(false);
  

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.form = this.fb.group({
      negocio: ['', Validators.required],
      comentario: ['', Validators.required],
      valoracion: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
      selloNenufar: [false]
    });
  }

  ngOnInit() {
    this.cargandoNegocios.set(true);
    this.http.get<ApiListResponse<NegocioOption>>(buildApiUrl('/negocios')).subscribe({
      next: (data) => {
        this.negocios = extractItems(data);
        this.cargandoNegocios.set(false);
        this.errorMensaje.set('');
      },
      error: (error: unknown) => {
        this.cargandoNegocios.set(false);
        this.errorMensaje.set(getUserErrorMessage(error, 'No hemos podido cargar los negocios.'));
      }
    });

   
  }

  getNegocioImage(negocio: NegocioOption): string {
    return resolveBusinessImage(negocio);
  }


seleccionarNegocio(negocio: NegocioOption) {
  this.form.get('negocio')?.setValue(negocio.nombre);
  this.negocioIdSeleccionado = negocio.id;
  this.mostrarLista.set(false);
}

  // seleccionarEstrellas(valor: number) {
  //   this.estrellas.set(valor);
  // }

  // toggleSello() {
  //   this.selloNenufar.update((v) => !v);
  // }

 

cerrar() {
  this.visible = false;
  this.cerrarModal.emit();
}


  ocultarListaConRetraso() {
  setTimeout(() => this.mostrarLista.set(false), 200);
}

 toggleSello() {
    const actual = this.form.controls['selloNenufar'].value;
    this.form.controls['selloNenufar'].setValue(!actual);
  }



 enviar() {
    this.errorMensaje.set('');

    if (this.enviando()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.negocioIdSeleccionado) {
      this.errorMensaje.set('Selecciona un negocio de la lista.');
      return;
    }

    if (!this.usuarioActual?.id) {
      this.errorMensaje.set('Inicia sesión para publicar una reseña.');
      return;
    }

    if (this.form.valid && this.negocioIdSeleccionado && this.usuarioActual?.id) {
      const reseña: CrearResenaPayload = {
        contenido: this.form.value.comentario,
        puntuacion: this.form.value.valoracion,
        selloNenufar: this.form.value.selloNenufar,
        negocioId: this.negocioIdSeleccionado,
        usuarioId: this.usuarioActual.id
      };

      this.enviando.set(true);

      this.http.post(buildApiUrl('/resena'), reseña, {
        context: this.silentRequestContext,
      }).pipe(
        finalize(() => this.enviando.set(false)),
      ).subscribe({
        next: (res) => {
          alert('Genial!! Tu reseña se ha guardado.')
          this.resenaCreada.emit(res);
          this.form.reset({ valoracion: 0, selloNenufar: false });
          this.negocioIdSeleccionado = null;
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.errorMensaje.set(
              getUserErrorMessage(
                error,
                'Ya has dejado una reseña para este negocio.',
              ) || 'Ya has dejado una reseña para este negocio.',
            );
            return;
          }

          this.errorMensaje.set(
            getUserErrorMessage(error, 'No hemos podido guardar la reseña.')
          );
        }
      });
    }
  }

  private obtenerUsuarioActual(): UsuarioActual | null {
    const raw = localStorage.getItem('usuarioLogueado');

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<UsuarioActual>;
      return typeof parsed.id === 'number' ? { id: parsed.id } : null;
    } catch {
      return null;
    }
  }
}
