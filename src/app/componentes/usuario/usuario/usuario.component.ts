import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Usuario } from '../../../modelos/Usuario';
import { UsuarioServiceService } from '../../../servicios/usuarioServicio/usuarioService.service';

@Component({
  selector: 'app-usuario',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './usuario.component.html',
  styleUrl: './usuario.component.css'
})
export class UsuarioComponent {

  usuario: Usuario | undefined ; 

  constructor(){
    
  }

}
