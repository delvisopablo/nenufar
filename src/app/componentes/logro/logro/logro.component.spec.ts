import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogroComponent } from './logro.component';

describe('LogroComponent', () => {
  let component: LogroComponent;
  let fixture: ComponentFixture<LogroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogroComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LogroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
