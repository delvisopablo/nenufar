import { Injectable } from '@angular/core';

import type { RouteMode, SearchResult } from './ruta-local.component';

const MODE_HINTS: Record<RouteMode, string[]> = {
  recados: ['fruteria', 'panaderia', 'farmacia', 'mercado', 'tienda'],
  cerveza: ['bar', 'cerveza', 'cafeteria', 'taberna'],
  gastro: ['restaurante', 'tapa', 'bodega', 'mercado'],
  tarde: ['cine', 'tienda', 'parque', 'museo', 'teatro'],
  improvisar: ['bar', 'cafeteria', 'cine', 'tienda', 'mercado', 'restaurante']
};

const MOCK_SEARCH: SearchResult[] = [
  { id: 1, name: 'Bar El Tigre', type: 'Bar', address: 'C/ Montera 12', distance: '120 m', emoji: '🍺' },
  { id: 2, name: 'Cafeteria Central', type: 'Cafeteria', address: 'Gran Via 45', distance: '200 m', emoji: '☕' },
  { id: 3, name: 'Fruteria Carmen', type: 'Fruteria', address: 'Mercado Central', distance: '350 m', emoji: '🍅' },
  { id: 4, name: 'Panaderia El Horno', type: 'Panaderia', address: 'C/ Mayor 8', distance: '400 m', emoji: '🥖' },
  { id: 5, name: 'Cines Callao', type: 'Cine', address: 'Plaza Callao 3', distance: '500 m', emoji: '🎬' },
  { id: 6, name: 'La Via Lactea', type: 'Bar', address: 'C/ Velarde 18', distance: '600 m', emoji: '🍺' },
  { id: 7, name: 'Restaurante Botin', type: 'Restaurante', address: 'C/ Cuchilleros 17', distance: '700 m', emoji: '🍽️' },
  { id: 8, name: 'Farmacia Atocha', type: 'Farmacia', address: 'Paseo Atocha 2', distance: '800 m', emoji: '💊' },
  { id: 9, name: 'Fnac Gran Via', type: 'Tienda', address: 'Gran Via 29', distance: '900 m', emoji: '🛍️' },
  { id: 10, name: 'Mercado San Miguel', type: 'Mercado', address: 'Plaza San Miguel', distance: '1 km', emoji: '🏪' }
];

@Injectable({ providedIn: 'root' })
export class RutaLocalSearchService {
  search(query: string, mode: RouteMode): SearchResult[] {
    const normalizedQuery = this.normalize(query);

    if (!normalizedQuery) {
      return [];
    }

    const hints = MODE_HINTS[mode];

    return MOCK_SEARCH.filter((result) => {
      const haystack = this.normalize(`${result.name} ${result.type} ${result.address}`);
      const matchesQuery = haystack.includes(normalizedQuery);
      const queryLooksLikeModeHint = hints.some(
        (hint) => normalizedQuery.includes(hint) || hint.includes(normalizedQuery)
      );
      const matchesMode = hints.some((hint) => haystack.includes(hint));

      return matchesQuery || (queryLooksLikeModeHint && matchesMode);
    }).slice(0, 7);
  }

  // Future Google Places integration can replace this mock-backed method
  // while keeping the component debounce and signal flow untouched.
  private normalize(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
