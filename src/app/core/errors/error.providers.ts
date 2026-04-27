import { ENVIRONMENT_INITIALIZER, ErrorHandler, EnvironmentProviders, Provider, inject, makeEnvironmentProviders } from '@angular/core';
import { BrowserErrorListenerService } from './browser-error-listener.service';
import { GlobalErrorHandler } from './global-error.handler';

export function provideAppErrorHandling(): EnvironmentProviders {
  const providers: Provider[] = [
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler,
    },
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        inject(BrowserErrorListenerService).start();
      },
    },
  ];

  return makeEnvironmentProviders(providers);
}

