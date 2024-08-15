/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { LogroServiceService } from './logroService.service';

describe('Service: LogroService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LogroServiceService]
    });
  });

  it('should ...', inject([LogroServiceService], (service: LogroServiceService) => {
    expect(service).toBeTruthy();
  }));
});
