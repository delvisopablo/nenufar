import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private rutasSinMenu = [
    '/',
    '/login',
    '/registro',
    '/registro-opciones',
    '/registro-negocio',
    '/holaaa',
    '/estanque'
  ];

  private rutasSinLayout = [
    '/',
    '/login',
    '/registro',
    '/registro-opciones',
    '/registro-negocio',
    '/holaaa',
    '/estanque'
  ];

  private rutasPublicas = [
    '/',
    '/login',
    '/registro',
    '/registro-opciones',
    '/registro-negocio',
    '/holaaa',
    '/estanque'
  ];

  private rutasAdmin = ['/admin', '/panel'];

  shouldShowMenu(url: string): boolean {
    return !this.rutasSinMenu.includes(url);
  }

  shouldShowLayout(url: string): boolean {
    return !this.rutasSinLayout.includes(url);
  }

  isPublic(url: string): boolean {
    return this.rutasPublicas.includes(url);
  }

  isAdmin(url: string): boolean {
    return this.rutasAdmin.some((path) => url.startsWith(path));
  }
}
