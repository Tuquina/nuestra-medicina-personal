const ORDER_KEY_PREFIX = 'nmp.checkout.order.';

export function readCheckoutOrderId(bookSlug: string): string | null {
  return window.sessionStorage.getItem(`${ORDER_KEY_PREFIX}${bookSlug}`);
}

export function storeCheckoutOrderId(bookSlug: string, orderId: string): void {
  window.sessionStorage.setItem(`${ORDER_KEY_PREFIX}${bookSlug}`, orderId);
}
