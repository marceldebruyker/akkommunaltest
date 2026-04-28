import { useState } from 'react';

export type CheckoutItem = { id: string; title: string; price: number };
export type PaymentType = 'stripe' | 'invoice';

export type CheckoutFormFields = {
  email: string;
  password?: string;
  anrede?: string;
  vorname?: string;
  nachname?: string;
  leitwegId?: string;
  behorde?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
};

export type CheckoutPayload = {
  items: CheckoutItem[];
  isSubscription: boolean;
  user: CheckoutFormFields;
};

/**
 * Submit checkout to the right backend (Stripe Checkout vs. Buy-on-Invoice)
 * and handle redirects + error display. UI components own the form rendering;
 * this hook only owns the network + navigation side-effects so they're easy
 * to test in isolation and reuse across pages.
 */
export function useCheckout() {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>('stripe');
  const [error, setError] = useState<string | null>(null);

  const submit = async (payload: CheckoutPayload, type: PaymentType) => {
    setPaymentType(type);
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = type === 'invoice' ? '/api/buy-on-invoice' : '/api/create-checkout-session';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url; // Stripe-hosted checkout
        return;
      }
      if (data.success && type === 'invoice') {
        window.location.href = '/app/fachportal?success=invoice';
        return;
      }

      setError(data.error || 'Es ist ein unbekannter Fehler aufgetreten.');
      setIsLoading(false);
    } catch {
      setError('Fehler bei der Verbindung zum Server. Bitte versuchen Sie es erneut.');
      setIsLoading(false);
    }
  };

  return { submit, isLoading, paymentType, setPaymentType, error };
}
