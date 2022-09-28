export const PaymentMethods = { bank_transfer: 'Bank Transfer', paypal: 'PayPal', wise: 'Wise' };

/**
 * Check if val is a valid payment method
 * @param val - The value to be checked
 */
export function isValidPaymentMethod(val: string) {
  return PaymentMethods[val] !== undefined;
}

/**
 * Get supported payment methods
 */
export function getPaymentMethods() {
  return Object.keys(PaymentMethods).map((k) => {
    return PaymentMethods[k];
  });
}
