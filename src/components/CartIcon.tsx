import React, { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { cartItems, setIsCartOpen } from '../store/cartStore';

export default function CartIcon() {
  const items = useStore(cartItems);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hide entirely until hydrated, and stay hidden while the cart is empty.
  // An empty cart icon is "discoverability theater" — it doesn't earn its
  // slot until the user has actually put something in it.
  if (!mounted || items.length === 0) {
    return null;
  }

  return (
    <button
      onClick={() => setIsCartOpen(true)}
      className="relative flex items-center justify-center px-2 text-[#475569] hover:text-[#0f172a] dark:text-gray-400 dark:hover:text-white transition-colors group"
      aria-label={`Warenkorb öffnen (${items.length} Artikel)`}
    >
      <span className="material-symbols-outlined text-[22px] group-hover:scale-110 transition-transform">shopping_cart</span>
      <span className="absolute top-0 right-0 translate-x-1 -translate-y-1 bg-primary text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-[scaleIn_0.2s_ease-out]">
        {items.length}
      </span>
    </button>
  );
}
