import { TestBed } from '@angular/core/testing';

import { CuentaAtrasService } from './cuenta-atras.service';

describe('CuentaAtrasService', () => {
  let service: CuentaAtrasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CuentaAtrasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
