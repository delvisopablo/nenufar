import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AppErrorModel } from './api-error.types';
import { isAppErrorModel, parseUnknownError } from './error-parser';

export interface ErrorLogContext {
  surface: string;
  handled?: boolean;
  extra?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class ErrorObservabilityService {
  report(error: AppErrorModel | unknown, context: ErrorLogContext): void {
    const appError = isAppErrorModel(error) ? error : parseUnknownError(error);

    if (!environment.production) {
      this.logForDevelopment(appError, context);
    }

    this.forwardToExternalTool(appError, context);
  }

  private logForDevelopment(error: AppErrorModel, context: ErrorLogContext): void {
    const label = `[Nenufar error] ${context.surface} ${error.code}`;

    console.groupCollapsed(label);
    console.error(error.message);
    console.table({
      kind: error.kind,
      code: error.code,
      status: error.status ?? '',
      requestId: error.requestId ?? '',
      url: error.url ?? '',
      method: error.method ?? '',
      retryable: error.retryable,
      handled: context.handled ?? false,
    });

    if (error.details) {
      console.info('details', error.details);
    }

    if (context.extra) {
      console.info('context', context.extra);
    }

    console.debug('originalError', error.originalError);
    console.groupEnd();
  }

  private forwardToExternalTool(error: AppErrorModel, context: ErrorLogContext): void {
    void error;
    void context;
    // Punto unico para integrar Sentry, OpenTelemetry o un endpoint propio.
  }
}

