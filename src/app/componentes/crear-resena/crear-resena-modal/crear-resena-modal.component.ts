import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../../config/api.config';

@Component({
  selector: 'app-crear-resena-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './crear-resena-modal.component.html',
  styleUrl: './crear-resena-modal.component.css'
})
export class CrearResenaModalComponent implements OnInit {
  // @Output() cerrarModal = new EventEmitter<void>();
  @Output() resenaCreada = new EventEmitter<any>();
  @Input() visible = false;
  @Input() negocioId!: number;

  @Input() resenas: any[] = [];
  @Input() negocio: any;
  @Output() cerrarModal = new EventEmitter<void>();
  usuarioActual: any = JSON.parse(localStorage.getItem('usuarioLogueado')!);

  textoResena: string = '';
  puntuacion: number = 0;

  form: FormGroup;
  negocios: { id: number; nombre: string }[] = [];
   negocioIdSeleccionado: number | null = null;

  mostrarLista = signal(false);
  

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
    this.http.get<ApiListResponse<any>>(buildApiUrl('/negocios')).subscribe({
      next: (data) => {
        this.negocios = extractItems(data);
        console.log('🟢 Negocios cargados:', data);

      },
      error: (err) => {
        console.error('❌ Error al cargar negocios:', err);
      }
    });

   
  }


seleccionarNegocio(negocio: any) {
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
    console.log('🟢 Enviando reseña:', this.form.value);
    if (this.form.valid && this.negocioIdSeleccionado && this.usuarioActual?.id) {
      const reseña = {
        contenido: this.form.value.comentario,
        puntuacion: this.form.value.valoracion,
        selloNenufar: this.form.value.selloNenufar,
        negocioId: this.negocioIdSeleccionado,
        usuarioId: this.usuarioActual.id
      };

      this.http.post(buildApiUrl('/resena'), reseña).subscribe({
        next: (res) => {
          console.log('✅ Reseña guardada:', res);
          alert('Genial!! Tu reseña se ha guardado.')
          this.resenaCreada.emit(res);
          this.form.reset({ valoracion: 0, selloNenufar: false });
          this.negocioIdSeleccionado = null;
        },
        error: (err) => {
          console.error('❌ Error al guardar reseña:', err);
        }
      });
    }
  }
}
