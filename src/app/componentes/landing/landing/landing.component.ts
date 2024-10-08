import { CuentaAtrasService } from './../../../servicios/cuentaAtrasServicio/cuenta-atras.service';
import { AsyncPipe } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { interval, map, Observable } from 'rxjs';
import { HeaderComponent } from "../../HyF/header/header.component";
import { FooterComponent } from "../../HyF/footer/footer.component";

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, AsyncPipe, HeaderComponent, FooterComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css' 
})
export class LandingComponent implements OnInit, OnDestroy {
  name = 'Nenúfar';
  countdownSubscription: any;
  targetDay = new Date(2024, 9, 23, 23, 59, 59).getTime(); // Octubre es 9
  countdownArray: { value: string, label: string }[] = [];
  countdownObs$!: Observable<{ value: string, label: string }[]>;

  constructor(private CuentaAtrasService: CuentaAtrasService, private router: Router) {}

  ngOnInit() {
    this.countdownObs$ = interval(1000).pipe(map(() => this.countdownTimer()));
    this.countdownSubscription = this.countdownObs$.subscribe(time => {
      if (!time.length) {
        this.CuentaAtrasService.finishCountdown();  // Llamar al servicio cuando la cuenta regresiva termine
        this.router.navigate(['/']);   // Redirige a la nueva ruta principal

      } else {
        this.countdownArray = time;
      }
    });
  }

  countdownTimer(): { value: string, label: string }[] {
    const totalSeconds = Math.floor((this.targetDay - Date.now()) / 1000);

    if (totalSeconds <= 0) {
      return [];  // Devuelve un array vacío para indicar que la cuenta atrás ha terminado
    }

    const days = Math.floor(totalSeconds / (60 * 60 * 24));
    const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const remainingSeconds = totalSeconds % 60;

    const formattedDays = days < 10 ? '0' + days : String(days);
    const formattedHours = hours < 10 ? '0' + hours : String(hours);
    const formattedMinutes = minutes < 10 ? '0' + minutes : String(minutes);
    const formattedSeconds = remainingSeconds < 10 ? '0' + remainingSeconds : String(remainingSeconds);

    return [
      { value: formattedDays, label: 'Días' },
      { value: formattedHours, label: 'Horas' },
      { value: formattedMinutes, label: 'Minutos' },
      { value: formattedSeconds, label: 'Segundos' }
    ];
  }

  formulario(){
    window.open('https://forms.gle/7HWTa2HieK5hTYmJ8', '_blank');
  }

  noTocar(){
    alert("!No toques!! Por qué tocas?!")    
    window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank');
  }

  premio(){
    const email = prompt("Por favor, introduce tu correo electrónico para obtener el premio:");
    if (email) {
      // Aquí podrías validar el email o enviarlo a un servidor
      alert("¡Felicidades! Recibirás tu premio pronto en " + email);
      // Ejemplo: redirigir a una página de premio
      // this.router.navigate(['/premio']);
    } else {
      alert("Necesitas proporcionar un correo electrónico para obtener el premio.");
    }
  }

  ngOnDestroy(): void {
    this.countdownSubscription.unsubscribe();
  }
}