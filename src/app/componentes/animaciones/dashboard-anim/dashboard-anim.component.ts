import { Component, OnInit, signal } from '@angular/core';

interface Metrica {
  icono: string;
  label: string;
  valorFinal: number;
  prefijo: string;
  sufijo: string;
  color: string;
  fondo: string;
  valorActual: number;
}

interface BarraDia {
  dia: string;
  porcentaje: number;
  animado: boolean;
}

interface ReservaItem {
  hora: string;
  nombre: string;
  personas: number;
}

@Component({
  selector: 'app-dashboard-anim',
  standalone: true,
  imports: [],
  templateUrl: './dashboard-anim.component.html',
  styleUrl: './dashboard-anim.component.scss',
})
export class DashboardAnimComponent implements OnInit {

  metricas = signal<Metrica[]>([
    { icono: '', label: 'Ventas',     valorFinal: 2840, prefijo: '€', sufijo: '',   color: '#f45c9c', fondo: 'rgba(244,92,156,0.1)',  valorActual: 0 },
    { icono: '', label: 'Reservas',   valorFinal: 47,   prefijo: '',  sufijo: '',   color: '#ee8d54', fondo: 'rgba(238,141,84,0.1)',  valorActual: 0 },
    { icono: '', label: 'Reseñas',    valorFinal: 23,   prefijo: '',  sufijo: '',   color: '#ffd4e8', fondo: 'rgba(255,212,232,0.08)', valorActual: 0 },
    { icono: '', label: 'Nota media', valorFinal: 47,   prefijo: '',  sufijo: '★',  color: '#a8f0c8', fondo: 'rgba(168,240,200,0.08)', valorActual: 0 },
  ]);

  barras = signal<BarraDia[]>([
    { dia: 'L', porcentaje: 60,  animado: false },
    { dia: 'M', porcentaje: 85,  animado: false },
    { dia: 'X', porcentaje: 45,  animado: false },
    { dia: 'J', porcentaje: 100, animado: false },
    { dia: 'V', porcentaje: 70,  animado: false },
    { dia: 'S', porcentaje: 90,  animado: false },
    { dia: 'D', porcentaje: 30,  animado: false },
  ]);

  readonly reservaItems: ReservaItem[] = [
    { hora: '11:00', nombre: 'Ana García',  personas: 2 },
    { hora: '13:30', nombre: 'Luis Martín', personas: 4 },
    { hora: '16:00', nombre: 'Sara López',  personas: 1 },
  ];

  ngOnInit(): void {
    this.metricas().forEach((m, idx) => {
      setTimeout(() => this.countUp(m, idx), idx * 180);
    });
    setTimeout(() => {
      this.barras.update(bs => bs.map(b => ({ ...b, animado: true })));
    }, 300);
  }

  private countUp(m: Metrica, idx: number): void {
    const duracion = 900;
    const pasos = 40;
    const intervalo = duracion / pasos;
    let paso = 0;

    const timer = setInterval(() => {
      paso++;
      const progreso = this.easeOut(paso / pasos);
      const valor = Math.round(m.valorFinal * progreso);
      this.metricas.update(ms =>
        ms.map((x, i) => i === idx ? { ...x, valorActual: valor } : x)
      );
      if (paso >= pasos) clearInterval(timer);
    }, intervalo);
  }

  private easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  formatValor(m: Metrica): string {
    if (m.label === 'Nota media') return (m.valorActual / 10).toFixed(1);
    if (m.label === 'Ventas') return m.valorActual.toLocaleString('es-ES');
    return String(m.valorActual);
  }
}
