// Tipos del wizard de reservas. Extraídos de BookingWizard.tsx (feature-first).

export type Service = {
  id: string;
  name: string;
  duration: number;
  pricePen: number;
  description?: string;
  categoryId?: string | null;
  category?: { id: string; name: string; icon?: string } | null;
  catalogSlug?: string | null;
  imageUrl?: string | null;
  [key: string]: unknown;
};
export type Staff = { id: string; name: string; role?: string; [key: string]: unknown };
export type Category = { id: string; name: string; icon?: string | null; slug?: string };
export type Slot = { start: string; end: string };
export type GuestInfo = { name: string; phone: string; email: string };
export type Step = 1 | 2 | 3 | 4;
export type AuthUser = { id: string; email?: string; name?: string; token: string };

export type Assignment = {
  service: Service;
  staff: Staff | null;
  onDuty: boolean;
};
