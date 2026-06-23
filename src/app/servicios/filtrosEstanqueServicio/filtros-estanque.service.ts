import { Injectable, computed, signal } from '@angular/core';

export type FiltroCategoria = { id: number; nombre: string } | null;
export type FiltroSubcategoria = { id: number; nombre: string } | null;

/**
 * Puente entre el buscador del header y el estanque de inicio: permite que la
 * categoria/subcategoria elegida en el header filtre los nenufares flotantes
 * sin que ambos componentes tengan que conocerse entre si.
 */
@Injectable({ providedIn: 'root' })
export class FiltrosEstanqueService {
  private readonly categoriaSignal = signal<FiltroCategoria>(null);
  private readonly subcategoriaSignal = signal<FiltroSubcategoria>(null);

  readonly categoria = this.categoriaSignal.asReadonly();
  readonly subcategoria = this.subcategoriaSignal.asReadonly();
  readonly hayFiltroActivo = computed(
    () => Boolean(this.categoriaSignal() || this.subcategoriaSignal()),
  );

  setCategoria(categoria: FiltroCategoria): void {
    this.categoriaSignal.set(categoria);
  }

  setSubcategoria(subcategoria: FiltroSubcategoria): void {
    this.subcategoriaSignal.set(subcategoria);
  }

  limpiar(): void {
    this.categoriaSignal.set(null);
    this.subcategoriaSignal.set(null);
  }
}
