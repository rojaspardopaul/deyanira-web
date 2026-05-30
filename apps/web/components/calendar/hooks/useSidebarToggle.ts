'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'admin_sidebar_collapsed';

/**
 * Persists the admin navigation sidebar collapsed/expanded state in localStorage.
 * Safe for SSR — reads localStorage only inside useEffect.
 */
export function useSidebarToggle() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') setCollapsed(true);
    } catch { /* localStorage not available */ }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* */ }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
