import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder, FormGroup, Validators, ReactiveFormsModule,
  FormArray, FormControl
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-editar-negocio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './editar-negocio.component.html',
  styleUrl: './editar-negocio.component.css'
})
export class EditarNegocioComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private router = inject(Router);

  negocioForm!: FormGroup;
  negocioId!: number;
  diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  matrizHoraria: { hora: string, ocupado: boolean }[][] = [];

  ngOnInit(): void {
    this.negocioId = Number(this.route.snapshot.paramMap.get('id'));

    this.negocioForm = this.fb.group({
      nombre: ['', Validators.required],
      nickname: ['', Validators.required],
      direccion: [''],
      historia: [''],
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

    this.cargarDatos();
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
    this.http.get<any>(`http://localhost:3000/negocio/${this.negocioId}`).subscribe({
      next: (negocio) => {
        this.negocioForm.patchValue({
          nombre: negocio.nombre,
          nickname: negocio.dueño?.nickname || '',
          direccion: negocio.direccion,
          historia: negocio.historia,
          categoria: negocio.categoria?.nombre || '',
          aceptaReservas: negocio.aceptaReservas || false,
          horario: {
            apertura: negocio.horario?.apertura || '',
            cierre: negocio.horario?.cierre || '',
            intervalo: negocio.horario?.intervalo || 30
          }
        });

        if (negocio.horario?.diasAbre) {
          negocio.horario.diasAbre.forEach((dia: string) => this.toggleDia(dia));
        }

        this.generarMatrizHoraria();
      },
      error: (err) => console.error('Error cargando negocio:', err)
    });
  }

  generarMatrizHoraria() {
    const apertura = this.negocioForm.get('horario.apertura')?.value;
    const cierre = this.negocioForm.get('horario.cierre')?.value;
    const intervalo = +this.negocioForm.get('horario.intervalo')?.value || 30;

    if (!apertura || !cierre) return;

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
    if (this.negocioForm.invalid) return;

    const datos = this.negocioForm.value;
    console.log('📦 Datos enviados al backend:', datos);

    this.http.patch(`http://localhost:3000/negocio/${this.negocioId}`, datos).subscribe({
      next: () => this.router.navigate(['/negocio', this.negocioId]),
      error: (err) => console.error('❌ Error al actualizar negocio:', err)
    });
  }
}
