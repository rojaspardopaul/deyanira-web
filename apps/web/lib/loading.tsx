'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import ScissorsLoader from '@/components/ui/ScissorsLoader';

interface LoadingContextValue {
  show: () => void;
  hide: () => void;
  wrap: <T>(promise: Promise<T>) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const show = useCallback(() => setCount((n) => n + 1), []);
  const hide = useCallback(() => setCount((n) => Math.max(0, n - 1)), []);

  const wrap = useCallback(
    async <T,>(promise: Promise<T>): Promise<T> => {
      show();
      try {
        return await promise;
      } finally {
        hide();
      }
    },
    [show, hide]
  );

  return (
    <LoadingContext.Provider value={{ show, hide, wrap }}>
      {children}
      {count > 0 && <ScissorsLoader />}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used inside LoadingProvider');
  return ctx;
}
