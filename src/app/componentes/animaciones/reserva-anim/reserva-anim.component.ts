import { Component, signal, OnInit } from '@angular/core';

type SlotEstado = 'libre' | 'ocupado' | 'seleccionado' | 'confirmado';

interface Slot {
  hora: string;
  dia: string;
  estado: SlotEstado;
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const HORAS = ['10:00', '11:30', '13:00', '16:00', '17:30'];

const OCUPADOS = new Set([
  'Lun-10:00', 'Lun-13:00',
  'Mar-11:30', 'Mar-17:30',
  'Mié-10:00', 'Mié-16:00',
  'Jue-13:00', 'Jue-11:30',
  'Vie-10:00', 'Vie-17:30',
]);

@Component({
  selector: 'app-reserva-anim',
  standalone: true,
  imports: [],
  templateUrl: './reserva-anim.component.html',
  styleUrl: './reserva-anim.component.scss',
})
export class ReservaAnimComponent implements OnInit {
  readonly dias = DIAS;
  readonly horas = HORAS;
  slots = signal<Map<string, SlotEstado>>(new Map());
  slotSeleccionado = signal<string | null>(null);
  confirmando = signal(false);
  confirmado = signal(false);

  ngOnInit(): void {
    const mapa = new Map<string, SlotEstado>();
    DIAS.forEach(d =>
      HORAS.forEach(h => {
        const key = `${d}-${h}`;
        mapa.set(key, OCUPADOS.has(key) ? 'ocupado' : 'libre');
      })
    );
    this.slots.set(mapa);
  }

  getEstado(dia: string, hora: string): SlotEstado {
    return this.slots().get(`${dia}-${hora}`) ?? 'libre';
  }

  key(dia: string, hora: string): string {
    return `${dia}-${hora}`;
  }

  clickSlot(dia: string, hora: string): void {
    const k = this.key(dia, hora);
    if (this.getEstado(dia, hora) !== 'libre') return;
    if (this.confirmando() || this.confirmado()) return;

    const prev = this.slotSeleccionado();
    if (prev) {
      const mapa = new Map(this.slots());
      mapa.set(prev, 'libre');
      this.slots.set(mapa);
    }

    const mapa2 = new Map(this.slots());
    mapa2.set(k, 'seleccionado');
    this.slots.set(mapa2);
    this.slotSeleccionado.set(k);
    this.confirmado.set(false);
  }

  confirmar(): void {
    const k = this.slotSeleccionado();
    if (!k) return;
    this.confirmando.set(true);
    setTimeout(() => {
      const mapa = new Map(this.slots());
      mapa.set(k, 'confirmado');
      this.slots.set(mapa);
      this.confirmando.set(false);
      this.confirmado.set(true);
    }, 800);
  }

  reiniciar(): void {
    this.confirmado.set(false);
    this.slotSeleccionado.set(null);
    this.ngOnInit();
  }
}
