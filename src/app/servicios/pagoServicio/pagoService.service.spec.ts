/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { PagoServiceService } from './pagoService.service';

describe('Service: PagoService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PagoServiceService]
    });
  });

  it('should ...', inject([PagoServiceService], (service: PagoServiceService) => {
    expect(service).toBeTruthy();
  }));
});
