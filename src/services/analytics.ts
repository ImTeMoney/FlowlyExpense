import posthog from 'posthog-js';

const KEY  = import.meta.env.VITE_POSTHOG_KEY  as string | undefined;
const HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

export function initAnalytics(deviceId: string) {
  if (!KEY) return;
  posthog.init(KEY, {
    api_host: HOST ?? 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    session_recording: { maskAllInputs: true },
    persistence: 'localStorage',
    loaded: ph => ph.identify(deviceId),
  });
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!KEY) return;
  posthog.capture(event, props);
}

export function pageView(path: string) {
  if (!KEY) return;
  posthog.capture('$pageview', { $current_url: window.location.origin + path });
}
