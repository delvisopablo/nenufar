import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HacerReviewComponent } from './hacer-review.component';

describe('HacerReviewComponent', () => {
  let component: HacerReviewComponent;
  let fixture: ComponentFixture<HacerReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HacerReviewComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HacerReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
