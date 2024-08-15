import { Routes } from '@angular/router';
import { HeaderComponent } from './componentes/HyF/header/header.component';
import { PrincipalComponent } from './componentes/principal/principal.component';
import { MenuComponent } from './componentes/menu-lateral/menu/menu.component';

import { FooterComponent } from './componentes/HyF/footer/footer.component';
import { AjustesComponent } from './componentes/ajustes/ajustes/ajustes.component';
import { UsuarioComponent } from './componentes/usuario/usuario/usuario.component';
import { ReviewComponent } from './componentes/review/review/review.component';
import { PromocionComponent } from './componentes/promocion/promocion/promocion.component';
import { LoginComponent } from './componentes/login/login/login.component';
import { HacerReviewComponent } from './componentes/review/review/hacer-review/hacer-review/hacer-review.component';
import { LandingComponent } from './componentes/landing/landing/landing.component';
import { CountdownFinishedGuard } from './servicios/cuentaAtrasServicio/count-down-finished.guard';


export const routes: Routes = [
    { path: '', component: PrincipalComponent },
    { path: 'holaaa', component: LandingComponent, canActivate: [CountdownFinishedGuard] },
    { path: 'login', component: LoginComponent },
    { path: 'usuario', component: UsuarioComponent },
    { path: 'reviews', component: ReviewComponent },
    { path: 'review', component: HacerReviewComponent },
    { path: 'likes', component: ReviewComponent },
    { path: 'promociones', component: PromocionComponent },
    { path: 'ajustes', component: AjustesComponent },
    { path: '**', redirectTo: '/holaaa' }

];
