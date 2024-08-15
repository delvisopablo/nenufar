/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { CompraServiceService } from './compraService.service';

describe('Service: CompraService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CompraServiceService]
    });
  });

  it('should ...', inject([CompraServiceService], (service: CompraServiceService) => {
    expect(service).toBeTruthy();
  }));
});
