import React, { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { cartItems, isCartOpen, setIsCartOpen, removeFromCart } from '../store/cartStore';

export default function SideCart() {
  const items = useStore(cartItems);
  const isOpen = useStore(isCartOpen);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const total = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity duration-300"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      {/* Slide-over panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-surface shadow-2xl z-[101] transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/20">
          <h2 className="text-xl font-extrabold font-headline text-primary flex items-center gap-2">
            Warenkorb
            <span className="bg-primary/10 text-primary text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
              {items.length}
            </span>
          </h2>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant/50 text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-on-surface-variant/60">
              <span className="material-symbols-outlined text-5xl mb-4 opacity-50">shopping_bag</span>
              <p className="font-medium">Ihr Warenkorb ist noch leer.</p>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="mt-6 text-sm font-bold text-primary hover:underline"
              >
                In der Mediathek stöbern
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map(item => (
                <div key={item.id} className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 flex gap-4 animate-[fadeIn_0.3s_ease-out]">
                  <div className="w-16 h-12 bg-primary/5 rounded-lg border border-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary/40 text-2xl">smart_display</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-on-surface truncate pr-2">{item.title}</h4>
                    <div className="text-xs text-on-surface-variant font-medium mt-1">Einzelkauf</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-extrabold text-primary">{item.price} €</span>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase tracking-widest flex items-center transition-colors"
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-outline-variant/20 p-6 bg-surface-container-lowest">
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm text-on-surface-variant font-medium">Zwischensumme (netto)</span>
              <span className="font-extrabold text-xl text-primary">{total} €</span>
            </div>
            <a 
              href="/kasse"
              className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary-fixed-dim transition-all shadow-md flex justify-center items-center gap-2 group block text-center"
            >
              Weiter zur Kasse <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </a>
          </div>
        )}
      </div>
    </>
  );
}
