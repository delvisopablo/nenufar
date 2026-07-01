import { DOCUMENT } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
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
export class AppComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly cuentaAtrasService = inject(CuentaAtrasService);
  private readonly destroy$ = new Subject<void>();

  readonly layoutService = inject(LayoutService);
  readonly mostrarApp = signal(false);
  readonly ocultarMenu = signal(false);
  readonly ocultarLayout = signal(false);
  readonly bloquearScroll = signal(false);
  readonly mostrarRutaIndependiente = signal(false);

  ngOnInit(): void {
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
    const accesoDesbloqueado = this.tieneAccesoDesbloqueado();
    this.ocultarMenu.set(!this.layoutService.shouldShowMenu(ruta));
    this.ocultarLayout.set(!this.layoutService.shouldShowLayout(ruta));
    this.mostrarRutaIndependiente.set(this.esRutaIndependiente(ruta));
    this.actualizarScrollRuta(ruta);

    if (accesoDesbloqueado) {
      this.mostrarApp.set(true);
    }

    if (!accesoDesbloqueado && !this.esRutaDeAcceso(ruta)) {
      void this.router.navigate(['/estanque']);
    }
  }

  private tieneAccesoDesbloqueado(): boolean {
    return localStorage.getItem('accesoPermitido') === 'true';
  }

  private esRutaDeAcceso(ruta: string): boolean {
    return [
      '/',
      '/estanque',
      '/login',
      '/registro',
      '/registro-opciones',
      '/registro-negocio',
      '/confirmar-email',
      '/recuperar-password',
      '/restablecer-password',
    ].includes(this.normalizarRuta(ruta));
  }

  private esRutaIndependiente(ruta: string): boolean {
    return [
      '/login',
      '/registro',
      '/registro-opciones',
      '/registro-negocio',
      '/confirmar-email',
      '/recuperar-password',
      '/restablecer-password',
    ].includes(this.normalizarRuta(ruta));
  }

  private normalizarRuta(ruta: string): string {
    return ruta.split('?')[0].split('#')[0] || '/';
  }

  private actualizarScrollRuta(ruta: string): void {
    const bloquear = this.layoutService.shouldDisablePageScroll(ruta);

    this.bloquearScroll.set(bloquear);
    this.document.documentElement.classList.toggle('no-scroll', bloquear);
    this.document.body.classList.toggle('no-scroll', bloquear);
  }
}
