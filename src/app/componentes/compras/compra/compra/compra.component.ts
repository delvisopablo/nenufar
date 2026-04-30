import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CompraServiceService, Compra } from '../../../../servicios/compraServicio/compraService.service';
import { getUserErrorMessage } from '../../../../core/errors/error-parser';

@Component({
  selector: 'app-compra',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './compra.component.html',
  styleUrl: './compra.component.css'
})
export class CompraComponent implements OnInit {
  private readonly compras = inject(CompraServiceService);

  readonly cargando = signal(true);
  readonly errorMensaje = signal('');
  readonly items = signal<Compra[]>([]);

  ngOnInit(): void {
    this.cargarMisCompras();
  }

  private cargarMisCompras(): void {
    this.cargando.set(true);
    this.errorMensaje.set('');
    this.compras.misCompras().subscribe({
      next: (lista) => {
        this.items.set(lista);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.errorMensaje.set(getUserErrorMessage(err, 'No hemos podido cargar tus compras.'));
      }
    });
  }

  formatTotal(c: Compra): string {
    if (typeof c.total !== 'number') return '—';
    const moneda = (c.moneda || 'EUR').toUpperCase();
    return `${c.total.toFixed(2)} ${moneda}`;
  }

  formatFecha(value: unknown): string {
    if (typeof value !== 'string' && !(value instanceof Date)) return '';
    const d = new Date(value as string | Date);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
