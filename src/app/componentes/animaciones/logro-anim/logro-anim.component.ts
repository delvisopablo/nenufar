import { Component, signal } from '@angular/core';

interface FlowerParticle {
  tx: string;
  ty: string;
  delay: string;
  scale: string;
  rotate: string;
}

const META = 5;

@Component({
  selector: 'app-logro-anim',
  standalone: true,
  imports: [],
  templateUrl: './logro-anim.component.html',
  styleUrl: './logro-anim.component.scss',
})
export class LogroAnimComponent {
  readonly pasos = [1, 2, 3, 4, 5];
  progreso = signal(0);
  estado = signal<'progresando' | 'consiguiendo' | 'conseguido'>('progresando');
  flores = signal<FlowerParticle[]>([]);
  meta = META;

  get porcentaje(): number {
    return (this.progreso() / META) * 100;
  }

  publicar(): void {
    if (this.estado() !== 'progresando') return;
    const nuevo = this.progreso() + 1;
    this.progreso.set(nuevo);

    if (nuevo >= META) {
      this.estado.set('consiguiendo');
      this.flores.set(this.generarFlores());
      setTimeout(() => this.estado.set('conseguido'), 800);
    }
  }

  reiniciar(): void {
    this.progreso.set(0);
    this.estado.set('progresando');
    this.flores.set([]);
  }

  private generarFlores(): FlowerParticle[] {
    return Array.from({ length: 18 }, (_, i) => {
      const angulo = (i / 18) * 2 * Math.PI;
      const dist = 90 + Math.random() * 80;
      return {
        tx: `${Math.round(Math.cos(angulo) * dist)}px`,
        ty: `${Math.round(Math.sin(angulo) * dist)}px`,
        delay: `${Math.floor(i * 35)}ms`,
        scale: `${0.5 + Math.random() * 0.8}`,
        rotate: `${Math.floor(Math.random() * 360)}deg`,
      };
    });
  }
}
