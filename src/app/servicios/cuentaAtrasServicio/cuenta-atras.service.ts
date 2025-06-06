import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CuentaAtrasService {

  private countdownFinishedSubject = new BehaviorSubject<boolean>(false);
  countdownFinished$ = this.countdownFinishedSubject.asObservable();

  // Método para actualizar el estado
  finishCountdown() {
    this.countdownFinishedSubject.next(true);
  }

  private accesoDesbloqueado$ = new BehaviorSubject<boolean>(false);
  accesoDesbloqueadoObs$ = this.accesoDesbloqueado$.asObservable();
  
  desbloquearAcceso() {
    this.accesoDesbloqueado$.next(true);}

  // constructor() { }
}
