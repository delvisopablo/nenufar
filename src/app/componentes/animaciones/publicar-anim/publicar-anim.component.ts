import { Component, Input, signal, OnInit } from '@angular/core';

export type PublicarModo = 'resena' | 'promo';

interface Particula {
  tx: string;
  ty: string;
  emoji: string;
  delay: string;
  size: string;
}

@Component({
  selector: 'app-publicar-anim',
  standalone: true,
  imports: [],
  templateUrl: './publicar-anim.component.html',
  styleUrl: './publicar-anim.component.scss',
})
export class PublicarAnimComponent implements OnInit {
  @Input() modo: PublicarModo = 'resena';

  estado = signal<'escribiendo' | 'explotando' | 'listo'>('escribiendo');
  estrellas = signal(0);
  estrellasHover = signal(0);
  texto = signal('');
  descuento = signal('20%');
  particulas = signal<Particula[]>([]);

  get config() {
    return this.modo === 'resena'
      ? {
          icono: '⭐',
          titulo: 'Escribe tu reseña',
          placeholder: 'Me ha encantado el sitio, el ambiente es genial...',
          boton: 'Publicar reseña',
          exito: '¡Reseña publicada!',
          emojiExplosion: ['⭐', '🌸', '✨', '💫', '🎉', '❤️'],
          colores: ['#d97706', '#f59e0b', '#fbbf24', '#0f766e', '#6d28d9'],
        }
      : {
          icono: '🎁',
          titulo: 'Nueva promoción',
          placeholder: 'Describe tu oferta: menú del día, descuento...',
          boton: 'Publicar promo',
          exito: '¡Promoción publicada!',
          emojiExplosion: ['🎁', '🎊', '🔥', '✨', '🏷️', '🌟'],
          colores: ['#1d4ed8', '#7c3aed', '#059669', '#d97706', '#dc2626'],
        };
  }

  ngOnInit(): void {
    this.particulas.set(this.generarParticulas());
    this.escribirDemo();
  }

  private escribirDemo(): void {
    const frase = this.config.placeholder;
    let i = 0;
    const intervalo = setInterval(() => {
      this.texto.set(frase.slice(0, i));
      i++;
      if (i > frase.length) {
        clearInterval(intervalo);
        if (this.modo === 'resena') {
          setTimeout(() => this.seleccionarEstrella(4), 400);
        }
      }
    }, 38);
  }

  seleccionarEstrella(n: number): void {
    if (this.estado() !== 'escribiendo') return;
    this.estrellas.set(n);
  }

  publicar(): void {
    if (this.estado() !== 'escribiendo') return;
    this.estado.set('explotando');
    setTimeout(() => this.estado.set('listo'), 900);
  }

  reiniciar(): void {
    this.estado.set('escribiendo');
    this.estrellas.set(0);
    this.texto.set('');
    this.particulas.set(this.generarParticulas());
    setTimeout(() => this.escribirDemo(), 300);
  }

  private generarParticulas(): Particula[] {
    const emojis = this.config.emojiExplosion;
    return Array.from({ length: 16 }, (_, i) => {
      const angulo = (i / 16) * 2 * Math.PI;
      const dist = 60 + Math.random() * 50;
      return {
        tx: `${Math.round(Math.cos(angulo) * dist)}px`,
        ty: `${Math.round(Math.sin(angulo) * dist)}px`,
        emoji: emojis[i % emojis.length],
        delay: `${i * 25}ms`,
        size: `${12 + Math.floor(Math.random() * 8)}px`,
      };
    });
  }

  rango(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i + 1);
  }
}
