import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../servicios/authService/auth.service';
import {
  TicketScannerAnalysis,
  TicketScannerLine,
  TicketScannerService,
  TicketScannerSubmitResult,
} from '../../servicios/ticketScannerServicio/ticket-scanner.service';

type TicketHistoryEntry = {
  id: string;
  negocioId: number;
  negocioNombre: string;
  ticketDate: string;
  total: number;
  itemsCount: number;
  createdAt: string;
};

const TICKET_HISTORY_KEY = 'nenufar_ticket_history';

@Component({
  selector: 'app-ticket-scanner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ticket-scanner.component.html',
  styleUrl: './ticket-scanner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketScannerComponent implements OnChanges, OnDestroy {
  @Input() negocioId: number | null = null;
  @Input() negocioNombre: string | null = null;
  @Input() puedeCrearProductos = false;

  @Output() saved = new EventEmitter<TicketScannerSubmitResult>();

  @ViewChild('videoElement') private readonly videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') private readonly canvasElement?: ElementRef<HTMLCanvasElement>;

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly ticketScannerService = inject(TicketScannerService);

  readonly ticketForm = this.fb.group({
    storeName: [''],
    ticketDate: [new Date().toISOString().slice(0, 10)],
    detectedTotal: [0],
    paid: [true],
    paymentMethod: ['EFECTIVO', Validators.required],
    items: this.fb.array([]),
  });

  readonly quickAddForm = this.fb.group({
    name: [''],
    quantity: [1],
    unitPrice: [0],
    subtotal: [0],
  });

  activeTab: 'scan' | 'history' = 'scan';
  isAnalyzing = false;
  isSaving = false;
  cameraActive = false;
  previewUrl: string | null = null;
  scannerNote = '';
  errorMessage = '';
  successMessage = '';
  history = this.readHistory();
  private mediaStream: MediaStream | null = null;

  constructor() {
    this.addEmptyItem();
  }

  get itemsArray(): FormArray {
    return this.ticketForm.get('items') as FormArray;
  }

  get canSave(): boolean {
    return (
      !this.isSaving &&
      !this.isAnalyzing &&
      this.isAuthenticated &&
      this.itemsArray.length > 0 &&
      this.itemsArray.controls.every((control) => control.valid)
    );
  }

  get isAuthenticated(): boolean {
    return Boolean(this.authService.obtenerUsuario()?.id);
  }

  get computedTotal(): number {
    return this.itemsArray.controls.reduce((sum, control) => {
      const quantity = Number(control.get('quantity')?.value);
      const unitPrice = Number(control.get('unitPrice')?.value);
      const explicitSubtotal = Number(control.get('subtotal')?.value);
      const subtotal = Number.isFinite(explicitSubtotal) && explicitSubtotal >= 0
        ? explicitSubtotal
        : quantity * unitPrice;

      return sum + (Number.isFinite(subtotal) ? subtotal : 0);
    }, 0);
  }

  get totalDifference(): number {
    const detectedTotal = Number(this.ticketForm.get('detectedTotal')?.value);
    if (!Number.isFinite(detectedTotal) || detectedTotal <= 0) {
      return 0;
    }

    return Number((detectedTotal - this.computedTotal).toFixed(2));
  }

  switchTab(tab: 'scan' | 'history'): void {
    this.activeTab = tab;
  }

  async startCamera(): Promise<void> {
    this.resetMessages();

    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorMessage = 'Tu navegador no permite abrir la cámara. Puedes subir una imagen del ticket.';
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      const video = this.videoElement?.nativeElement;
      if (video) {
        video.srcObject = this.mediaStream;
        await video.play();
      }
      this.cameraActive = true;
    } catch {
      this.errorMessage = 'No hemos podido acceder a la cámara. Prueba con una foto del ticket.';
    }
  }

  stopCamera(): void {
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
    this.cameraActive = false;

    const video = this.videoElement?.nativeElement;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }

  captureImage(): void {
    const video = this.videoElement?.nativeElement;
    const canvas = this.canvasElement?.nativeElement;
    if (!video || !canvas) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      this.errorMessage = 'No hemos podido procesar la captura del ticket.';
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.stopCamera();
    this.previewUrl = canvas.toDataURL('image/jpeg', 0.88);
    this.runAnalysis('captura-ticket.jpg');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    this.stopCamera();
    this.revokePreviewUrl();
    this.previewUrl = URL.createObjectURL(file);
    this.runAnalysis(file.name);

    if (input) {
      input.value = '';
    }
  }

  addEmptyItem(): void {
    this.itemsArray.push(this.createItemGroup());
    this.quickAddForm.patchValue({
      name: '',
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
    });
  }

  addQuickItem(): void {
    const name = this.quickAddForm.get('name')?.value?.trim();
    const quantity = Number(this.quickAddForm.get('quantity')?.value);
    const unitPrice = Number(this.quickAddForm.get('unitPrice')?.value);
    const subtotal = Number(this.quickAddForm.get('subtotal')?.value);

    if (!name || quantity <= 0 || unitPrice < 0) {
      return;
    }

    this.itemsArray.push(
      this.createItemGroup({
        id: this.createLocalId(),
        name,
        quantity,
        unitPrice,
        subtotal: Number.isFinite(subtotal) ? subtotal : quantity * unitPrice,
      }),
    );

    this.quickAddForm.patchValue({
      name: '',
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
    });
  }

  removeItem(index: number): void {
    this.itemsArray.removeAt(index);
  }

  submitTicket(): void {
    this.resetMessages();

    if (!this.authService.obtenerUsuario()?.id) {
      this.errorMessage = 'Inicia sesión para guardar la compra del ticket en tu cuenta.';
      return;
    }

    if (!this.canSave || !this.negocioId) {
      this.errorMessage = 'Revisa los productos detectados antes de guardar.';
      return;
    }

    const items = this.itemsArray.controls.map((control) => ({
      name: String(control.get('name')?.value ?? ''),
      quantity: Number(control.get('quantity')?.value ?? 0),
      unitPrice: Number(control.get('unitPrice')?.value ?? 0),
      subtotal: Number(control.get('subtotal')?.value ?? 0),
    }));

    this.isSaving = true;
    this.ticketScannerService
      .submitTicket({
        negocioId: this.negocioId,
        negocioNombre: this.negocioNombre,
        canCreateProducts: this.puedeCrearProductos,
        ticketDate: this.ticketForm.get('ticketDate')?.value,
        total: this.computedTotal,
        paid: Boolean(this.ticketForm.get('paid')?.value),
        paymentMethod:
          (this.ticketForm.get('paymentMethod')?.value as
            | 'EFECTIVO'
            | 'OTRO'
            | 'TARJETA'
            | 'BIZUM') ?? 'EFECTIVO',
        items,
      })
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (result) => {
          this.saveHistoryEntry(result);
          this.saved.emit(result);
          this.successMessage =
            result.pago
              ? `Ticket guardado. Hemos creado la compra #${result.compra.id} y marcado el pago como recibido.`
              : `Ticket guardado. Hemos creado la compra #${result.compra.id}.`;
          this.activeTab = 'history';
        },
        error: (error: unknown) => {
          this.errorMessage = this.ticketScannerService.getFriendlySubmitError(error);
        },
      });
  }

  resetScanner(): void {
    this.resetMessages();
    this.scannerNote = '';
    this.itemsArray.clear();
    this.ticketForm.patchValue({
      storeName: this.negocioNombre?.trim() || '',
      ticketDate: new Date().toISOString().slice(0, 10),
      detectedTotal: 0,
      paid: true,
      paymentMethod: 'EFECTIVO',
    });
    this.addEmptyItem();
    this.revokePreviewUrl();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.revokePreviewUrl();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['negocioNombre'] && !this.ticketForm.get('storeName')?.value) {
      this.ticketForm.patchValue({
        storeName: this.negocioNombre?.trim() || '',
      });
    }
  }

  private runAnalysis(fileName: string): void {
    this.resetMessages();
    this.isAnalyzing = true;

    this.ticketScannerService
      .analyzeImage(fileName, this.negocioNombre)
      .pipe(finalize(() => (this.isAnalyzing = false)))
      .subscribe({
        next: (analysis) => this.applyAnalysis(analysis),
        error: () => {
          this.errorMessage = 'No hemos podido preparar el ticket. Puedes completar los campos manualmente.';
          if (this.itemsArray.length === 0) {
            this.addEmptyItem();
          }
        },
      });
  }

  private applyAnalysis(analysis: TicketScannerAnalysis): void {
    this.scannerNote = analysis.note ?? '';
    this.ticketForm.patchValue({
      storeName: analysis.storeName || this.negocioNombre || '',
      ticketDate: analysis.ticketDate,
      detectedTotal: analysis.total ?? 0,
    });

    this.itemsArray.clear();
    for (const item of analysis.items) {
      this.itemsArray.push(this.createItemGroup(item));
    }

    if (this.itemsArray.length === 0) {
      this.addEmptyItem();
    }
  }

  private createItemGroup(item?: Partial<TicketScannerLine>) {
    return this.fb.group({
      id: [item?.id ?? this.createLocalId()],
      name: [item?.name ?? '', [Validators.required]],
      quantity: [item?.quantity ?? 1, [Validators.required, Validators.min(1)]],
      unitPrice: [item?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
      subtotal: [item?.subtotal ?? 0, [Validators.min(0)]],
    });
  }

  private saveHistoryEntry(result: TicketScannerSubmitResult): void {
    const entry: TicketHistoryEntry = {
      id: this.createLocalId(),
      negocioId: this.negocioId ?? result.compra.negocioId ?? 0,
      negocioNombre: this.negocioNombre?.trim() || this.ticketForm.get('storeName')?.value || 'Negocio',
      ticketDate:
        this.ticketForm.get('ticketDate')?.value ||
        new Date().toISOString().slice(0, 10),
      total: result.total,
      itemsCount: this.itemsArray.length,
      createdAt: new Date().toISOString(),
    };

    this.history = [entry, ...this.history].slice(0, 12);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TICKET_HISTORY_KEY, JSON.stringify(this.history));
    }
  }

  private readHistory(): TicketHistoryEntry[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(TICKET_HISTORY_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private createLocalId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `scanner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private revokePreviewUrl(): void {
    if (this.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.previewUrl = null;
  }

  private resetMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }
}
