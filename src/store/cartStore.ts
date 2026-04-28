import { atom } from 'nanostores';

export interface CartItem {
  id: string;
  title: string;
  price: number;
}

export const cartItems = atom<CartItem[]>([]);

if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('ak-kommunal-cart');
  if (stored) {
    try {
      cartItems.set(JSON.parse(stored));
    } catch (e) {
      console.error('Failed to parse cart items', e);
    }
  }

  cartItems.subscribe((items) => {
    localStorage.setItem('ak-kommunal-cart', JSON.stringify(items));
  });
}

export const isCartOpen = atom<boolean>(false);

export function addToCart(item: CartItem) {
  const current = cartItems.get();
  if (!current.find(i => i.id === item.id)) {
    cartItems.set([...current, item]);
  }
}

export function removeFromCart(id: string) {
  cartItems.set(cartItems.get().filter(i => i.id !== id));
}

export function clearCart() {
  cartItems.set([]);
}

/**
 * Remove cart entries whose `id` matches a video_slug the user already owns.
 * Called on every authenticated page load so logging in immediately reflects
 * existing entitlements and prevents accidental double-purchase.
 */
export function pruneOwnedFromCart(ownedSlugs: string[]) {
  if (!ownedSlugs.length) return;
  const owned = new Set(ownedSlugs);
  const current = cartItems.get();
  const filtered = current.filter(item => !owned.has(item.id));
  if (filtered.length !== current.length) {
    cartItems.set(filtered);
  }
}

export function setIsCartOpen(open: boolean) {
  isCartOpen.set(open);
}
