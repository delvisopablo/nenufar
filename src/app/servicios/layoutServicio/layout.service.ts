import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private noScrollRoutes = ['/', '/estanque', '/inicio', '/confirmar-email'];
  private rutasSinMenu = [
    '/',
    '/login',
    '/registro',
    '/registro-opciones',
    '/registro-negocio',
    '/confirmar-email',
    '/holaaa',
    '/estanque'
  ];

  private rutasSinLayout = [
    '/',
    '/login',
    '/registro',
    '/registro-opciones',
    '/registro-negocio',
    '/confirmar-email',
    '/holaaa',
    '/estanque'
  ];

  private rutasPublicas = [
    '/',
    '/login',
    '/registro',
    '/registro-opciones',
    '/registro-negocio',
    '/confirmar-email',
    '/holaaa',
    '/estanque'
  ];

  private rutasAdmin = ['/admin', '/panel'];

  private normalizeUrl(url: string): string {
    return url.split('?')[0].split('#')[0] || '/';
  }

  shouldShowMenu(url: string): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    return !this.rutasSinMenu.includes(normalizedUrl);
  }

  shouldShowLayout(url: string): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    return !this.rutasSinLayout.includes(normalizedUrl);
  }

  isPublic(url: string): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    return this.rutasPublicas.includes(normalizedUrl);
  }

  isAdmin(url: string): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    return this.rutasAdmin.some((path) => normalizedUrl.startsWith(path));
  }

  shouldDisablePageScroll(url: string): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    return this.noScrollRoutes.includes(normalizedUrl);
  }
}
