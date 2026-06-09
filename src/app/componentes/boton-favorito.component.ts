import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductoFavoritoService } from '../servicios/productoFavoritoServicio/producto-favorito.service';

@Component({
  selector: 'app-boton-favorito',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      (click)="toggleFavorito()"
      [class.favorito]="esFavorito"
      [disabled]="loading"
      class="boton-favorito"
      [title]="esFavorito ? 'Quitar de favoritos' : 'Guardar como favorito'"
    >
      <svg
        class="icono-estrella"
        [class.llena]="esFavorito"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
      <span class="texto">{{ esFavorito ? 'Favorito' : 'Guardar favorito' }}</span>
    </button>
  `,
  styles: [`
    .boton-favorito {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.2rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      background-color: white;
      color: #666;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      transition: all 0.3s ease;
      position: relative;
    }

    .boton-favorito:hover:not(:disabled) {
      border-color: #ffc107;
      background-color: #fffbf0;
      color: #ffc107;
    }

    .boton-favorito.favorito {
      border-color: #ffc107;
      background-color: #fffbf0;
      color: #ffc107;
    }

    .boton-favorito:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .icono-estrella {
      width: 1.2rem;
      height: 1.2rem;
      fill: none;
      transition: all 0.3s ease;
    }

    .icono-estrella.llena {
      fill: currentColor;
    }

    .texto {
      @media (max-width: 480px) {
        display: none;
      }
    }
  `],
})
export class BotonoFavoritoComponent implements OnInit {
  @Input() productoId!: number;
  @Input() esFavorito = false;
  @Output() favoritoChanged = new EventEmitter<boolean>();
  @Output() errorMessage = new EventEmitter<string>();

  loading = false;

  constructor(private favoritosService: ProductoFavoritoService) {}

  ngOnInit() {
    // Se espera que el componente padre pase esFavorito como @Input
  }

  toggleFavorito() {
    if (this.loading) return;

    this.loading = true;

    if (this.esFavorito) {
      this.favoritosService.quitarFavorito(this.productoId).subscribe({
        next: () => {
          this.esFavorito = false;
          this.favoritoChanged.emit(false);
          this.loading = false;
        },
        error: () => {
          this.errorMessage.emit('El producto no se quitó de favoritos. Vuelve a intentarlo.');
          this.loading = false;
        },
      });
    } else {
      this.favoritosService.marcarFavorito(this.productoId).subscribe({
        next: () => {
          this.esFavorito = true;
          this.favoritoChanged.emit(true);
          this.loading = false;
        },
        error: () => {
          this.errorMessage.emit('El producto no se guardó como favorito. Vuelve a intentarlo.');
          this.loading = false;
        },
      });
    }
  }
}
