'use client';

// Estado global del carrito (context) persistido en localStorage (clave 'cart',
// compatible con el código previo). Expone items + acciones + el estado del
// mini-carrito (drawer). Emite 'cart-updated' para compat con listeners antiguos.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type CartItem = {
  id: string;
  slug: string;
  name: string;
  pricePen: number;
  image: string | null;
  qty: number;
  stock?: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const KEY = 'cart';

function read(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Cargar de localStorage al montar + escuchar cambios (otras pestañas / código legacy).
  useEffect(() => {
    setItems(read());
    setHydrated(true);
    const onUpdate = () => setItems(read());
    window.addEventListener('cart-updated', onUpdate);
    window.addEventListener('storage', (e) => { if (e.key === KEY) onUpdate(); });
    return () => window.removeEventListener('cart-updated', onUpdate);
  }, []);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    window.dispatchEvent(new Event('cart-updated'));
  }, []);

  const add = useCallback<CartContextValue['add']>((item, qty = 1) => {
    const cur = read();
    const ex = cur.find((c) => c.id === item.id);
    let next: CartItem[];
    if (ex) {
      const max = item.stock ?? ex.stock ?? Infinity;
      next = cur.map((c) => c.id === item.id ? { ...c, ...item, qty: Math.min(c.qty + qty, max) } : c);
    } else {
      next = [...cur, { ...item, qty }];
    }
    persist(next);
    setDrawerOpen(true);
  }, [persist]);

  const setQty = useCallback<CartContextValue['setQty']>((id, qty) => {
    const next = read()
      .map((c) => c.id === id ? { ...c, qty: Math.max(0, Math.min(qty, c.stock ?? Infinity)) } : c)
      .filter((c) => c.qty > 0);
    persist(next);
  }, [persist]);

  const remove = useCallback<CartContextValue['remove']>((id) => {
    persist(read().filter((c) => c.id !== id));
  }, [persist]);

  const clear = useCallback(() => persist([]), [persist]);

  const value = useMemo<CartContextValue>(() => {
    const list = hydrated ? items : [];
    return {
      items: list,
      count: list.reduce((s, i) => s + i.qty, 0),
      subtotal: list.reduce((s, i) => s + i.pricePen * i.qty, 0),
      add, setQty, remove, clear,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    };
  }, [items, hydrated, drawerOpen, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}
