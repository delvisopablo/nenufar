import { Component, signal, OnInit } from '@angular/core';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HORAS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '16:00', '17:00', '18:00', '19:00', '20:00',
];

const DEFAULTS: Record<string, number[]> = {
  'Lun': [1, 2, 3, 4, 6, 7, 8, 9],
  'Mar': [1, 2, 3, 4, 6, 7, 8, 9],
  'Mié': [1, 2, 3, 4, 6, 7, 8, 9],
  'Jue': [1, 2, 3, 4, 6, 7, 8, 9],
  'Vie': [1, 2, 3, 4, 6, 7, 8, 9],
  'Sáb': [1, 2, 3, 4],
  'Dom': [],
};

type SlotState = 'open' | 'closed';
type SaveState = 'idle' | 'saving' | 'saved';

@Component({
  selector: 'app-horario-negocio-anim',
  standalone: true,
  imports: [],
  templateUrl: './horario-negocio-anim.component.html',
  styleUrl: './horario-negocio-anim.component.scss',
})
export class HorarioNegocioAnimComponent implements OnInit {
  readonly dias = DIAS;
  readonly horas = HORAS;

  grid = signal<Map<string, SlotState>>(new Map());
  dragging = signal(false);
  dragState = signal<SlotState>('open');
  saveState = signal<SaveState>('idle');
  totalOpen = signal(0);

  ngOnInit(): void {
    const m = new Map<string, SlotState>();
    DIAS.forEach(d =>
      HORAS.forEach((_, hi) => {
        const key = `${d}-${hi}`;
        m.set(key, DEFAULTS[d]?.includes(hi) ? 'open' : 'closed');
      })
    );
    this.grid.set(m);
    this.recalcTotal();
  }

  getState(dia: string, hi: number): SlotState {
    return this.grid().get(`${dia}-${hi}`) ?? 'closed';
  }

  onSlotDown(dia: string, hi: number): void {
    const cur = this.getState(dia, hi);
    const next: SlotState = cur === 'open' ? 'closed' : 'open';
    this.dragState.set(next);
    this.dragging.set(true);
    this.toggleSlot(dia, hi, next);
  }

  onSlotEnter(dia: string, hi: number): void {
    if (!this.dragging()) return;
    this.toggleSlot(dia, hi, this.dragState());
  }

  onMouseUp(): void {
    this.dragging.set(false);
  }

  toggleDia(dia: string): void {
    const allOpen = HORAS.every((_, hi) => this.getState(dia, hi) === 'open');
    const next: SlotState = allOpen ? 'closed' : 'open';
    const m = new Map(this.grid());
    HORAS.forEach((_, hi) => m.set(`${dia}-${hi}`, next));
    this.grid.set(m);
    this.recalcTotal();
  }

  isDiaOpen(dia: string): boolean {
    return HORAS.some((_, hi) => this.getState(dia, hi) === 'open');
  }

  guardar(): void {
    if (this.saveState() !== 'idle') return;
    this.saveState.set('saving');
    setTimeout(() => {
      this.saveState.set('saved');
      setTimeout(() => this.saveState.set('idle'), 2200);
    }, 900);
  }

  resetDefault(): void {
    this.ngOnInit();
    this.saveState.set('idle');
  }

  private toggleSlot(dia: string, hi: number, state: SlotState): void {
    const m = new Map(this.grid());
    m.set(`${dia}-${hi}`, state);
    this.grid.set(m);
    this.recalcTotal();
  }

  private recalcTotal(): void {
    let count = 0;
    this.grid().forEach(v => { if (v === 'open') count++; });
    this.totalOpen.set(count);
  }
}
