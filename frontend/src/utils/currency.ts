/**
 * Currency and Ledger Formatting Utilities
 * All financial calculations in the backend are performed in integer minor units (paise).
 * 1 INR = 100 paise.
 */

/**
 * Format paise (integer minor units) into Indian Rupee currency format (₹).
 * Supports string, number, or bigint inputs.
 */
export function formatPaiseToRupees(paise: string | number | bigint | undefined | null): string {
  if (paise === undefined || paise === null) {
    return '₹0.00';
  }

  let paiseValue: number;
  if (typeof paise === 'bigint') {
    paiseValue = Number(paise);
  } else if (typeof paise === 'string') {
    paiseValue = parseFloat(paise);
    if (isNaN(paiseValue)) return '₹0.00';
  } else {
    paiseValue = paise;
  }

  const rupees = paiseValue / 100;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Convert user rupee input (e.g. "150.25") to integer paise (e.g. 15025) as a string.
 * Avoids binary floating-point rounding errors.
 */
export function rupeesToPaise(rupees: string | number): string {
  if (typeof rupees === 'number') {
    return Math.round(rupees * 100).toString();
  }

  const trimmed = rupees.trim();
  if (!trimmed) return '0';

  // Support inputs like "100", "100.5", "100.50"
  const parts = trimmed.split('.');
  const integerPart = parts[0].replace(/,/g, '');
  const fractionalPart = parts[1] || '';

  // Pad or trim fractional part to 2 digits
  const paddedFraction = (fractionalPart + '00').slice(0, 2);

  const totalPaise = BigInt(integerPart || '0') * BigInt(100) + BigInt(paddedFraction);
  return totalPaise.toString();
}

/**
 * Format ISO timestamp string into human-readable Indian standard time format.
 */
export function formatDateTime(isoString: string | undefined | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

