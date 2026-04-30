import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnChanges, OnInit, signal, SimpleChanges } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductoServiceService, Producto } from '../../../servicios/productoServicio/productoService.service';
import { getUserErrorMessage } from '../../../core/errors/error-parser';

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './producto.component.html',
  styleUrl: './producto.component.css'
})
export class ProductoComponent implements OnInit, OnChanges {
  /** Si se pasa el negocioId como @Input() se carga al montar; si no,
   *  intentamos leerlo de la ruta (:id) */
  @Input() negocioId?: number;

  private readonly route = inject(ActivatedRoute);
  private readonly productos = inject(ProductoServiceService);

  readonly cargando = signal(true);
  readonly errorMensaje = signal('');
  readonly items = signal<Producto[]>([]);

  ngOnInit(): void {
    if (!this.negocioId) {
      const param = Number(this.route.snapshot.paramMap.get('id') ?? this.route.snapshot.paramMap.get('negocioId'));
      if (Number.isFinite(param) && param > 0) {
        this.negocioId = param;
      }
    }
    this.cargar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('negocioId' in changes && this.negocioId) {
      this.cargar();
    }
  }

  private cargar(): void {
    if (!this.negocioId || this.negocioId <= 0) {
      this.errorMensaje.set('No se ha indicado el negocio.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.errorMensaje.set('');
    this.productos.listByNegocio(this.negocioId).subscribe({
      next: (lista) => {
        this.items.set(lista);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.errorMensaje.set(getUserErrorMessage(err, 'No hemos podido cargar los productos.'));
      }
    });
  }

  formatPrecio(p: Producto): string {
    return Number.isFinite(p.precio) ? `${Number(p.precio).toFixed(2)} €` : '—';
  }
}
