import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
@Component({
  selector: 'app-eleccion-registro',
  imports: [],
  standalone: true,
  templateUrl: './eleccion-registro.component.html',
  styleUrls: ['./eleccion-registro.component.css']
})
export class EleccionRegistroComponent implements OnInit {

  private router = inject(Router);

  constructor() { }

  ngOnInit() {
  }

  irARegistroUsuario() {
    this.router.navigate(['/registro']);
  }

  irARegistroNegocio() {
    this.router.navigate(['/registro-negocio']);
  }

}
