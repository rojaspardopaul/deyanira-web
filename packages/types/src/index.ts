// Tipos compartidos entre frontend y backend

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type PaymentMethod = 'culqi' | 'yape';

export interface Service {
  id: string;
  name: string;
  slug: string;
  description?: string;
  categoryId?: string;
  pricePen: number;
  duration: number;
  imageUrl?: string;
  isActive: boolean;
}

export interface Staff {
  id: string;
  name: string;
  role?: string;
  photoUrl?: string;
  bio?: string;
  isActive: boolean;
}

export interface TimeSlot {
  start: string; // "HH:MM"
  end: string;
}

export interface Appointment {
  id: string;
  customerId?: string;
  staffId: string;
  serviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string;
  totalPen: number;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  categoryId?: string;
  brand?: string;
  pricePen: number;
  comparePrice?: number;
  stock: number;
  images: string[];
  isActive: boolean;
}

export interface CartItem {
  productId: string;
  name: string;
  pricePen: number;
  qty: number;
  imageUrl?: string;
}

export interface Order {
  id: string;
  customerId?: string;
  status: OrderStatus;
  subtotalPen: number;
  shippingPen: number;
  discountPen: number;
  totalPen: number;
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;
  shipName?: string;
  shipPhone?: string;
  shipAddress?: string;
  shipDistrict?: string;
  shipCity: string;
  createdAt: string;
}

export interface GalleryPhoto {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  category?: string;
  caption?: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface SalonSettings {
  salonName: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  district?: string;
  city: string;
  lat: number;
  lng: number;
  hoursWeekday: string;
  hoursSaturday: string;
  hoursSunday: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
}

// Distritos de Lima para el checkout
export const LIMA_DISTRICTS = [
  'Barranco', 'Breña', 'Chorrillos', 'La Molina', 'La Victoria',
  'Lima (Cercado)', 'Lince', 'Magdalena del Mar', 'Miraflores',
  'Pueblo Libre', 'Rímac', 'San Borja', 'San Isidro', 'San Luis',
  'San Miguel', 'Santiago de Surco', 'Surquillo', 'Jesús María',
  'Ate', 'San Juan de Lurigancho', 'Los Olivos', 'Callao',
] as const;

export type LimaDistrict = typeof LIMA_DISTRICTS[number];
