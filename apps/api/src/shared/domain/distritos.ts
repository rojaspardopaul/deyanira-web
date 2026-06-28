// Distancias aproximadas en km DESDE Cieneguilla (sede del salón). Fuente única
// usada para el recargo de servicio a domicilio (reservas) y el envío de productos.
// Debe mantenerse alineada con el front (apps/web/.../booking.ts).

export const DISTRITO_KM: Record<string, number> = {
  Cieneguilla: 0, Pachacámac: 12, 'La Molina': 14, Chaclacayo: 16, Ate: 18, Lurín: 18,
  Lurigancho: 20, 'Santa Anita': 20, Surco: 22, 'San Borja': 22, 'San Luis': 22, 'El Agustino': 22,
  'San Juan de Lurigancho': 24, 'La Victoria': 26, Surquillo: 26, 'Lima Cercado': 27, Lince: 27,
  Breña: 28, 'Jesús María': 28, 'Villa María del Triunfo': 28, Rímac: 29, Miraflores: 30,
  'San Isidro': 30, 'Pueblo Libre': 31, Barranco: 32, Magdalena: 32, Chorrillos: 33,
  'Villa El Salvador': 33, 'San Miguel': 34, 'San Martín de Porres': 36, Independencia: 37,
  'Los Olivos': 38, Comas: 42, Carabayllo: 46, 'Puente Piedra': 48, Otro: 30,
};

/** Km aproximados desde Cieneguilla para un distrito (default 30 si no está en la tabla). */
export function kmDesdeCieneguilla(distrito: string | null | undefined): number {
  return DISTRITO_KM[distrito ?? ''] ?? 30;
}
