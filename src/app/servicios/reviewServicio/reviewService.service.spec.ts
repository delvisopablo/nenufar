/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { ReviewServiceService } from './reviewService.service';

describe('Service: ReviewService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReviewServiceService]
    });
  });

  it('should ...', inject([ReviewServiceService], (service: ReviewServiceService) => {
    expect(service).toBeTruthy();
  }));
});
