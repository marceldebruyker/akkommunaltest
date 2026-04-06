import React from 'react';
import { addToCart, setIsCartOpen } from '../store/cartStore';

interface VideoProps {
  id: string;
  title: string;
  price: number;
}

export default function BuyVideoButton({ video }: { video: VideoProps }) {
  const handleBuy = () => {
    addToCart(video);
    setIsCartOpen(true);
  };

  return (
    <button 
      onClick={handleBuy}
      className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary-fixed-dim transition-all shadow-lg hover:-translate-y-1 mb-4 flex justify-center items-center gap-2"
    >
      In den Warenkorb <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
    </button>
  );
}
