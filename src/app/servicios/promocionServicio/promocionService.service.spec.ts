/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { PromocionServiceService } from './promocionService.service';

describe('Service: PromocionService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PromocionServiceService]
    });
  });

  it('should ...', inject([PromocionServiceService], (service: PromocionServiceService) => {
    expect(service).toBeTruthy();
  }));
});
