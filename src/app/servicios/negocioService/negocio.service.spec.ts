/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { NegocioService } from './negocio.service';

describe('Service: NegocioService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NegocioService]
    });
  });

  it('should ...', inject([NegocioService], (service: NegocioService) => {
    expect(service).toBeTruthy();
  }));
});
