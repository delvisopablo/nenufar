/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { CategoriaServiceService } from './categoriaService.service';

describe('Service: CategoriaService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CategoriaServiceService]
    });
  });

  it('should ...', inject([CategoriaServiceService], (service: CategoriaServiceService) => {
    expect(service).toBeTruthy();
  }));
});
