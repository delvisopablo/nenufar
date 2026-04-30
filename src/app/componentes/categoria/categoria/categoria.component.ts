import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { CategoriaServiceService, Categoria, Subcategoria } from '../../../servicios/categoriaServicio/categoriaService.service';
import { getUserErrorMessage } from '../../../core/errors/error-parser';

interface CategoriaConSubs {
  cat: Categoria;
  subs: Subcategoria[];
  cargandoSubs: boolean;
  expandida: boolean;
}

@Component({
  selector: 'app-categoria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './categoria.component.html',
  styleUrl: './categoria.component.css'
})
export class CategoriaComponent implements OnInit {
  private readonly categorias = inject(CategoriaServiceService);

  readonly cargando = signal(true);
  readonly errorMensaje = signal('');
  readonly items = signal<CategoriaConSubs[]>([]);

  ngOnInit(): void {
    this.cargarCategorias();
  }

  private cargarCategorias(): void {
    this.cargando.set(true);
    this.errorMensaje.set('');
    this.categorias.list().subscribe({
      next: (lista) => {
        this.items.set(lista.map(c => ({ cat: c, subs: [], cargandoSubs: false, expandida: false })));
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.errorMensaje.set(getUserErrorMessage(err, 'No hemos podido cargar las categorías.'));
      }
    });
  }

  toggle(item: CategoriaConSubs): void {
    item.expandida = !item.expandida;
    if (item.expandida && item.subs.length === 0 && !item.cargandoSubs) {
      this.cargarSubs(item);
    }
    // forzar refresh del signal
    this.items.set([...this.items()]);
  }

  private cargarSubs(item: CategoriaConSubs): void {
    item.cargandoSubs = true;
    this.items.set([...this.items()]);
    this.categorias.listSubcategorias(item.cat.id).subscribe({
      next: (subs) => {
        item.subs = subs;
        item.cargandoSubs = false;
        this.items.set([...this.items()]);
      },
      error: () => {
        item.cargandoSubs = false;
        this.items.set([...this.items()]);
      }
    });
  }
}
