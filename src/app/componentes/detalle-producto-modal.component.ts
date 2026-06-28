import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ListaCompraService,
  AddListaCompraItemPayload,
} from '../servicios/listaCompraServicio/lista-compra.service';
import { BotonoFavoritoComponent } from './boton-favorito.component';

export interface ProductoDetalle {
  id: number;
  nombre: string;
  descripcion?: string;
  precio?: number;
  foto?: string;
  negocioId: number;
  favorito?: boolean;
  negocio: {
    id: number;
    nombre: string;
    slug?: string;
    ciudad?: string;
    verificado?: boolean;
  };
}

@Component({
  selector: 'app-detalle-producto-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, BotonoFavoritoComponent],
  template: `
    @if (visible) {
      <div class="modal-overlay" (click)="cerrar()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <button class="btn-close" (click)="cerrar()">&#x2715;</button>

          @if (producto) {
            <div class="detalle-container">
              <div class="foto-section">
                @if (producto.foto) {
                  <img [src]="producto.foto" [alt]="producto.nombre" class="producto-foto" />
                } @else {
                  <div class="foto-placeholder">Sin foto</div>
                }
              </div>

              <div class="info-section">
                <h2>{{ producto.nombre }}</h2>

                <div class="negocio-info">
                  <h3>{{ producto.negocio.nombre }}</h3>
                  @if (producto.negocio.ciudad) {
                    <p class="ciudad">{{ producto.negocio.ciudad }}</p>
                  }
                  @if (producto.negocio.verificado) {
                    <span class="verificado">Verificado</span>
                  }
                </div>

                @if (producto.precio !== undefined && producto.precio !== null) {
                  <div class="precio-section">
                    <span class="precio">{{ producto.precio | currency:'EUR':'symbol':'1.2-2':'es' }}</span>
                  </div>
                }

                @if (producto.descripcion) {
                  <div class="descripcion-section">
                    <h4>Descripción</h4>
                    <p>{{ producto.descripcion }}</p>
                  </div>
                }

                <div class="favorito-section">
                  <app-boton-favorito
                    [productoId]="producto.id"
                    [esFavorito]="producto.favorito || false"
                    (favoritoChanged)="onFavoritoChanged($event)"
                    (errorMessage)="mensajeError = $event"
                  ></app-boton-favorito>
                </div>

                <div class="nenulista-section">
                  <h4>Añadir a Mi Nenulista</h4>

                  <div class="form-group">
                    <label>Cantidad</label>
                    <div class="cantidad-control">
                      <button (click)="decrementarCantidad()" class="btn-qty">-</button>
                      <input
                        type="number"
                        [(ngModel)]="cantidad"
                        min="1"
                        class="input-cantidad"
                      />
                      <button (click)="incrementarCantidad()" class="btn-qty">+</button>
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Nota (opcional)</label>
                    <input
                      type="text"
                      [(ngModel)]="nota"
                      placeholder="Ej: Para el finde"
                      class="input-nota"
                    />
                  </div>

                  <button
                    (click)="addToNenulista()"
                    [disabled]="agregandoNenulista"
                    class="btn-add-nenulista"
                  >
                    {{ agregandoNenulista ? 'Añadiendo...' : 'Añadir a Mi Nenulista' }}
                  </button>

                  @if (mensajeExito) {
                    <p class="mensaje-exito">{{ mensajeExito }}</p>
                  }
                  @if (mensajeError) {
                    <p class="mensaje-error">{{ mensajeError }}</p>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .modal-content {
      background-color: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
    }

    .btn-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background-color: transparent;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #999;
      z-index: 10;
    }

    .btn-close:hover { color: #333; }

    .detalle-container { padding: 2rem; }

    .foto-section { margin-bottom: 1.5rem; }

    .producto-foto {
      width: 100%;
      max-height: 400px;
      object-fit: cover;
      border-radius: 8px;
    }

    .foto-placeholder {
      width: 100%;
      height: 300px;
      background-color: #f0f0f0;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 1.1rem;
    }

    .info-section h2 {
      font-size: 1.8rem;
      margin-bottom: 1rem;
      color: #333;
    }

    .negocio-info {
      margin-bottom: 1.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .negocio-info h3 { margin: 0; font-size: 1.1rem; color: #666; }

    .ciudad { font-size: 0.9rem; color: #999; margin: 0.25rem 0; }

    .verificado {
      display: inline-block;
      background-color: #e8f5e9;
      color: #2e7d32;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
      margin-top: 0.5rem;
    }

    .precio-section { margin-bottom: 1.5rem; }

    .precio { font-size: 1.5rem; font-weight: 700; color: #0066cc; }

    .descripcion-section { margin-bottom: 1.5rem; }

    .descripcion-section h4 { margin: 0 0 0.5rem; font-size: 1rem; color: #555; }

    .descripcion-section p { margin: 0; color: #666; line-height: 1.6; }

    .favorito-section { margin-bottom: 1.5rem; }

    .nenulista-section {
      border-top: 1px solid #e0e0e0;
      padding-top: 1.5rem;
    }

    .nenulista-section h4 { margin: 0 0 1rem; font-size: 1rem; color: #555; }

    .form-group { margin-bottom: 1rem; }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #333;
      font-size: 0.95rem;
    }

    .cantidad-control {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-qty {
      width: 2.5rem;
      height: 2.5rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      background-color: white;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn-qty:hover { border-color: #0066cc; background-color: #f0f7ff; }

    .input-cantidad {
      width: 3rem;
      text-align: center;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 1rem;
    }

    .input-nota {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.95rem;
      box-sizing: border-box;
    }

    .input-nota:focus { outline: none; border-color: #0066cc; }

    .btn-add-nenulista {
      width: 100%;
      padding: 0.8rem;
      background-color: #0066cc;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      margin-top: 0.5rem;
    }

    .btn-add-nenulista:hover:not(:disabled) { background-color: #0052a3; }

    .btn-add-nenulista:disabled { opacity: 0.6; cursor: not-allowed; }

    .mensaje-exito {
      color: #2e7d32;
      background-color: #e8f5e9;
      padding: 0.75rem;
      border-radius: 4px;
      margin-top: 0.75rem;
      font-size: 0.9rem;
    }

    .mensaje-error {
      color: #c62828;
      background-color: #ffebee;
      padding: 0.75rem;
      border-radius: 4px;
      margin-top: 0.75rem;
      font-size: 0.9rem;
    }

    @media (max-width: 600px) {
      .modal-content { max-height: 100vh; border-radius: 0; }
      .detalle-container { padding: 1.5rem; }
      .info-section h2 { font-size: 1.5rem; }
    }
  `],
})
export class DetalleProductoModalComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() producto: ProductoDetalle | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() productAdded = new EventEmitter<void>();

  cantidad = 1;
  nota = '';
  agregandoNenulista = false;
  mensajeExito: string | null = null;
  mensajeError: string | null = null;
  private cerrarTrasExitoTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private listaCompraService: ListaCompraService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.limpiarCierreTrasExito();
      this.cantidad = 1;
      this.nota = '';
      this.agregandoNenulista = false;
      this.mensajeExito = null;
      this.mensajeError = null;
    }
  }

  ngOnDestroy(): void {
    this.limpiarCierreTrasExito();
  }

  cerrar(): void {
    this.limpiarCierreTrasExito();
    this.agregandoNenulista = false;
    this.close.emit();
  }

  incrementarCantidad(): void {
    this.cantidad++;
  }

  decrementarCantidad(): void {
    if (this.cantidad > 1) {
      this.cantidad--;
    }
  }

  onFavoritoChanged(esFavorito: boolean): void {
    if (this.producto) {
      this.producto.favorito = esFavorito;
    }
  }

  addToNenulista(): void {
    if (!this.producto || this.agregandoNenulista) return;

    this.agregandoNenulista = true;
    this.mensajeError = null;
    this.mensajeExito = null;

    const payload: AddListaCompraItemPayload = {
      productoId: this.producto.id,
      cantidad: Math.max(1, Number(this.cantidad) || 1),
      ...(this.nota ? { nota: this.nota } : {}),
    };

    this.listaCompraService.addItem(payload).subscribe({
      next: () => {
        this.mensajeExito = 'Producto añadido a la lista';
        this.cantidad = 1;
        this.nota = '';
        this.productAdded.emit();
        this.programarCierreTrasExito();
      },
      error: () => {
        this.mensajeError = 'El producto no se añadió a tu lista. Vuelve a intentarlo.';
        this.agregandoNenulista = false;
      },
    });
  }

  private programarCierreTrasExito(): void {
    this.limpiarCierreTrasExito();
    this.cerrarTrasExitoTimeout = setTimeout(() => {
      this.cerrarTrasExitoTimeout = null;
      this.mensajeExito = null;
      this.cerrar();
    }, 800);
  }

  private limpiarCierreTrasExito(): void {
    if (this.cerrarTrasExitoTimeout) {
      clearTimeout(this.cerrarTrasExitoTimeout);
      this.cerrarTrasExitoTimeout = null;
    }
  }
}
