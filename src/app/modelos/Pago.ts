import { MetodoPago } from "./enumeraciones";

export interface Pago {
    pago_id: number,
    compra_id: number,
    total: number,
    fecha_pago: Date;
    metodo_pago: MetodoPago,
    estado: string,
}