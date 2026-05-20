import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authToEstanqueGuard } from './guards/auth-to-estanque.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./componentes/estanque/estanque.component').then((m) => m.EstanqueComponent) },
  { path: 'estanque', loadComponent: () => import('./componentes/estanque/estanque.component').then((m) => m.EstanqueComponent) },
  { path: 'admin', loadComponent: () => import('./componentes/admin-panel/admin-panel.component').then((m) => m.AdminPanelComponent), canActivate: [adminGuard] },
  { path: 'login', redirectTo: 'estanque', pathMatch: 'full' },
  { path: 'inicio', loadComponent: () => import('./componentes/principal/principal.component').then((m) => m.PrincipalComponent) },
  { path: 'logos-nenufar', loadComponent: () => import('./componentes/logos-nenufar/logos-nenufar.component').then((m) => m.LogosNenufarComponent), canActivate: [authToEstanqueGuard] },
  { path: 'mis-logros', loadComponent: () => import('./componentes/mis-logros/mis-logros.component').then((m) => m.MisLogrosComponent) },
  { path: 'nenuninfo', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'notificaciones', loadComponent: () => import('./componentes/notificaciones/notificaciones.component').then((m) => m.NotificacionesComponent) },
  { path: 'negocio', redirectTo: 'mi-negocio', pathMatch: 'full' },
  { path: 'ruta-local', loadComponent: () => import('./componentes/ruta-local/ruta-local.component').then((m) => m.RutaLocalComponent) },
  { path: 'registro-opciones', loadComponent: () => import('./componentes/registro/eleccion-registro/eleccion-registro.component').then((m) => m.EleccionRegistroComponent) },
  { path: 'registro', loadComponent: () => import('./componentes/registro/registro/registro.component').then((m) => m.RegistroComponent) },
  { path: 'registro-negocio', loadComponent: () => import('./componentes/registro-negocio/RegistroNegocio.component').then((m) => m.RegistroNegocioComponent) },
  { path: 'perfil', redirectTo: 'mi-perfil', pathMatch: 'full' },
  { path: 'perfil/NENUditar', loadComponent: () => import('./componentes/perfil/perfil/perfil.component').then((m) => m.PerfilComponent), canActivate: [authToEstanqueGuard] },
  { path: 'mi-perfil', loadComponent: () => import('./componentes/perfil/perfil/perfil.component').then((m) => m.PerfilComponent), canActivate: [authToEstanqueGuard] },
  { path: 'mi-perfil/NENUditar', loadComponent: () => import('./componentes/perfil/perfil/perfil.component').then((m) => m.PerfilComponent), canActivate: [authToEstanqueGuard] },
  { path: 'reservas', loadComponent: () => import('./componentes/reservas/reservas.component').then((m) => m.ReservasComponent), canActivate: [authToEstanqueGuard] },
  { path: 'mi-negocio/dashboard', loadComponent: () => import('./componentes/dashboard/dashboard.component').then((m) => m.DashboardComponent), canActivate: [authToEstanqueGuard] },
  { path: 'mi-negocio/reservas', redirectTo: 'mi-negocio', pathMatch: 'full' },
  { path: 'mi-negocio/NENUditar', loadComponent: () => import('./componentes/editar-negocio/editar-negocio.component').then((m) => m.EditarNegocioComponent), canActivate: [authToEstanqueGuard] },
  { path: 'negocio/NENUditar', redirectTo: 'mi-negocio/NENUditar', pathMatch: 'full' },
  { path: 'mi-negocio', loadComponent: () => import('./componentes/perfil-negocio/perfil-negocio.component').then((m) => m.PerfilNegocioComponent), canActivate: [authToEstanqueGuard] },
  { path: 'usuario/NENUditar', loadComponent: () => import('./componentes/perfil/perfil/perfil.component').then((m) => m.PerfilComponent), canActivate: [authToEstanqueGuard] },
  { path: 'usuario/:id', loadComponent: () => import('./componentes/perfil-publico-usuario/perfil-publico-usuario.component').then((m) => m.PerfilPublicoUsuarioComponent) },
  { path: 'negocio/reservas', redirectTo: 'mi-negocio', pathMatch: 'full' },
  { path: 'negocio/:id', loadComponent: () => import('./componentes/perfil-publico-negocio/perfil-publico-negocio.component').then((m) => m.PerfilPublicoNegocioComponent) },
  { path: 'reseñas', loadComponent: () => import('./componentes/portal-resenas/portal-resenas/portal-resenas.component').then((m) => m.PortalReseñasComponent) },
  { path: 'review', loadComponent: () => import('./componentes/review/review/hacer-review/hacer-review/hacer-review.component').then((m) => m.HacerReviewComponent) },
  { path: 'likes', loadComponent: () => import('./componentes/review/review/review.component').then((m) => m.ReviewComponent) },
  { path: 'ajustes', loadComponent: () => import('./componentes/ajustes/ajustes/ajustes.component').then((m) => m.AjustesComponent) },
  { path: 'compras', loadComponent: () => import('./componentes/compras/compra/compra/compra.component').then((m) => m.CompraComponent) },
  { path: 'compras/:id', loadComponent: () => import('./componentes/compras/detalleCompra/detalle-compra/detalle-compra.component').then((m) => m.DetalleCompraComponent) },
  { path: 'categorias', loadComponent: () => import('./componentes/categoria/categoria/categoria.component').then((m) => m.CategoriaComponent) },
  // Ruta pública de negocio por nickname/slug. Debe quedar al final de las rutas
  // concretas para no interceptar pantallas como /review, /ajustes o /compras.
  { path: ':slug', loadComponent: () => import('./componentes/perfil-publico-negocio/perfil-publico-negocio.component').then((m) => m.PerfilPublicoNegocioComponent) },
  { path: '**', redirectTo: '', pathMatch: 'full' }
];
