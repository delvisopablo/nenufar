import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import jsPDF from '../../../../shared/pdf/simple-jspdf';
import { CompraServiceService, Compra } from '../../../../servicios/compraServicio/compraService.service';
import { PagoServiceService, Pago } from '../../../../servicios/pagoServicio/pagoService.service';
import { getUserErrorMessage } from '../../../../core/errors/error-parser';

@Component({
  selector: 'app-detalle-compra',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './detalle-compra.component.html',
  styleUrl: './detalle-compra.component.css'
})
export class DetalleCompraComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly compras = inject(CompraServiceService);
  private readonly pagos = inject(PagoServiceService);

  readonly cargando = signal(true);
  readonly errorMensaje = signal('');
  readonly compra = signal<Compra | null>(null);
  readonly pagosCompra = signal<Pago[]>([]);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.errorMensaje.set('Compra no válida.');
      this.cargando.set(false);
      return;
    }
    this.cargar(id);
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    this.errorMensaje.set('');
    this.compras.getCompra(id).subscribe({
      next: (c) => {
        this.compra.set(c);
        // si el backend devuelve pagos embebidos, los usamos; si no, intentamos
        // un endpoint específico (en este proyecto no hay un GET /compras/:id/pagos,
        // así que confiamos en el embed).
        const pagosEmbed = (c as { pagos?: Pago[] }).pagos;
        if (Array.isArray(pagosEmbed)) {
          this.pagosCompra.set(pagosEmbed);
        }
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.errorMensaje.set(getUserErrorMessage(err, 'No hemos podido cargar el detalle de la compra.'));
      }
    });
  }

  formatTotal(value: unknown, moneda: unknown = 'EUR'): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${n.toFixed(2)} ${String(moneda || 'EUR').toUpperCase()}`;
  }

  formatFecha(value: unknown): string {
    if (typeof value !== 'string' && !(value instanceof Date)) return '';
    const d = new Date(value as string | Date);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  getLineSubtotal(item: unknown): number {
    const line = item as {
      cantidad?: unknown;
      precioUnit?: unknown;
      precio?: unknown;
    };

    const cantidad = Number(line.cantidad ?? 1);
    const precio = Number(line.precioUnit ?? line.precio ?? 0);

    return (Number.isFinite(cantidad) ? cantidad : 1) *
      (Number.isFinite(precio) ? precio : 0);
  }

  getCompraItems(compra: Compra): any[] {
    return (
      (compra as any).items ||
      (compra as any).pedidoProductos ||
      (compra as any).lineas ||
      []
    );
  }

  descargarPDF(): void {
    const compra = this.compra();
    if (!compra) return;

    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    let y = 8;
    const left = 6;
    const right = 74;

    doc.setFont('courier', 'normal');
    doc.setFontSize(11);
    doc.text('NENUFAR', 40, y, { align: 'center' });
    y += 5;
    doc.setFontSize(8);
    doc.text('Recibo de compra', 40, y, { align: 'center' });
    y += 6;
    doc.line(left, y, right, y);
    y += 4;

    doc.text(`N°: ${compra.id}`, left, y);
    y += 4;
    doc.text(`Fecha: ${this.formatFecha((compra as any).creadoEn)}`, left, y);
    y += 4;
    if (compra.estado) {
      doc.text(`Estado: ${compra.estado}`, left, y);
      y += 4;
    }
    doc.line(left, y, right, y);
    y += 4;

    const items = this.getCompraItems(compra);

    for (const it of items) {
      const nombre = String(
        it.producto?.nombre ?? it.nombre ?? `#${it.productoId ?? it.id}`,
      ).slice(0, 24);
      const cant = Number(it.cantidad ?? 1) || 1;
      const pu = Number(it.precioUnit ?? it.precio ?? 0);
      const sub = (cant * pu).toFixed(2);
      doc.text(nombre, left, y);
      doc.text(`${cant} x ${pu.toFixed(2)}`, right, y, { align: 'right' });
      y += 4;
      doc.text(`= ${sub} ${compra.moneda || 'EUR'}`, right, y, { align: 'right' });
      y += 5;
    }

    doc.line(left, y, right, y);
    y += 5;
    doc.setFontSize(11);
    doc.text(
      `TOTAL: ${this.formatTotal(compra.total, compra.moneda)}`,
      right,
      y,
      { align: 'right' },
    );
    y += 8;

    if (this.pagosCompra().length) {
      doc.setFontSize(9);
      doc.text('Pagos:', left, y);
      y += 4;
      for (const p of this.pagosCompra()) {
        doc.text(`${p.metodoPago} - ${p.estado}`, left, y);
        doc.text(this.formatTotal(p.cantidad, p.moneda), right, y, { align: 'right' });
        y += 4;
      }
    }

    y += 6;
    doc.setFontSize(8);
    doc.text('Gracias por apoyar el comercio local.', 40, y, { align: 'center' });

    doc.save(`compra-${compra.id}.pdf`);
  }

  imprimir(): void {
    window.print();
  }
}
