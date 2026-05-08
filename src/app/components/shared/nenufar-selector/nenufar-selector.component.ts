import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import {
  NENUFAR_OPTIONS,
  NenufarOption,
  resolveNenufarAsset,
} from '../../../core/negocio/negocio-visuals';

export { NENUFAR_OPTIONS, resolveNenufarAsset } from '../../../core/negocio/negocio-visuals';

@Component({
  selector: 'app-nenufar-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nenufar-selector.component.html',
  styleUrl: './nenufar-selector.component.scss',
})
export class NenufarSelectorComponent implements AfterViewInit, OnChanges {
  private readonly destroyRef = inject(DestroyRef);

  @Input() value: string | number | null = null;
  @Input() options: NenufarOption[] = NENUFAR_OPTIONS;
  @Input() title = 'Elige tu nenúfar';

  @Output() valueChange = new EventEmitter<string | null>();
  @Output() selected = new EventEmitter<NenufarOption>();

  @ViewChild('carouselTrack')
  private readonly carouselTrack?: ElementRef<HTMLElement>;

  @ViewChildren('optionCard')
  private readonly optionCards?: QueryList<ElementRef<HTMLButtonElement>>;

  selectedAsset: string | null = null;
  focusIndex = 0;

  private pendingScrollBehavior: ScrollBehavior = 'auto';
  private scrollFrameId: number | null = null;

  ngAfterViewInit(): void {
    this.optionCards?.changes
      .pipe(startWith(this.optionCards), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.scrollFocusedCardIntoView(this.pendingScrollBehavior);
        this.pendingScrollBehavior = 'auto';
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const resolvedAsset = resolveNenufarAsset(this.value, this.options);
    const selectedIndex = resolvedAsset
      ? this.options.findIndex((option) => option.asset === resolvedAsset)
      : -1;

    this.selectedAsset = resolvedAsset;

    if (selectedIndex >= 0) {
      this.focusIndex = selectedIndex;
    } else {
      this.focusIndex = this.clampIndex(this.focusIndex);
    }

    this.pendingScrollBehavior = changes['value'] ? 'auto' : 'smooth';
  }

  selectOption(option: NenufarOption): void {
    const optionIndex = this.options.findIndex(
      (candidate) => candidate.asset === option.asset,
    );
    this.focusOption(optionIndex, 'smooth');

    if (this.selectedAsset === option.asset) {
      return;
    }

    this.selectedAsset = option.asset;
    this.valueChange.emit(option.asset);
    this.selected.emit(option);
  }

  markAsSaved(value: string | number | null = this.selectedAsset): void {
    this.selectedAsset = resolveNenufarAsset(value, this.options);

    const savedIndex = this.selectedAsset
      ? this.options.findIndex((option) => option.asset === this.selectedAsset)
      : -1;

    if (savedIndex >= 0) {
      this.focusIndex = savedIndex;
    } else {
      this.focusIndex = this.clampIndex(this.focusIndex);
    }

    this.scrollFocusedCardIntoView('auto');
  }

  isSelected(option: NenufarOption): boolean {
    return option.asset === this.selectedAsset;
  }

  formatOptionLabel(label: string): string {
    return label.replace(/^Nenufar\b/, 'Nenúfar');
  }

  get selectedOption(): NenufarOption | null {
    return (
      this.options.find((option) => option.asset === this.selectedAsset) ?? null
    );
  }

  get focusedOption(): NenufarOption | null {
    return this.options[this.focusIndex] ?? null;
  }

  isFocused(index: number): boolean {
    return index === this.focusIndex;
  }

  get canGoPrev(): boolean {
    return this.focusIndex > 0;
  }

  get canGoNext(): boolean {
    return this.focusIndex < this.options.length - 1;
  }

  goPrev(): void {
    this.focusOption(this.focusIndex - 1, 'smooth');
  }

  goNext(): void {
    this.focusOption(this.focusIndex + 1, 'smooth');
  }

  onTrackScroll(): void {
    if (typeof window === 'undefined' || this.scrollFrameId !== null) {
      return;
    }

    this.scrollFrameId = window.requestAnimationFrame(() => {
      this.scrollFrameId = null;
      this.updateFocusFromScroll();
    });
  }

  private focusOption(index: number, behavior: ScrollBehavior): void {
    this.focusIndex = this.clampIndex(index);
    this.scrollFocusedCardIntoView(behavior);
  }

  private scrollFocusedCardIntoView(behavior: ScrollBehavior): void {
    const card = this.optionCards?.get(this.focusIndex)?.nativeElement;

    if (!card) {
      this.pendingScrollBehavior = behavior;
      return;
    }

    card.scrollIntoView({
      behavior,
      block: 'nearest',
      inline: 'center',
    });
  }

  private updateFocusFromScroll(): void {
    const track = this.carouselTrack?.nativeElement;
    const cards = this.optionCards?.toArray() ?? [];

    if (!track || !cards.length) {
      return;
    }

    const viewportCenter = track.scrollLeft + track.clientWidth / 2;
    let nearestIndex = this.focusIndex;
    let nearestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((cardRef, index) => {
      const card = cardRef.nativeElement;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - viewportCenter);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    this.focusIndex = nearestIndex;
  }

  private clampIndex(index: number): number {
    if (!this.options.length) {
      return 0;
    }

    return Math.min(Math.max(index, 0), this.options.length - 1);
  }
}
