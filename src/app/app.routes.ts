import { Routes } from '@angular/router';
import { AjustesComponent } from './componentes/ajustes/ajustes/ajustes.component';
import { EditarNegocioComponent } from './componentes/editar-negocio/editar-negocio.component';
import { EstanqueComponent } from './componentes/estanque/estanque.component';
import { LoginComponent } from './componentes/login/login/login.component';
import { PerfilNegocioComponent } from './componentes/perfil-negocio/perfil-negocio.component';
import { PerfilComponent } from './componentes/perfil/perfil/perfil.component';
import { PortalReseñasComponent } from './componentes/portal-resenas/portal-resenas/portal-resenas.component';
import { PrincipalComponent } from './componentes/principal/principal.component';
import { EleccionRegistroComponent } from './componentes/registro/eleccion-registro/eleccion-registro.component';
import { RegistroComponent } from './componentes/registro/registro/registro.component';
import { RegistroNegocioComponent } from './componentes/registro-negocio/RegistroNegocio.component';
import { HacerReviewComponent } from './componentes/review/review/hacer-review/hacer-review/hacer-review.component';
import { ReviewComponent } from './componentes/review/review/review.component';
import { RutaLocalComponent } from './componentes/ruta-local/ruta-local.component';

export const routes: Routes = [
  { path: '', component: EstanqueComponent },
  { path: 'estanque', component: EstanqueComponent },
  { path: 'login', component: LoginComponent },
  { path: 'inicio', component: PrincipalComponent },
  { path: 'ruta-local', component: RutaLocalComponent },
  { path: 'registro-opciones', component: EleccionRegistroComponent },
  { path: 'registro', component: RegistroComponent },
  { path: 'registro-negocio', component: RegistroNegocioComponent },
  { path: 'perfil/:id', component: PerfilComponent },
  { path: 'negocio/:id', component: PerfilNegocioComponent },
  { path: 'reseñas', component: PortalReseñasComponent },
  { path: 'review', component: HacerReviewComponent },
  { path: 'negocio-editar/:id', component: EditarNegocioComponent },
  { path: 'likes', component: ReviewComponent },
  { path: 'ajustes', component: AjustesComponent },
  { path: '**', redirectTo: '', pathMatch: 'full' }
];
