import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../../config/api.config';
import { getUserErrorMessage } from '../../../core/errors/error-parser';

interface NegocioOption {
  id: number;
  nombre: string;
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
  

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.form = this.fb.group({
      negocio: ['', Validators.required],
      comentario: ['', Validators.required],
      valoracion: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
      selloNenufar: [false]
    });
  }

  ngOnInit() {
    // this.autenticarToken();
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


//  const resena = {
//   negocioId: this.negocioId,
//   usuarioId: this.usuarioActual.id,
//   texto: this.textoResena,
//   puntuacion: this.puntuacion
// };

 toggleSello() {
    const actual = this.form.controls['selloNenufar'].value;
    this.form.controls['selloNenufar'].setValue(!actual);
  }



 enviar() {
    this.errorMensaje.set('');

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

      this.http.post(buildApiUrl('/resena'), reseña).subscribe({
        next: (res) => {
          alert('Genial!! Tu reseña se ha guardado.')
          this.resenaCreada.emit(res);
          this.form.reset({ valoracion: 0, selloNenufar: false });
          this.negocioIdSeleccionado = null;
        },
        error: (error: unknown) => {
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
