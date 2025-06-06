import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalResenasComponent } from './portal-resenas.component';

describe('PortalResenasComponent', () => {
  let component: PortalResenasComponent;
  let fixture: ComponentFixture<PortalResenasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortalResenasComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PortalResenasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
