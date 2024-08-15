/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { NotificacionServiceService } from './notificacionService.service';

describe('Service: NotificacionService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificacionServiceService]
    });
  });

  it('should ...', inject([NotificacionServiceService], (service: NotificacionServiceService) => {
    expect(service).toBeTruthy();
  }));
});
