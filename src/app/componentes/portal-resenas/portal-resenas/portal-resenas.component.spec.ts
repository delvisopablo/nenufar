import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalReseñasComponent } from './portal-resenas.component';

describe('PortalReseñasComponent', () => {
  let component: PortalReseñasComponent;
  let fixture: ComponentFixture<PortalReseñasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortalReseñasComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PortalReseñasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
