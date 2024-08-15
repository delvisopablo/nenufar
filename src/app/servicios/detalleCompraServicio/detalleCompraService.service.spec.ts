/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { DetalleCompraServiceService } from './detalleCompraService.service';

describe('Service: DetalleCompraService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DetalleCompraServiceService]
    });
  });

  it('should ...', inject([DetalleCompraServiceService], (service: DetalleCompraServiceService) => {
    expect(service).toBeTruthy();
  }));
});
