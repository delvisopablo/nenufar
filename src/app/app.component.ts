import { CuentaAtrasService } from './servicios/cuentaAtrasServicio/cuenta-atras.service';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { HeaderComponent } from './componentes/HyF/header/header.component';
import { PrincipalComponent } from './componentes/principal/principal.component';

import { JuegoComponent } from './componentes/juego/juego.component';
import { MenuComponent } from './componentes/menu-lateral/menu/menu.component';
import { FooterComponent } from './componentes/HyF/footer/footer.component';
import { LandingComponent } from './componentes/landing/landing/landing.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, PrincipalComponent, JuegoComponent, MenuComponent, FooterComponent, LandingComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  countdownFinished = false;

  constructor(private CuentaAtrasService: CuentaAtrasService) {}

  ngOnInit() {
    this.CuentaAtrasService.countdownFinished$.subscribe(finished => {
      this.countdownFinished = finished;
      if (this.countdownFinished) {
        // Lógica para mostrar el contenido o realizar alguna acción
        console.log("Cuenta regresiva terminada. Desbloquear contenido.");
      }
    });
  }
}