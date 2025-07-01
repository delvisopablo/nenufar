import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { CountdownFinishedGuard } from './count-down-finished.guard';

describe('CountdownFinishedGuard', () => {
  let guard: CountdownFinishedGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(CountdownFinishedGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
