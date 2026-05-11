import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Capture as early as possible — the event often fires before React mounts
let _cached: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _cached = e as BeforeInstallPromptEvent;
  });
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(_cached);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  // iOS Safari: iPhone/iPad running WebKit but not Chrome/Firefox/Edge on iOS
  const isIOSSafari =
    /iPhone|iPad|iPod/.test(ua) &&
    /WebKit/.test(ua) &&
    !/CriOS|FxiOS|EdgiOS/.test(ua) &&
    !isStandaloneMode();

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      _cached = evt;
      setPrompt(evt);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!prompt) return 'unavailable';
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    _cached = null;
    setPrompt(null);
    return outcome;
  }

  return {
    canPrompt:    !!prompt && !isStandaloneMode(),
    isIOSSafari,
    isStandalone: isStandaloneMode(),
    triggerInstall,
  };
}
