import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { HeaderComponent } from './componentes/HyF/header/header.component';
import { EstanqueComponent } from './componentes/estanque/estanque.component';

@Component({
  selector: 'app-header',
  standalone: true,
  template: '',
})
class MockHeaderComponent {}

@Component({
  selector: 'app-estanque',
  standalone: true,
  template: '',
})
class MockEstanqueComponent {}

describe('AppComponent', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    })
      .overrideComponent(AppComponent, {
        remove: { imports: [HeaderComponent, EstanqueComponent] },
        add: { imports: [MockHeaderComponent, MockEstanqueComponent] },
      })
      .compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('muestra el estanque cuando no hay acceso desbloqueado', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-estanque')).not.toBeNull();
  });

  it('muestra la app cuando hay acceso persistido', () => {
    localStorage.setItem('accesoPermitido', 'true');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const app = fixture.componentInstance;
    expect(app.mostrarApp()).toBeTrue();
  });
});
