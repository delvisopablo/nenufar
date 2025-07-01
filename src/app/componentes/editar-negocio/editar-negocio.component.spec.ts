import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditarNegocioComponent } from './editar-negocio.component';

describe('EditarNegocioComponent', () => {
  let component: EditarNegocioComponent;
  let fixture: ComponentFixture<EditarNegocioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditarNegocioComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EditarNegocioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
