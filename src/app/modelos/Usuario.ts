import { RolUsuario } from "./enumeraciones";

export interface Usuario {
    usuario_id: number,
    nombre: string,
    email: string,
    contrasena: string,
    fecha_registro: Date,
    foto_perfil: string,
    rol: RolUsuario,
    biografia: string,
}
