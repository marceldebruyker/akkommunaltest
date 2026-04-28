// Subscription modules and pricing. Single source of truth used by the
// checkout flow and the membership configurator. Prices are pre-tax (netto)
// and quoted in EUR.
export const MODULES = {
  grundlagen: { title: 'Grundlagen Modul', price: 500 },
  spezial: { title: 'Spezialthemen Modul', price: 700 },
  praktiker: { title: 'Praktiker Modul', price: 1200 },
  gesamt: { title: 'Gesamtpaket', price: 1600 }
} as const;

export type ModuleId = keyof typeof MODULES;
export type Module = (typeof MODULES)[ModuleId];
