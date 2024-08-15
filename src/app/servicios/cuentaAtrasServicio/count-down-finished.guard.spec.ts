import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { countDownFinishedGuard } from './count-down-finished.guard';

describe('countDownFinishedGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => countDownFinishedGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
