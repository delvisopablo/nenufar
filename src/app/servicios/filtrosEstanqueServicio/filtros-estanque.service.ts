import { Injectable, computed, signal } from '@angular/core';

export type FiltroCategoria = { id: number; nombre: string } | null;
export type FiltroSubcategoria = { id: number; nombre: string } | null;

const LIMITE_NENUFARES_POR_DEFECTO = 10;

/**
 * Puente entre el buscador del header y el estanque de inicio: permite que la
 * categoria/subcategoria elegida en el header filtre los nenufares flotantes,
 * y que el contador de cantidad limite cuantos negocios se usan para construir
 * el estanque, sin que ambos componentes tengan que conocerse entre si.
 */
@Injectable({ providedIn: 'root' })
export class FiltrosEstanqueService {
  private readonly categoriaSignal = signal<FiltroCategoria>(null);
  private readonly subcategoriaSignal = signal<FiltroSubcategoria>(null);
  private readonly limiteSignal = signal<number>(LIMITE_NENUFARES_POR_DEFECTO);

  readonly categoria = this.categoriaSignal.asReadonly();
  readonly subcategoria = this.subcategoriaSignal.asReadonly();
  /** Cantidad de negocios aplicada tras pulsar "OK" en el contador del header. */
  readonly limite = this.limiteSignal.asReadonly();
  readonly hayFiltroActivo = computed(
    () => Boolean(this.categoriaSignal() || this.subcategoriaSignal()),
  );

  setCategoria(categoria: FiltroCategoria): void {
    this.categoriaSignal.set(categoria);
  }

  setSubcategoria(subcategoria: FiltroSubcategoria): void {
    this.subcategoriaSignal.set(subcategoria);
  }

  setLimite(limite: number): void {
    this.limiteSignal.set(limite);
  }

  limpiar(): void {
    this.categoriaSignal.set(null);
    this.subcategoriaSignal.set(null);
  }
}
