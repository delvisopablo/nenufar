import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  DEFAULT_NENUFAR_ASSET,
  NENUFAR_OPTIONS,
  NenufarOption,
  resolveNenufarAsset,
} from '../../../core/negocio/negocio-visuals';

export { DEFAULT_NENUFAR_ASSET, NENUFAR_OPTIONS, resolveNenufarAsset } from '../../../core/negocio/negocio-visuals';

@Component({
  selector: 'app-nenufar-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nenufar-selector.component.html',
  styleUrl: './nenufar-selector.component.scss',
})
export class NenufarSelectorComponent implements OnChanges {
  @Input() value: string | number | null = null;
  @Input() options: NenufarOption[] = NENUFAR_OPTIONS;

  @Output() valueChange = new EventEmitter<string | null>();
  @Output() selected = new EventEmitter<NenufarOption>();

  selectedAsset = DEFAULT_NENUFAR_ASSET;
  private savedAsset = DEFAULT_NENUFAR_ASSET;
  private hasLocalChanges = false;

  ngOnChanges(changes: SimpleChanges): void {
    const resolvedAsset =
      resolveNenufarAsset(this.value, this.options) ?? this.options[0]?.asset ?? DEFAULT_NENUFAR_ASSET;

    this.selectedAsset = resolvedAsset;

    if (!this.hasLocalChanges || changes['options']) {
      this.savedAsset = resolvedAsset;
      this.hasLocalChanges = false;
    }
  }

  selectOption(option: NenufarOption): void {
    if (this.selectedAsset === option.asset) {
      return;
    }

    this.selectedAsset = option.asset;
    this.hasLocalChanges = this.selectedAsset !== this.savedAsset;
    this.valueChange.emit(option.asset);
    this.selected.emit(option);
  }

  markAsSaved(value: string | number | null = this.selectedAsset): void {
    this.savedAsset =
      resolveNenufarAsset(value, this.options) ?? this.options[0]?.asset ?? DEFAULT_NENUFAR_ASSET;
    this.selectedAsset = this.savedAsset;
    this.hasLocalChanges = false;
  }

  isSelected(option: NenufarOption): boolean {
    return option.asset === this.selectedAsset;
  }

  hasPendingChanges(): boolean {
    return this.hasLocalChanges;
  }

  getSelectedOption(): NenufarOption {
    return (
      this.options.find((option) => option.asset === this.selectedAsset) ??
      this.options[0] ?? {
        id: 'default',
        label: 'Nenufar por defecto',
        asset: DEFAULT_NENUFAR_ASSET,
        description: 'Se muestra cuando el negocio aun no ha elegido otro.',
      }
    );
  }

  // ── Carousel: índice del seleccionado y vecinos ────────────────────────────
  get selectedIndex(): number {
    const idx = this.options.findIndex((o) => o.asset === this.selectedAsset);
    return idx >= 0 ? idx : 0;
  }

  get prevOption(): NenufarOption | null {
    const i = this.selectedIndex;
    return i > 0 ? this.options[i - 1] : null;
  }

  get currentOption(): NenufarOption | null {
    return this.options[this.selectedIndex] ?? null;
  }

  get nextOption(): NenufarOption | null {
    const i = this.selectedIndex;
    return i < this.options.length - 1 ? this.options[i + 1] : null;
  }

  get canGoPrev(): boolean {
    return this.selectedIndex > 0;
  }

  get canGoNext(): boolean {
    return this.selectedIndex < this.options.length - 1;
  }

  goPrev(): void {
    const prev = this.prevOption;
    if (prev) {
      this.selectOption(prev);
    }
  }

  goNext(): void {
    const next = this.nextOption;
    if (next) {
      this.selectOption(next);
    }
  }
}
