import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { promocionesMock } from './promocionesMock'

@Component({
  selector: 'app-promocion',
  standalone: true,
  imports: [CommonModule,],
  templateUrl: './promocion.component.html',
  styleUrl: './promocion.component.css'
})
export class CajonPromocionesComponent {
  promociones = promocionesMock;
}
