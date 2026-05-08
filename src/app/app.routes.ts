import { Routes } from '@angular/router';
import { AjustesComponent } from './componentes/ajustes/ajustes/ajustes.component';
import { AdminPanelComponent } from './componentes/admin-panel/admin-panel.component';
import { CompraComponent } from './componentes/compras/compra/compra/compra.component';
import { DetalleCompraComponent } from './componentes/compras/detalleCompra/detalle-compra/detalle-compra.component';
import { CategoriaComponent } from './componentes/categoria/categoria/categoria.component';
import { DashboardComponent } from './componentes/dashboard/dashboard.component';
import { EditarNegocioComponent } from './componentes/editar-negocio/editar-negocio.component';
import { EstanqueComponent } from './componentes/estanque/estanque.component';
import { LogosNenufarComponent } from './componentes/logos-nenufar/logos-nenufar.component';
import { MisLogrosComponent } from './componentes/mis-logros/mis-logros.component';
import { NotificacionesComponent } from './componentes/notificaciones/notificaciones.component';
import { PerfilNegocioComponent } from './componentes/perfil-negocio/perfil-negocio.component';
import { PerfilComponent } from './componentes/perfil/perfil/perfil.component';
import { PerfilPublicoNegocioComponent } from './componentes/perfil-publico-negocio/perfil-publico-negocio.component';
import { PerfilPublicoUsuarioComponent } from './componentes/perfil-publico-usuario/perfil-publico-usuario.component';
import { PortalReseñasComponent } from './componentes/portal-resenas/portal-resenas/portal-resenas.component';
import { PrincipalComponent } from './componentes/principal/principal.component';
import { EleccionRegistroComponent } from './componentes/registro/eleccion-registro/eleccion-registro.component';
import { RegistroComponent } from './componentes/registro/registro/registro.component';
import { RegistroNegocioComponent } from './componentes/registro-negocio/RegistroNegocio.component';
import { ReservasComponent } from './componentes/reservas/reservas.component';
import { HacerReviewComponent } from './componentes/review/review/hacer-review/hacer-review/hacer-review.component';
import { ReviewComponent } from './componentes/review/review/review.component';
import { RutaLocalComponent } from './componentes/ruta-local/ruta-local.component';
import { adminGuard } from './guards/admin.guard';
import { authToEstanqueGuard } from './guards/auth-to-estanque.guard';

export const routes: Routes = [
  { path: '', component: EstanqueComponent },
  { path: 'estanque', component: EstanqueComponent },
  { path: 'admin', component: AdminPanelComponent, canActivate: [adminGuard] },
  { path: 'login', redirectTo: 'estanque', pathMatch: 'full' },
  { path: 'inicio', component: PrincipalComponent },
  { path: 'logos-nenufar', component: LogosNenufarComponent, canActivate: [authToEstanqueGuard] },
  { path: 'mis-logros', component: MisLogrosComponent },
  { path: 'nenuninfo', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'notificaciones', component: NotificacionesComponent },
  { path: 'negocio', redirectTo: 'mi-negocio', pathMatch: 'full' },
  { path: 'ruta-local', component: RutaLocalComponent },
  { path: 'registro-opciones', component: EleccionRegistroComponent },
  { path: 'registro', component: RegistroComponent },
  { path: 'registro-negocio', component: RegistroNegocioComponent },
  { path: 'admin', component: AdminPanelComponent, canActivate: [adminGuard] },
  { path: 'perfil', redirectTo: 'mi-perfil', pathMatch: 'full' },
  { path: 'mi-perfil', component: PerfilComponent, canActivate: [authToEstanqueGuard] },
  { path: 'reservas', component: ReservasComponent, canActivate: [authToEstanqueGuard] },
  { path: 'mi-negocio/dashboard', component: DashboardComponent, canActivate: [authToEstanqueGuard] },
  { path: 'mi-negocio/reservas', component: ReservasComponent, canActivate: [authToEstanqueGuard] },
  { path: 'mi-negocio/editar', component: EditarNegocioComponent, canActivate: [authToEstanqueGuard] },
  { path: 'mi-negocio', component: PerfilNegocioComponent, canActivate: [authToEstanqueGuard] },
  { path: 'usuario/:id', component: PerfilPublicoUsuarioComponent },
  { path: 'negocio/:id', component: PerfilPublicoNegocioComponent },
  { path: 'reseñas', component: PortalReseñasComponent },
  { path: 'review', component: HacerReviewComponent },
  { path: 'likes', component: ReviewComponent },
  { path: 'ajustes', component: AjustesComponent },
  { path: 'compras', component: CompraComponent },
  { path: 'compras/:id', component: DetalleCompraComponent },
  { path: 'categorias', component: CategoriaComponent },
  // Ruta pública de negocio por nickname/slug. Debe quedar al final de las rutas
  // concretas para no interceptar pantallas como /review, /ajustes o /compras.
  { path: ':slug', component: PerfilPublicoNegocioComponent },
  { path: '**', redirectTo: '', pathMatch: 'full' }
];
