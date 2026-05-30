import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { injectSpeedInsights } from '@vercel/speed-insights';

injectSpeedInsights();

bootstrapApplication(AppComponent, appConfig)
  .catch((err: unknown) => console.error('[Nenufar bootstrap error]', err));
 