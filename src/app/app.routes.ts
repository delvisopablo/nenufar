import { Routes } from '@angular/router';
import { HeaderComponent } from './componentes/HyF/header/header.component';
import { PrincipalComponent } from './componentes/principal/principal.component';
import { MenuComponent } from './componentes/menu/menu/menu.component';
import { LoginComponent } from './componentes/login/login/login.component';
import { EleccionRegistroComponent } from './componentes/registro/eleccion-registro/eleccion-registro.component';
import { FooterComponent } from './componentes/HyF/footer/footer.component';
import { AjustesComponent } from './componentes/ajustes/ajustes/ajustes.component';
import { UsuarioComponent } from './componentes/usuario/usuario/usuario.component';
import { ReviewComponent } from './componentes/review/review/review.component';
import { PerfilComponent } from './componentes/perfil/perfil/perfil.component';
import { HacerReviewComponent } from './componentes/review/review/hacer-review/hacer-review/hacer-review.component';
import { LandingComponent } from './componentes/landing/landing/landing.component';
import { CountdownFinishedGuard } from './servicios/cuentaAtrasServicio/count-down-finished.guard';
import { RegistroComponent } from './componentes/registro/registro/registro.component';
import { PortalReseñasComponent } from './componentes/portal-resenas/portal-resenas/portal-resenas.component';
import { RegistroNegocioComponent } from './componentes/registro-negocio/RegistroNegocio.component';
import { PerfilNegocioComponent } from './componentes/perfil-negocio/perfil-negocio.component';
import { EditarNegocioComponent } from './componentes/editar-negocio/editar-negocio.component';
export const routes: Routes = [
    { path: '', component: LandingComponent },
    { path: 'login', component: LoginComponent },
    { path: 'inicio', component: PrincipalComponent },
    { path: 'registro-opciones', component: EleccionRegistroComponent },
    { path: 'registro', component: RegistroComponent},
    { path: 'registro-negocio', component: RegistroNegocioComponent },
    { path: 'perfil/:id', component: PerfilComponent},
    { path: 'negocio/:id', component: PerfilNegocioComponent },
    { path: 'reseñas', component: PortalReseñasComponent },    // { path: 'usuario', component: UsuarioComponent },
    { path: 'review', component: HacerReviewComponent },
    { path: 'negocio-editar/:id', component: EditarNegocioComponent },
    { path: 'likes', component: ReviewComponent },
    // { path: 'promociones', component: CorrectExportedName },
    { path: 'ajustes', component: AjustesComponent },
    { path: '**', redirectTo: '', pathMatch: 'full' }
  ];
  
