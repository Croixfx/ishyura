/**
 * Single source of truth for physical-product prices (RWF, per unit).
 * The API computes every order total from this table and ignores any price a client sends;
 * the order screens import it so what customers see is what the server charges.
 */
export const ORDER_UNIT_PRICES = {
  acrylic_stand: 5000,
  vinyl_stickers: 3500, // pack of 5
  smart_nfc_stand: 8000,
  pro_bundle: 9500,
  custom: 28000, // base price for a custom branding stand
} as const;

export type CatalogItemType = keyof typeof ORDER_UNIT_PRICES;

export const MAX_ORDER_QUANTITY = 20;

export function isCatalogItem(value: string): value is CatalogItemType {
  return Object.prototype.hasOwnProperty.call(ORDER_UNIT_PRICES, value);
}
