'use client';

import { useEffect, useState } from 'react';
import { CalendarRoot } from '@/components/calendar';
import type { AptStatus } from '@/components/calendar';

export default function CalendarioPage() {
  const [adminRole, setAdminRole] = useState<'super_admin' | 'admin' | 'estilista'>('admin');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('admin_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.role) setAdminRole(u.role);
      }
    } catch { /* */ }
  }, []);

  const defaultHidden: AptStatus[] = ['cancelled', 'no_show'];

  return (
    <CalendarRoot
      adminRole={adminRole}
      defaultView="week"
      defaultHiddenStatuses={defaultHidden}
      enableDrag={adminRole !== 'estilista'}
      enableResize={adminRole !== 'estilista'}
      enableResourceView
    />
  );
}
