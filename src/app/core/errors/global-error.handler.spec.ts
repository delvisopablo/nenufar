import { TestBed } from '@angular/core/testing';
import { ErrorObservabilityService } from './error-observability.service';
import { GlobalErrorHandler } from './global-error.handler';

describe('GlobalErrorHandler', () => {
  it('reporta errores no controlados con contexto Angular', () => {
    const observability = jasmine.createSpyObj<ErrorObservabilityService>('ErrorObservabilityService', ['report']);

    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: ErrorObservabilityService, useValue: observability },
      ],
    });

    const handler = TestBed.inject(GlobalErrorHandler);
    handler.handleError(new Error('Fallo no controlado'));

    expect(observability.report).toHaveBeenCalledWith(
      jasmine.objectContaining({
        code: 'ANGULAR_UNHANDLED_ERROR',
        source: 'angular',
      }),
      jasmine.objectContaining({
        surface: 'angular-error-handler',
        handled: false,
      }),
    );
  });
});

