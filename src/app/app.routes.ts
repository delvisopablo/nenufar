import { Routes } from '@angular/router';
import { AjustesComponent } from './componentes/ajustes/ajustes/ajustes.component';
import { CompraComponent } from './componentes/compras/compra/compra/compra.component';
import { DetalleCompraComponent } from './componentes/compras/detalleCompra/detalle-compra/detalle-compra.component';
import { CategoriaComponent } from './componentes/categoria/categoria/categoria.component';
import { DashboardComponent } from './componentes/dashboard/dashboard.component';
import { EditarNegocioComponent } from './componentes/editar-negocio/editar-negocio.component';
import { EstanqueComponent } from './componentes/estanque/estanque.component';
import { LoginComponent } from './componentes/login/login/login.component';
import { LogosNenufarComponent } from './componentes/logos-nenufar/logos-nenufar.component';
import { MisLogrosComponent } from './componentes/mis-logros/mis-logros.component';
import { NotificacionesComponent } from './componentes/notificaciones/notificaciones.component';
import { PerfilUsuarioComponent } from './componentes/perfil-usuario/perfil-usuario.component';
import { PerfilNegocioComponent } from './componentes/perfil-negocio/perfil-negocio.component';
import { PerfilComponent } from './componentes/perfil/perfil/perfil.component';
import { PortalReseñasComponent } from './componentes/portal-resenas/portal-resenas/portal-resenas.component';
import { PrincipalComponent } from './componentes/principal/principal.component';
import { EleccionRegistroComponent } from './componentes/registro/eleccion-registro/eleccion-registro.component';
import { RegistroComponent } from './componentes/registro/registro/registro.component';
import { RegistroNegocioComponent } from './componentes/registro-negocio/RegistroNegocio.component';
import { ReservasComponent } from './componentes/reservas/reservas.component';
import { HacerReviewComponent } from './componentes/review/review/hacer-review/hacer-review/hacer-review.component';
import { ReviewComponent } from './componentes/review/review/review.component';
import { RutaLocalComponent } from './componentes/ruta-local/ruta-local.component';

export const routes: Routes = [
  { path: '', component: EstanqueComponent },
  { path: 'estanque', component: EstanqueComponent },
  { path: 'login', component: LoginComponent },
  { path: 'inicio', component: PrincipalComponent },
  { path: 'logos-nenufar', component: LogosNenufarComponent },
  { path: 'mis-logros', component: MisLogrosComponent },
  { path: 'nenuninfo', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'notificaciones', component: NotificacionesComponent },
  { path: 'negocio', redirectTo: 'perfil', pathMatch: 'full' },
  { path: 'ruta-local', component: RutaLocalComponent },
  { path: 'registro-opciones', component: EleccionRegistroComponent },
  { path: 'registro', component: RegistroComponent },
  { path: 'registro-negocio', component: RegistroNegocioComponent },
  { path: 'perfil', component: PerfilComponent },
  { path: 'usuario/:nickname', component: PerfilUsuarioComponent },
  { path: 'reseñas', component: PortalReseñasComponent },
  { path: 'review', component: HacerReviewComponent },
  { path: 'likes', component: ReviewComponent },
  { path: 'ajustes', component: AjustesComponent },
  { path: 'compras', component: CompraComponent },
  { path: 'compras/:id', component: DetalleCompraComponent },
  { path: 'categorias', component: CategoriaComponent },
  { path: ':nickname/dashboard', component: DashboardComponent },
  { path: ':nickname/reservas', component: ReservasComponent },
  { path: ':nickname/editar', component: EditarNegocioComponent },
  { path: ':nickname', component: PerfilNegocioComponent },
  { path: '**', redirectTo: '', pathMatch: 'full' }
];
