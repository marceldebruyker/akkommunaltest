import React, { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { cartItems, setIsCartOpen } from '../store/cartStore';

export default function CartIcon() {
  const items = useStore(cartItems);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="relative flex items-center justify-center w-9 h-9 text-[#475569] opacity-50">
        <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
      </button>
    );
  }

  return (
    <button 
      onClick={() => setIsCartOpen(true)}
      className="relative flex items-center justify-center w-9 h-9 rounded-full text-[#475569] hover:bg-gray-100 dark:hover:bg-white/10 dark:text-slate-300 transition-colors group"
      aria-label="Warenkorb öffnen"
    >
      <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">shopping_cart</span>
      {items.length > 0 && (
        <span className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 bg-[#f8981d] text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-[#05183a] animate-[scaleIn_0.2s_ease-out]">
          {items.length}
        </span>
      )}
    </button>
  );
}
