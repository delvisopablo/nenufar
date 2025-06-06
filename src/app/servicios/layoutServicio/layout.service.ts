import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  // Rutas que no muestran el menú lateral
  private rutasSinMenu = ['/login', '/registro', '/holaaa'];

  // Rutas que no muestran ni header, ni footer, ni menú
  private rutasSinLayout = ['/holaaa'];

  // Rutas que usan layout público (sin login)
  private rutasPublicas = ['/login', '/registro', '/holaaa'];

  // En el futuro puedes añadir rutas privadas o admin
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
    return this.rutasAdmin.some(path => url.startsWith(path));
  }
}
