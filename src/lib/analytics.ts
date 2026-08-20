import { supabase } from './supabase';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

/**
 * Initializes Google Analytics by dynamically injecting the gtag script.
 * @param measurementId The G-XXXXXXXXXX Measurement ID
 * @param appName Identifier for the current application
 */
export const initGA = (measurementId: string, appName: string) => {
  if (!measurementId || typeof window === 'undefined') return;

  // Prevent duplicate insertion
  if (document.getElementById('google-tag-manager-script')) return;

  // Create script tags
  const script = document.createElement('script');
  script.id = 'google-tag-manager-script';
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.async = true;
  document.head.appendChild(script);

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  // Configure Google Tag
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    app_name: appName,
    send_page_view: true,
  });
};

/**
 * Sets persistent user properties in Google Analytics (e.g. user roles, participant types)
 */
export const setUserProperties = (properties: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('set', 'user_properties', properties);
  }
};

export async function track(
  eventName: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  // 1. Send to Google Analytics if available
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      ...properties,
      app_name: 'community_portal',
    });
  }

  // 2. Send to Supabase DB analytics table
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    await supabase.from('analytics_events').insert({
      user_id: user.id,
      app_slug: 'community_portal',
      event_name: eventName,
      properties,
    });
  } catch (error) {
    // Fail silently, never affect application behavior
    console.error('[analytics] Failed to track event:', error);
  }
}

