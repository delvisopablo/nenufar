import { CuentaAtrasService } from './servicios/cuentaAtrasServicio/cuenta-atras.service';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { HeaderComponent } from './componentes/HyF/header/header.component';
import { PrincipalComponent } from './componentes/principal/principal.component';
import { JuegoComponent } from './componentes/juego/juego.component';
import { MenuComponent } from './componentes/menu/menu/menu.component';
import { FooterComponent } from './componentes/HyF/footer/footer.component';
import { LandingComponent } from './componentes/landing/landing/landing.component';
import { LoginComponent } from './componentes/login/login/login.component';
import { LayoutService } from './servicios/layoutServicio/layout.service';
import { RegistroComponent } from './componentes/registro/registro/registro.component';
import { AjustesComponent } from './componentes/ajustes/ajustes/ajustes.component';
import { UsuarioComponent } from './componentes/usuario/usuario/usuario.component';
import { ReviewComponent } from './componentes/review/review/review.component';
import { PerfilComponent } from './componentes/perfil/perfil/perfil.component';
import { HacerReviewComponent } from './componentes/review/review/hacer-review/hacer-review/hacer-review.component';
import { CrearResenaModalComponent } from './componentes/crear-resena/crear-resena-modal/crear-resena-modal.component';
import { PortalReseñasComponent } from './componentes/portal-resenas/portal-resenas/portal-resenas.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, LandingComponent,],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  countdownFinished = false;
  private router = inject(Router);
  layoutService = inject(LayoutService);
  mostrarLayout = signal(true);
  mostrarApp = signal(false);
  ocultarMenu = signal(false);
  ocultarLayout = signal(false);

  constructor(private CuentaAtrasService: CuentaAtrasService) {}

  ngOnInit() {
    setTimeout(() => {
    const urlActual = this.router.url;

  // Si la recarga no es desde '/', redirigimos
  if (urlActual !== '/') {
    this.router.navigate(['/']);
  }

});

    this.router.events.subscribe(() => {
      const ruta = this.router.url;
      this.ocultarMenu.set(!this.layoutService.shouldShowMenu(ruta));
      this.ocultarLayout.set(!this.layoutService.shouldShowLayout(ruta));
    });


    this.router.events.subscribe(() => {
      const rutaActual = this.router.url;
      this.mostrarLayout.set(!['/login', '/holaaa'].includes(rutaActual));
    });
  
  
    
  this.CuentaAtrasService.accesoDesbloqueadoObs$.subscribe(ok => {
    this.mostrarApp.set(ok);

    });
  }

 


}





