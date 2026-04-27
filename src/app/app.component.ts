import { DOCUMENT } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { HeaderComponent } from './componentes/HyF/header/header.component';
import { EstanqueComponent } from './componentes/estanque/estanque.component';
import { AuthService } from './servicios/authService/auth.service';
import { CuentaAtrasService } from './servicios/cuentaAtrasServicio/cuenta-atras.service';
import { LayoutService } from './servicios/layoutServicio/layout.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, EstanqueComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly cuentaAtrasService = inject(CuentaAtrasService);
  private readonly authService = inject(AuthService);
  private readonly destroy$ = new Subject<void>();

  readonly layoutService = inject(LayoutService);
  readonly mostrarApp = signal(false);
  readonly ocultarMenu = signal(false);
  readonly ocultarLayout = signal(false);
  readonly bloquearScroll = signal(false);

  ngOnInit(): void {
    this.authService.hydrateSession()
      .pipe(takeUntil(this.destroy$))
      .subscribe();
    this.sincronizarAccesoPersistido();
    this.actualizarEstadoRuta(this.router.url);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        this.actualizarEstadoRuta(event.urlAfterRedirects);
      });

    this.cuentaAtrasService.accesoDesbloqueadoObs$
      .pipe(takeUntil(this.destroy$))
      .subscribe((ok) => {
        this.mostrarApp.set(ok || this.tieneAccesoDesbloqueado());
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.document.documentElement.classList.remove('no-scroll');
    this.document.body.classList.remove('no-scroll');
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
    this.actualizarScrollRuta(ruta);

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

  private actualizarScrollRuta(ruta: string): void {
    const bloquear = this.layoutService.shouldDisablePageScroll(ruta);

    this.bloquearScroll.set(bloquear);
    this.document.documentElement.classList.toggle('no-scroll', bloquear);
    this.document.body.classList.toggle('no-scroll', bloquear);
  }
}
