import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReviewDelDiaComponent } from './review-del-dia.component';

describe('ReviewDelDiaComponent', () => {
  let component: ReviewDelDiaComponent;
  let fixture: ComponentFixture<ReviewDelDiaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewDelDiaComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ReviewDelDiaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
