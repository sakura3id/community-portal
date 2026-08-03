import id from '../locales/id.json';
import en from '../locales/en.json';

const translations: Record<string, unknown> = { id, en };
let currentLocale = 'id';

export function setLocale(locale: string) {
  if (translations[locale]) {
    currentLocale = locale;
  }
}

export function getLocale() {
  return currentLocale;
}

export function t(path: string, variables?: Record<string, string | number>): string {
  const keys = path.split('.');
  let value: unknown = translations[currentLocale];

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      // Fallback to English if translation key is missing in active locale
      let fallbackValue: unknown = translations['en'];
      for (const fKey of keys) {
        if (fallbackValue && typeof fallbackValue === 'object' && fKey in fallbackValue) {
          fallbackValue = (fallbackValue as Record<string, unknown>)[fKey];
        } else {
          fallbackValue = undefined;
          break;
        }
      }
      if (typeof fallbackValue === 'string') {
        value = fallbackValue;
        break;
      }
      return path; // Return key path as final fallback
    }
  }

  if (typeof value !== 'string') {
    return path;
  }

  if (variables) {
    let result = value;
    for (const [key, val] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), String(val));
    }
    return result;
  }

  return value;
}
