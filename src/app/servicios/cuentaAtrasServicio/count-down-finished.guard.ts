import { CanActivateFn } from '@angular/router';
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { CuentaAtrasService } from './cuenta-atras.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})

export class CountdownFinishedGuard implements CanActivate{

  constructor(private CuentaAtrasService: CuentaAtrasService, private router: Router) {}

  canActivate(): Observable<boolean> {
    return this.CuentaAtrasService.countdownFinished$.pipe(
      map(finished => {
        if (finished) {
          this.router.navigate(['/']);  // Redirige si la cuenta regresiva ha terminado
          return false;  // No permitir acceso a /landing
        }
        return true;  // Permitir acceso si la cuenta regresiva no ha terminado
      })
    );
  }
};
