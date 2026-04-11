import { Component, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { HeaderComponent } from './componentes/HyF/header/header.component';
import { EstanqueComponent } from './componentes/estanque/estanque.component';
import { CuentaAtrasService } from './servicios/cuentaAtrasServicio/cuenta-atras.service';
import { LayoutService } from './servicios/layoutServicio/layout.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, EstanqueComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly cuentaAtrasService = inject(CuentaAtrasService);

  readonly layoutService = inject(LayoutService);
  readonly mostrarApp = signal(false);
  readonly ocultarMenu = signal(false);
  readonly ocultarLayout = signal(false);

  ngOnInit(): void {
    this.sincronizarAccesoPersistido();
    this.actualizarEstadoRuta(this.router.url);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.actualizarEstadoRuta(event.urlAfterRedirects);
      });

    this.cuentaAtrasService.accesoDesbloqueadoObs$.subscribe((ok) => {
      this.mostrarApp.set(ok || this.tieneAccesoDesbloqueado());
    });
  }

  private sincronizarAccesoPersistido(): void {
    if (!this.tieneAccesoDesbloqueado()) {
      return;
    }

    this.mostrarApp.set(true);
    this.cuentaAtrasService.desbloquearAcceso();
  }

  private actualizarEstadoRuta(ruta: string): void {
    this.ocultarMenu.set(!this.layoutService.shouldShowMenu(ruta));
    this.ocultarLayout.set(!this.layoutService.shouldShowLayout(ruta));

    if (!this.tieneAccesoDesbloqueado() && !this.esRutaDeAcceso(ruta)) {
      void this.router.navigate(['/estanque']);
    }
  }

  private tieneAccesoDesbloqueado(): boolean {
    return localStorage.getItem('accesoPermitido') === 'true';
  }

  private esRutaDeAcceso(ruta: string): boolean {
    return ['/', '/estanque'].includes(ruta);
  }
}
