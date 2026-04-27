import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems
} from '../../config/api.config';
import { TrieIndex, normalizeSearchText } from '../../core/search/trie';

export type NegocioLite = {
  id: number;
  nombre: string;
  nickname?: string;
  categoria?: { nombre: string };
};

@Injectable({ providedIn: 'root' })
export class NegocioSearchService {
  private readonly cache = new Map<string, NegocioLite[]>();
  private readonly itemsById = new Map<number, NegocioLite>();
  private readonly trie = new TrieIndex();
  private readonly indexedKeysById = new Map<number, Set<string>>();
  private readonly backendLimit = 20;

  constructor(private readonly http: HttpClient) {}

  search(prefix: string): Observable<NegocioLite[]> {
    const normalized = normalizeSearchText(prefix);

    if (!normalized) {
      return of([]);
    }

    const exactCache = this.cache.get(normalized);
    if (exactCache) {
      return of(exactCache.slice(0, this.backendLimit));
    }

    const localResults = this.queryLocal(normalized, this.backendLimit);
    if (normalized.length < 2) {
      return of(localResults);
    }

    const cachedParent = this.findClosestCachedPrefix(normalized);
    if (cachedParent && cachedParent.results.length < this.backendLimit) {
      this.cache.set(normalized, localResults);
      return of(localResults);
    }

    if (localResults.length >= this.backendLimit) {
      this.cache.set(normalized, localResults);
      return of(localResults);
    }

    return this.fetchRemote(normalized).pipe(
      map((results) => {
        const merged = this.mergeResults(localResults, results).slice(0, this.backendLimit);
        this.cache.set(normalized, merged);
        return merged;
      }),
      catchError(() => of(localResults))
    );
  }

  private fetchRemote(prefix: string): Observable<NegocioLite[]> {
    return this.http
      .get<ApiListResponse<unknown>>(buildApiUrl('/negocios'), {
        params: {
          q: prefix,
          limit: String(this.backendLimit)
        }
      })
      .pipe(
        map((response) => extractItems(response)),
        map((items) =>
          items
            .map((item) => this.normalizeNegocio(item))
            .filter((item): item is NegocioLite => item !== null)
        ),
        tap((results) => this.indexResults(results))
      );
  }

  private indexResults(results: NegocioLite[]): void {
    for (const item of results) {
      this.itemsById.set(item.id, item);

      let indexedKeys = this.indexedKeysById.get(item.id);
      if (!indexedKeys) {
        indexedKeys = new Set<string>();
        this.indexedKeysById.set(item.id, indexedKeys);
      }

      for (const key of this.getIndexKeys(item)) {
        if (indexedKeys.has(key)) {
          continue;
        }

        this.trie.insert(key, item.id);
        indexedKeys.add(key);
      }
    }
  }

  private getIndexKeys(item: NegocioLite): string[] {
    return [item.nombre, item.nickname ?? '']
      .map((value) => normalizeSearchText(value))
      .filter(Boolean);
  }

  private queryLocal(prefix: string, limit: number): NegocioLite[] {
    const ids = this.trie.query(prefix, Math.max(limit * 2, limit));
    const results: NegocioLite[] = [];

    for (const id of ids) {
      const item = this.itemsById.get(id);
      if (!item || !this.matchesPrefix(item, prefix)) {
        continue;
      }

      results.push(item);
      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }

  private matchesPrefix(item: NegocioLite, prefix: string): boolean {
    const normalizedPrefix = normalizeSearchText(prefix);
    if (!normalizedPrefix) {
      return false;
    }

    return this.getIndexKeys(item).some((key) => key.startsWith(normalizedPrefix));
  }

  private mergeResults(localResults: NegocioLite[], remoteResults: NegocioLite[]): NegocioLite[] {
    const merged = new Map<number, NegocioLite>();

    for (const item of localResults) {
      merged.set(item.id, item);
    }

    for (const item of remoteResults) {
      merged.set(item.id, item);
    }

    return Array.from(merged.values());
  }

  private findClosestCachedPrefix(prefix: string): { prefix: string; results: NegocioLite[] } | null {
    for (let length = prefix.length - 1; length >= 2; length -= 1) {
      const candidate = prefix.slice(0, length);
      const results = this.cache.get(candidate);

      if (results) {
        return { prefix: candidate, results };
      }
    }

    return null;
  }

  private normalizeNegocio(item: unknown): NegocioLite | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const negocio = item as {
      id?: number | string;
      nombre?: string;
      nickname?: string;
      categoria?: { nombre?: string } | string;
      categoriaNombre?: string;
    };

    const id = Number(negocio.id);
    if (!Number.isFinite(id) || id <= 0) {
      return null;
    }

    const categoriaNombre =
      typeof negocio.categoria === 'string'
        ? negocio.categoria
        : negocio.categoria?.nombre || negocio.categoriaNombre;

    return {
      id,
      nombre: negocio.nombre?.trim() || `Negocio ${id}`,
      ...(negocio.nickname?.trim() ? { nickname: negocio.nickname.trim() } : {}),
      ...(categoriaNombre?.trim() ? { categoria: { nombre: categoriaNombre.trim() } } : {})
    };
  }
}
