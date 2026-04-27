import { Injectable } from '@angular/core';
import { ErrorObservabilityService } from './error-observability.service';
import { parseUnknownError } from './error-parser';

@Injectable({ providedIn: 'root' })
export class BrowserErrorListenerService {
  private listening = false;

  constructor(private readonly observability: ErrorObservabilityService) {}

  start(): void {
    if (this.listening || typeof window === 'undefined') {
      return;
    }

    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    this.listening = true;
  }

  stop(): void {
    if (!this.listening || typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    this.listening = false;
  }

  private readonly handleWindowError = (event: ErrorEvent): void => {
    const appError = parseUnknownError(event.error ?? event.message, {
      source: 'browser',
      code: 'WINDOW_ERROR',
      message: event.message || 'Error global del navegador.',
      kind: 'unknown',
    });

    this.observability.report(appError, {
      surface: 'window.error',
      handled: false,
      extra: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  };

  private readonly handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const appError = parseUnknownError(event.reason, {
      source: 'browser',
      code: 'UNHANDLED_REJECTION',
      message: 'Promesa rechazada sin gestionar.',
      kind: 'unknown',
    });

    this.observability.report(appError, {
      surface: 'window.unhandledrejection',
      handled: false,
    });
  };
}

