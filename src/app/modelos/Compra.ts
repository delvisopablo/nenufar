import { EstadoCompra } from "./enumeraciones";

export interface Compra {
    compra_id: number,
    usuario_id: number,
    fecha_pedido: Date,
    estado: EstadoCompra,
    total: number,
    direccion_envio: string,
}