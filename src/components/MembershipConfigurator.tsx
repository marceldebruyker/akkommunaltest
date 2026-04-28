import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { cartItems, clearCart } from '../store/cartStore';
import { MODULES as MODULE_PRICES, type ModuleId } from '../lib/modules';

// UI-side enrichment of the canonical MODULES catalogue. We keep the price
// in lib/modules.ts so the checkout calculation cannot drift from this view.
type DisplayModule = {
  id: ModuleId;
  title: string;
  price: number;
  description: string;
  benefits: string[];
};

const MODULES: DisplayModule[] = [
  {
    id: 'grundlagen',
    title: MODULE_PRICES.grundlagen.title,
    price: MODULE_PRICES.grundlagen.price,
    description: 'Fokussiert auf Umsatz- und Ertragsteuern für Quereinsteiger & neue Mitarbeiter.',
    benefits: ['Materieller Zugang zum Portal', 'Arbeitshilfen Download']
  },
  {
    id: 'spezial',
    title: MODULE_PRICES.spezial.title,
    price: MODULE_PRICES.spezial.price,
    description: 'Experten-Zirkel für komplexe Themenbereiche und Aktuelles aus der Rechtsprechung.',
    benefits: ['Materieller Zugang zum Portal', 'Arbeitshilfen Download']
  },
  {
    id: 'praktiker',
    title: MODULE_PRICES.praktiker.title,
    price: MODULE_PRICES.praktiker.price,
    description: 'Fokussierter Fach-Austausch und Erarbeitung von Best-Practice Ansätzen.',
    benefits: ['Materieller Zugang zum Portal', 'Arbeitshilfen Download']
  }
];

const GESAMTPAKET: DisplayModule = {
  id: 'gesamt',
  title: MODULE_PRICES.gesamt.title,
  price: MODULE_PRICES.gesamt.price,
  description: 'Teilnahme an allen angebotenen Modulen und volldigitaler Zugang.',
  benefits: ['Alle Module inklusive', 'Portalzugang & Download Center', 'Gesetzes-Newsletter']
};

const CART_CONFLICT_MESSAGE =
  'Hinweis: Sie haben Einzelvideos im Warenkorb. Wenn Sie Module abonnieren, wird dieser geleert, da Einmalkäufe und Abos nicht auf derselben Rechnung gemischt werden können.\n\nMöchten Sie fortfahren?';

export default function MembershipConfigurator() {
  const [selectedModules, setSelectedModules] = useState<ModuleId[]>([]);
  const [isGesamtpaket, setIsGesamtpaket] = useState(false);
  const cart = useStore(cartItems);

  const toggleModule = (id: ModuleId) => {
    if (isGesamtpaket) {
      setIsGesamtpaket(false);
      setSelectedModules([id]);
      return;
    }
    setSelectedModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const selectGesamtpaket = () => {
    setIsGesamtpaket(prev => !prev);
    setSelectedModules([]);
  };

  // Goes to checkout with the given abo plan, prompting first if the cart
  // already holds one-off purchases (incompatible billing flow).
  const goToCheckout = (planQuery: string) => {
    if (cart.length > 0) {
      if (!window.confirm(CART_CONFLICT_MESSAGE)) return;
      clearCart();
    }
    window.location.href = `/kasse?abo=${planQuery}`;
  };

  // Calculate totals
  const totalPrice = isGesamtpaket
    ? GESAMTPAKET.price
    : selectedModules.reduce((acc, id) => acc + (MODULE_PRICES[id]?.price ?? 0), 0);

  const selectedTitles = isGesamtpaket
    ? [GESAMTPAKET.title]
    : selectedModules.map(id => MODULE_PRICES[id]?.title).filter(Boolean);

  const hasSelection = isGesamtpaket || selectedModules.length > 0;

  const handleSubscribe = () => {
    goToCheckout(isGesamtpaket ? 'gesamt' : selectedModules.join(','));
  };

  return (
    <div className="relative pb-32">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        
        {/* Individual Modules */}
        {MODULES.map((mod) => {
          const isSelected = selectedModules.includes(mod.id);
          const isDisabled = isGesamtpaket; // Although it deselects, visually it might just be dim? Let's just let "Gesamtpaket" visually uncheck them.

          return (
            <div 
              key={mod.id}
              onClick={() => toggleModule(mod.id)}
              className={`p-8 rounded-2xl border transition-all duration-300 flex flex-col cursor-pointer relative ${
                isSelected 
                  ? 'bg-primary/5 border-primary shadow-md ring-1 ring-primary' 
                  : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/50 hover:shadow-xl'
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4 text-primary">
                  <span className="material-symbols-outlined fill-current uppercase">check_circle</span>
                </div>
              )}
              <h4 className="text-lg font-bold font-headline mb-2 text-on-surface pr-6">{mod.title}</h4>
              <div className="text-3xl font-extrabold text-primary mb-2">
                {mod.price.toLocaleString('de-DE')} € <span className="text-xs font-normal text-on-surface-variant">/ Jahr</span>
              </div>
              <p className="text-xs text-on-surface-variant mb-6 font-medium">{mod.description}</p>
              
              <ul className="text-xs space-y-4 mb-6 flex-1">
                {mod.benefits.map((ben, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-xs text-primary bg-primary/10 rounded-full p-0.5">check</span> 
                    <span>{ben}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={(e) => { e.stopPropagation(); goToCheckout(mod.id); }}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                  isSelected
                    ? 'bg-primary text-white shadow-md hover:bg-primary/90'
                    : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                }`}
              >
                Jetzt buchen →
              </button>
            </div>
          );
        })}

        {/* Gesamtpaket */}
        <div 
          onClick={selectGesamtpaket}
          className={`p-8 rounded-2xl border transition-all duration-300 flex flex-col cursor-pointer transform lg:scale-105 relative z-20 ${
            isGesamtpaket 
              ? 'bg-primary text-white border-primary shadow-2xl ring-2 ring-primary-fixed-dim' 
              : 'bg-primary-container text-white border-primary-fixed-dim/30 hover:bg-primary transition-colors hover:shadow-xl'
          }`}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-fixed-dim to-primary-fixed text-primary text-[10px] font-extrabold px-4 py-1 rounded-full uppercase tracking-widest shadow-md">
            Empfehlung
          </div>
          
          {isGesamtpaket && (
             <div className="absolute top-4 right-4 text-primary-fixed-dim">
               <span className="material-symbols-outlined fill-current uppercase">check_circle</span>
             </div>
          )}

          <h4 className="text-lg font-bold font-headline mb-2 text-on-primary pr-6">{GESAMTPAKET.title}</h4>
          <div className="text-3xl font-extrabold text-white mb-2">
            {GESAMTPAKET.price.toLocaleString('de-DE')} € <span className="text-xs font-normal text-white/70">/ Jahr</span>
          </div>
          <p className="text-xs text-white/80 mb-6 font-medium">{GESAMTPAKET.description}</p>
          
          <ul className="text-xs space-y-4 mb-6 flex-1">
            {GESAMTPAKET.benefits.map((ben, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="material-symbols-outlined text-xs text-primary-fixed-dim bg-primary-fixed-dim/20 rounded-full p-0.5">check</span> 
                <span>{ben}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={(e) => { e.stopPropagation(); goToCheckout('gesamt'); }}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
              isGesamtpaket
                ? 'bg-white text-primary shadow-md hover:bg-white/90'
                : 'bg-white/20 text-white hover:bg-white hover:text-primary border border-white/30'
            }`}
          >
            Gesamtpaket buchen →
          </button>
        </div>
      </div>

      {/* Sticky Bar */}
      {hasSelection && (
        <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-[#05183a] border-t border-gray-200 dark:border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50 animate-[slideUp_0.4s_ease-out]">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Ihre Auswahl:</span>
              <span className="text-base font-bold text-primary font-headline">
                {selectedTitles.join(' + ')}
              </span>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Gesamt</div>
                <div className="text-2xl font-extrabold text-primary font-headline leading-none">
                  {totalPrice.toLocaleString('de-DE')} € <span className="text-sm font-normal">/ Jahr</span>
                </div>
              </div>
              <button 
                onClick={handleSubscribe}
                className="bg-primary hover:bg-primary-fixed text-white hover:text-primary font-bold py-3 px-6 rounded-xl transition-all shadow-md active:scale-95 whitespace-nowrap"
              >
                Zahlungspflichtig abonnieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tailwind Animation keys for the sticky bar */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
