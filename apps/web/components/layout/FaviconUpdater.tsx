'use client';

import { useEffect } from 'react';
import { useSalonSettings } from '@/lib/useSalonSettings';

export default function FaviconUpdater() {
  const settings = useSalonSettings();

  useEffect(() => {
    const url = settings?.logoIconUrl || '/logo-icon.ico';

    const selectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]'];
    selectors.forEach(sel => {
      let link = document.querySelector<HTMLLinkElement>(sel);
      if (!link) {
        link = document.createElement('link');
        link.rel = sel.includes('shortcut') ? 'shortcut icon' : 'icon';
        document.head.appendChild(link);
      }
      link.href = url;
    });
  }, [settings?.logoIconUrl]);

  return null;
}
