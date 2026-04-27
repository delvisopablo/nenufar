import { ErrorHandler, Injectable } from '@angular/core';
import { ErrorObservabilityService } from './error-observability.service';
import { parseUnknownError } from './error-parser';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private readonly observability: ErrorObservabilityService) {}

  handleError(error: unknown): void {
    const appError = parseUnknownError(error, {
      source: 'angular',
      code: 'ANGULAR_UNHANDLED_ERROR',
      message: 'La aplicacion ha encontrado un error inesperado.',
      kind: 'unknown',
    });

    this.observability.report(appError, {
      surface: 'angular-error-handler',
      handled: false,
    });
  }
}

