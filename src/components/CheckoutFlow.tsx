import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { cartItems } from '../store/cartStore';

const MODULES = {
  grundlagen: { title: 'Grundlagen Modul', price: 500 },
  spezial: { title: 'Spezialthemen Modul', price: 700 },
  praktiker: { title: 'Praktiker Modul', price: 1200 },
  gesamt: { title: 'Gesamtpaket', price: 1600 }
};

export default function CheckoutFlow({ user = null }: { user?: any }) {
  const [aboIds, setAboIds] = useState<string[] | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentType, setPaymentType] = useState<'stripe' | 'invoice'>('stripe');
  const cart = useStore(cartItems);
  const isLoggedIn = !!user;
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const params = new URLSearchParams(window.location.search);
    const abo = params.get('abo');
    if (abo) {
      setAboIds(abo.split(','));
    }
  }, []);

  if (!isMounted) return <div className="min-h-screen"></div>;

  const isSubscription = aboIds !== null;
  const isCartEmpty = cart.length === 0;

  if (!isSubscription && isCartEmpty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
        <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">shopping_cart</span>
        <h2 className="text-2xl font-bold font-headline text-primary mb-2">Ihre Kasse ist leer</h2>
        <p className="text-on-surface-variant font-body mb-8">Legen Sie Videos in den Warenkorb oder wählen Sie ein Abo-Modul.</p>
        <a href="/mitglied-werden" className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-fixed hover:text-primary transition-colors">
          Zu den Modulen
        </a>
      </div>
    );
  }

  // Calculate Totals
  const aboItems = (aboIds || []).map(id => MODULES[id as keyof typeof MODULES]).filter(Boolean);
  const aboTotal = aboItems.reduce((acc, item) => acc + item.price, 0);
  const cartTotal = cart.reduce((acc, item) => acc + item.price, 0);

  const total = isSubscription ? aboTotal : cartTotal;
  const tax = total * 0.19;
  const grandTotal = total + tax;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setCheckoutError(null);

    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const email = isLoggedIn ? user.email : formData.get('email') as string;
      const password = formData.get('password') as string || '';
      const vorname = formData.get('vorname') as string || '';
      const nachname = formData.get('nachname') as string || '';
      const leitwegId = formData.get('leitwegId') as string || '';
      const behorde = formData.get('behorde') as string || '';
      const strasse = formData.get('strasse') as string || '';
      const plz = formData.get('plz') as string || '';
      const ort = formData.get('ort') as string || '';

      const payload = {
        items: isSubscription
          ? aboItems.map((item, idx) => ({ id: aboIds![idx], title: item.title, price: item.price }))
          : cart.map(item => ({ id: item.id, title: item.title, price: item.price })),
        isSubscription,
        user: { email, password, vorname, nachname, leitwegId, behorde, strasse, plz, ort }
      };

      const endpoint = paymentType === 'invoice' ? '/api/buy-on-invoice' : '/api/create-checkout-session';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe hosted Checkout
      } else if (data.success && paymentType === 'invoice') {
        window.location.href = '/app/fachportal?success=invoice'; // Redirect immediately to Fachportal
      } else {
        setCheckoutError(data.error || 'Es ist ein unbekannter Fehler aufgetreten.');
        setIsLoading(false);
      }
    } catch (err) {
      setCheckoutError('Fehler bei der Verbindung zum Server. Bitte versuchen Sie es erneut.');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-10 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 relative z-10 animate-[fadeIn_0.5s_ease-out]">
      
      {/* Left Column: Order Summary */}
      <div className="flex flex-col">
        <h2 className="text-3xl font-extrabold font-headline text-primary tracking-tight mb-8">Zusammenfassung</h2>
        
        <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/30 shadow-sm flex-1">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-xl">
              {isSubscription ? 'card_membership' : 'video_library'}
            </span>
            <h3 className="text-lg font-bold text-on-surface">
              {isSubscription ? 'Gewähltes Abonnement' : 'Einmaliger Kauf'}
            </h3>
          </div>

          <div className="space-y-4 mb-8">
            {isSubscription ? (
              aboItems.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center pb-4 border-b border-outline-variant/20 last:border-0 last:pb-0">
                  <span className="font-semibold text-on-surface-variant">{item.title}</span>
                  <span className="font-bold text-primary">{item.price.toLocaleString('de-DE')} €</span>
                </div>
              ))
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center pb-4 border-b border-outline-variant/20 last:border-0 last:pb-0">
                  <span className="font-semibold text-on-surface-variant">{item.title}</span>
                  <span className="font-bold text-primary">{item.price.toLocaleString('de-DE')} €</span>
                </div>
              ))
            )}
          </div>

          <div className="bg-surface p-6 rounded-2xl mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-on-surface-variant">Zwischensumme (netto)</span>
              <span className="font-semibold text-on-surface">{total.toLocaleString('de-DE')} €</span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-on-surface-variant">USt. (19%)</span>
              <span className="font-semibold text-on-surface">{tax.toLocaleString('de-DE')} €</span>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-outline-variant/30">
              <span className="font-bold text-lg text-primary">Gesamtbetrag</span>
              <div className="text-right">
                <span className="font-extrabold text-2xl text-primary">{grandTotal.toLocaleString('de-DE')} €</span>
                <div className="text-xs text-on-surface-variant mt-1">
                  {isSubscription ? '/ Jahr (Abonnement)' : 'Einmalige Zahlung'}
                </div>
              </div>
            </div>
          </div>
          
          {isSubscription && (
            <div className="flex items-start gap-3 bg-secondary-container/30 text-secondary-fixed-dim p-4 rounded-xl">
               <span className="material-symbols-outlined text-sm mt-0.5">info</span>
               <p className="text-xs leading-relaxed font-medium">Bequeme jährliche Abrechnung in einem gebündelten Abo. Kündigung jederzeit bis 4 Wochen vor Verlängerung möglich.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Customer Form */}
      <div className="flex flex-col">
        <h2 className="text-3xl font-extrabold font-headline text-primary tracking-tight mb-8">Ihre Daten</h2>
        
        <form onSubmit={handleCheckout} className="bg-white p-8 rounded-3xl border border-outline-variant/20 shadow-xl relative z-20">
          
          {isLoggedIn ? (
            <div className="mb-8">
              <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/20">
                <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center pt-1 font-bold text-xl uppercase shadow-md">
                  {user.email.charAt(0)}
                </div>
                <div>
                  <div className="text-xs font-bold text-primary tracking-widest uppercase mb-0.5">Angemeldet als</div>
                  <div className="font-semibold text-on-surface text-base">{user.email}</div>
                  <a href="/api/auth/signout" className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase mt-1 inline-block transition-colors">Anderes Konto / Abmelden</a>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm font-semibold text-on-surface-variant">Neukunde?</div>
                <a href="/login?redirect=/kasse" className="text-sm font-bold text-primary hover:text-primary-fixed transition-colors">
                  Bereits Kunde? Einloggen
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Vorname</label>
                  <input name="vorname" required type="text" className="w-full bg-surface border border-outline-variant/40 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/60" placeholder="Max" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Nachname</label>
                  <input name="nachname" required type="text" className="w-full bg-surface border border-outline-variant/40 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/60" placeholder="Mustermann" />
                </div>
              </div>

              <div className="space-y-1.5 mb-8">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">E-Mail Adresse</label>
                <input name="email" required type="email" className="w-full bg-surface border border-outline-variant/40 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/60" placeholder="max.mustermann@kommune.de" />
              </div>
            </>
          )}

          <div className="space-y-1.5 mb-4">
             <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Behörde / Kommune / Firma</label>
             <input name="behorde" required={!isLoggedIn} defaultValue={user?.user_metadata?.behorde || ''} type="text" className="w-full bg-surface border border-outline-variant/40 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/60" placeholder="Stadtverwaltung Musterstadt" />
          </div>

          <div className="space-y-1.5 mb-4">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Straße & Hausnummer</label>
            <input name="strasse" required defaultValue={user?.user_metadata?.strasse || ''} type="text" className="w-full bg-surface border border-outline-variant/40 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/60" placeholder="Rathausplatz 1" />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5 col-span-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">PLZ</label>
              <input name="plz" required defaultValue={user?.user_metadata?.plz || ''} type="text" className="w-full bg-surface border border-outline-variant/40 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/60" placeholder="12345" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Ort</label>
              <input name="ort" required defaultValue={user?.user_metadata?.ort || ''} type="text" className="w-full bg-surface border border-outline-variant/40 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/60" placeholder="Musterstadt" />
            </div>
          </div>
          
          <div className="space-y-1.5 mb-8">
             <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Leitweg-ID <span className="text-outline-variant font-normal normal-case tracking-normal">(optional für E-Rechnung)</span></label>
             <input name="leitwegId" type="text" defaultValue={user?.user_metadata?.leitwegId || user?.user_metadata?.leitweg_id || ''} className="w-full bg-surface border border-outline-variant/40 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/60" placeholder="04011000-12345-67" />
          </div>

          {!isLoggedIn && (
            <>
              <hr className="border-outline-variant/20 mb-8" />

              <h3 className="text-lg font-bold text-primary mb-4">Account erstellen</h3>
              <p className="text-xs text-on-surface-variant mb-4 font-medium leading-relaxed">
                Bitte vergeben Sie ein sicheres Passwort, um direkten Zugriff auf das Fachportal zu erhalten.
              </p>

              <div className="space-y-1.5 mb-8">
                 <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Passwort festlegen</label>
                 <input name="password" required type="password" minLength={8} className="w-full bg-surface border border-outline-variant/40 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/60" placeholder="••••••••" />
              </div>
            </>
          )}

          <div className="flex flex-col gap-3">
             {checkoutError && (
               <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm font-medium mb-2 flex items-start gap-3">
                 <span className="material-symbols-outlined text-[20px] text-red-500 mt-0.5">error</span>
                 <span>{checkoutError}</span>
               </div>
             )}

             <button type="submit" onClick={() => setPaymentType('invoice')} disabled={isLoading} className="w-full bg-[#05183a] hover:bg-[#0a2354] text-white text-base font-extrabold py-4 px-6 rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed">
               {isLoading && paymentType === 'invoice' ? (
                 <span className="animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
               ) : (
                 <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">receipt_long</span>
               )}
               Jetzt buchen (Kauf auf Rechnung)
             </button>
             
             <button type="submit" onClick={() => setPaymentType('stripe')} disabled={isLoading} className="w-full bg-surface hover:bg-surface-container border border-outline-variant/50 text-on-surface text-sm font-bold py-3.5 px-6 rounded-xl transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed">
               {isLoading && paymentType === 'stripe' ? (
                 <span className="animate-spin material-symbols-outlined text-[18px]">progress_activity</span>
               ) : (
                 <span className="material-symbols-outlined text-[18px]">credit_card</span>
               )}
               Per Kreditkarte / PayPal zahlen
             </button>
          </div>
          
          <div className="mt-4 text-[11px] text-center text-on-surface-variant">
            Mit Bestätigung der Zahlung akzeptieren Sie unsere <a href="/agb" className="underline hover:text-primary">AGB</a>.
          </div>
        </form>
      </div>

    </div>
  );
}
