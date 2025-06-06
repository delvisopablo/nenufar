import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearResenaModalComponent } from './crear-resena-modal.component';

describe('CrearResenaModalComponent', () => {
  let component: CrearResenaModalComponent;
  let fixture: ComponentFixture<CrearResenaModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearResenaModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CrearResenaModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
