import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, of, switchMap, tap } from 'rxjs';
import { getUserErrorMessage } from '../../../core/errors/error-parser';
import { AuthService } from '../../../servicios/authService/auth.service';
import { NegocioService } from '../../../servicios/negocioService/negocio.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly negocioService = inject(NegocioService);
  private readonly router = inject(Router);

  readonly cargando = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    this.authService.me()
      .pipe(
        switchMap((usuario) => {
          if (!usuario) {
            this.cargando.set(false);
            void this.router.navigate(['/login'], {
              queryParams: { returnUrl: '/perfil' },
            });
            return EMPTY;
          }

          const negocioEnSesion = usuario.negocio as { id?: number } | null | undefined;
          const negocioIdEnSesion = Number(negocioEnSesion?.id);
          if (Number.isFinite(negocioIdEnSesion) && negocioIdEnSesion > 0) {
            return this.negocioService.getNegocioById(negocioIdEnSesion).pipe(
              tap((negocio) => {
                const routeKey = this.negocioService.getRouteKey(negocio);
                if (routeKey) {
                  void this.router.navigate(['/', routeKey], { replaceUrl: true });
                  return;
                }

                this.error.set('La sesión está activa, pero no hemos podido resolver una URL pública para tu negocio.');
              }),
              catchError(() => this.negocioService.getMine()),
            );
          }

          return this.negocioService.getMine().pipe(
            tap((negocio) => {
              const routeKeyNegocio = this.negocioService.getRouteKey(negocio);
              if (routeKeyNegocio) {
                void this.router.navigate(['/', routeKeyNegocio], { replaceUrl: true });
                return;
              }

              if (usuario.nickname?.trim()) {
                void this.router.navigate(['/usuario', usuario.nickname.trim()], { replaceUrl: true });
                return;
              }

              this.error.set('La sesion esta activa, pero no hemos podido resolver una URL publica para tu perfil.');
            }),
            catchError(() => {
              if (usuario.nickname?.trim()) {
                void this.router.navigate(['/usuario', usuario.nickname.trim()], { replaceUrl: true });
                return EMPTY;
              }

              this.error.set('La sesion esta activa, pero no hemos podido resolver tu perfil.');
              return of(null);
            }),
          );
        }),
      )
      .subscribe({
        complete: () => this.cargando.set(false),
        error: (error: unknown) => {
          this.cargando.set(false);
          this.error.set(getUserErrorMessage(error, 'No hemos podido cargar tu perfil.'));
        },
      });
  }
}
