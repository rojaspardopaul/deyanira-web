'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type SalonSettings = {
  salonName?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  district?: string;
  city?: string;
  lat?: string | number;
  lng?: string | number;
  hoursWeekday?: string;
  hoursSaturday?: string;
  hoursSunday?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  logoIconUrl?: string;
  bookingNoticeHours?: number;
  cancellationHours?: number;
  atHomeEnabled?: boolean;
  atHomeBasePen?: string | number;
  atHomeBaseKm?: number;
  atHomeRatePen?: string | number;
  bookingTimerSeconds?: number;
  [key: string]: unknown;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Module-level Promise so concurrent calls share one request
let _promise: Promise<SalonSettings> | null = null;

export function invalidateSalonSettingsCache() {
  _promise = null;
}

function fetchSettings(): Promise<SalonSettings> {
  if (!_promise) {
    _promise = fetch(`${API_URL}/api/settings/public`)
      .then(r => r.ok ? r.json() : {})
      .catch(() => ({}));
  }
  return _promise;
}

const SalonSettingsCtx = createContext<SalonSettings | null>(null);

export function SalonSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SalonSettings | null>(null);
  useEffect(() => {
    fetchSettings().then(setSettings);
  }, []);
  return (
    <SalonSettingsCtx.Provider value={settings}>
      {children}
    </SalonSettingsCtx.Provider>
  );
}

export function useSalonSettings(): SalonSettings | null {
  return useContext(SalonSettingsCtx);
}
