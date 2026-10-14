import { Injectable, signal } from '@angular/core';

export type HomeHeaderPopupKind = 'info' | 'ayuda';

type PendingHomeHeaderPopup = {
  kind: HomeHeaderPopupKind;
  nonce: number;
};

@Injectable({ providedIn: 'root' })
export class HomeHeaderService {
  private readonly pendingPopupSignal = signal<PendingHomeHeaderPopup | null>(null);

  readonly pendingPopup = this.pendingPopupSignal.asReadonly();

  /**
   * Vista "estanque organizado": solo afecta a cómo se colocan los nenúfares en /inicio,
   * nunca a los datos (filtros, resultados o prioridades).
   */
  private readonly pondOrganizedSignal = signal(false);
  readonly pondOrganized = this.pondOrganizedSignal.asReadonly();

  togglePondOrganized(): void {
    this.pondOrganizedSignal.update((value) => !value);
  }

  setPondOrganized(value: boolean): void {
    this.pondOrganizedSignal.set(value);
  }

  requestPopup(kind: HomeHeaderPopupKind): void {
    this.pendingPopupSignal.set({
      kind,
      nonce: Date.now() + Math.random()
    });
  }

  clearPopup(nonce: number): void {
    const current = this.pendingPopupSignal();

    if (current?.nonce === nonce) {
      this.pendingPopupSignal.set(null);
    }
  }
}
