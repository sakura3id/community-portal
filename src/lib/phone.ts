/**
 * Normalizes a WhatsApp/phone number input to a standard format with country code.
 * Defaults to +62 if no country code is present.
 */
export function normalizeWhatsAppNumber(input: string, defaultCountryCode = '+62'): string {
  // Remove spaces, hyphens, parentheses, and any characters other than digits and "+"
  let cleaned = input.replace(/[^\d+]/g, '');

  if (!cleaned) return '';

  // If it starts with '0', replace '0' with defaultCountryCode (e.g., '0812...' -> '+62812...')
  if (cleaned.startsWith('0')) {
    cleaned = defaultCountryCode + cleaned.substring(1);
  }
  // If it starts with '8' and default is +62, prepend '+62' (e.g., '812...' -> '+62812...')
  else if (cleaned.startsWith('8') && defaultCountryCode === '+62') {
    cleaned = defaultCountryCode + cleaned;
  }
  // If it starts with '62' (no plus), prepend '+' (e.g., '62812...' -> '+62812...')
  else if (cleaned.startsWith('62')) {
    cleaned = '+' + cleaned;
  }
  // If it's pure digits and doesn't start with a plus, prepend '+'
  else if (/^\d+$/.test(cleaned) && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

/**
 * Validates whether a normalized WhatsApp number is structurally correct.
 * Check: starts with '+' and has between 9 and 15 digits following it.
 */
export function validateWhatsAppNumber(normalizedInput: string): boolean {
  if (!normalizedInput) return false;
  if (!normalizedInput.startsWith('+')) return false;

  const digitsOnly = normalizedInput.replace('+', '');
  return /^\d+$/.test(digitsOnly) && digitsOnly.length >= 9 && digitsOnly.length <= 15;
}

/**
 * Parses a full WhatsApp number into its country code and body components.
 * Defaults to +62.
 */
export function parseWhatsAppNumber(fullNumber: string | null | undefined): { countryCode: string; body: string } {
  if (!fullNumber) return { countryCode: '+62', body: '' };

  const cleaned = fullNumber.replace(/[^\d+]/g, '');
  if (!cleaned) return { countryCode: '+62', body: '' };

  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('62')) {
      return { countryCode: '+62', body: cleaned.substring(2) };
    }
    if (cleaned.startsWith('0')) {
      return { countryCode: '+62', body: cleaned.substring(1) };
    }
    return { countryCode: '+62', body: cleaned };
  }

  if (cleaned.startsWith('+62')) {
    return { countryCode: '+62', body: cleaned.substring(3) };
  }

  const match = cleaned.match(/^(\+\d{1,4})(.*)$/);
  if (match) {
    return { countryCode: match[1], body: match[2] };
  }

  return { countryCode: '+62', body: cleaned };
}

