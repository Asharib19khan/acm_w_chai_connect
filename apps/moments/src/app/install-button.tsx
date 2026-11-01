'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@chai/ui';

/*
 * "Install" in the top-right corner.
 * - Android / desktop Chrome, Edge, Samsung Internet: opens the browser's own install prompt.
 * - iPhone / iPad: Apple gives websites no prompt, so it shows the two Add to Home Screen steps.
 * - Android browsers without a prompt (e.g. Firefox): shows the menu steps.
 * Hidden inside the installed app, and once the app has been installed.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function runningInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallButton() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true); // hidden until we know
  const [help, setHelp] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(runningInstalled());
    navigator.serviceWorker?.register('/sw.js').catch(() => {});

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our button instead of the browser's mini-bar
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const mq = window.matchMedia('(display-mode: standalone)');
    const onMode = () => setInstalled(runningInstalled());
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    mq.addEventListener('change', onMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mq.removeEventListener('change', onMode);
    };
  }, []);

  // Desktop browsers that can't install get no button.
  const show = !installed && platform !== null && (platform !== 'other' || prompt !== null);
  if (!show) return null;

  async function install() {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setPrompt(null); // a prompt can only be used once
      if (outcome === 'accepted') setInstalled(true);
      return;
    }
    setHelp(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="text-fg ring-edge bg-surface/70 hover:bg-surface focus-visible:ring-accent-strong inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 15.5h12" />
        </svg>
        Install
      </button>

      <Modal
        open={help}
        onClose={() => setHelp(false)}
        title="Install Share the moment"
        description={platform === 'ios' ? 'Two taps in Safari:' : 'From your browser menu:'}
      >
        {platform === 'ios' ? (
          <ol className="text-fg flex list-decimal flex-col gap-3 pl-5 text-[0.95rem]">
            <li>
              Tap the <b>Share</b> button{' '}
              <svg aria-label="Share icon" viewBox="0 0 20 20" className="inline size-5 align-[-4px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2.5v10M6.5 6 10 2.5 13.5 6M6 9H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 18h10a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 15 9h-1" />
              </svg>{' '}
              (bottom of the screen in Safari, top right in Chrome).
            </li>
            <li>
              Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.
            </li>
            <li className="text-fg-muted list-none -ml-5 text-sm">
              Opened this from Instagram or WhatsApp? Open it in Safari first, then follow the steps.
            </li>
          </ol>
        ) : (
          <ol className="text-fg flex list-decimal flex-col gap-3 pl-5 text-[0.95rem]">
            <li>
              Tap the browser menu <b>⋮</b> (top right).
            </li>
            <li>
              Tap <b>Install app</b> or <b>Add to Home screen</b>.
            </li>
          </ol>
        )}
      </Modal>
    </>
  );
}
