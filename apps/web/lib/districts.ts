// Lista única de distritos de Lima para selección de dirección — reservas a
// domicilio (wizard) y envío de la tienda (checkout). Ordenados por cercanía a
// la SEDE (Cieneguilla): los más cercanos —y frecuentes— aparecen primero.
//
// Las distancias por distrito (para el recargo a domicilio) viven en
// features/appointments/utils/booking.ts (frontend) y en el backend
// (ConfiguracionDomicilioPrisma.ts); deben incluir estos mismos nombres.
export const LIMA_DISTRICTS = [
  'Cieneguilla','Pachacámac','La Molina','Lurín','Ate','Chaclacayo','Lurigancho','Santa Anita',
  'Surco','San Borja','San Luis','San Juan de Lurigancho','El Agustino','Surquillo',
  'La Victoria','Lince','Jesús María','San Isidro','Miraflores','Barranco',
  'Lima Cercado','Rímac','Breña','Pueblo Libre','Magdalena','San Miguel',
  'Chorrillos','Villa María del Triunfo','Villa El Salvador',
  'San Martín de Porres','Los Olivos','Independencia','Comas','Carabayllo','Puente Piedra',
  'Otro',
];
