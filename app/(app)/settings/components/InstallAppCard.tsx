"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { CheckCircle2, Download, Share } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Chrome only exposes this event (and the methods on it) once its own
// installability check already passed -- there's no standard lib.dom type
// for it since it's Chromium-specific.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// `window` doesn't exist during SSR, and even on the client, the true answer
// isn't known until hydration -- useSyncExternalStore (not useEffect+state,
// which this repo's lint config rejects, see ThemeToggleCard) is the
// React-native way to read a browser-only value without a hydration
// mismatch: it renders the server snapshot through the first client paint,
// then swaps to the real client snapshot right after, automatically.
const noopSubscribe = () => () => {};

function useIsIos() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /iphone|ipad|ipod/i.test(window.navigator.userAgent),
    () => false,
  );
}

function useIsStandaloneDisplay() {
  return useSyncExternalStore(
    noopSubscribe,
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari's own (non-standard, but only signal it exposes) flag.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
}

type InstallSnapshot = { event: BeforeInstallPromptEvent | null; installed: boolean };
const SERVER_SNAPSHOT: InstallSnapshot = { event: null, installed: false };

function useInstallPrompt() {
  // A ref, not state: the snapshot object itself only gets replaced (a new
  // reference) inside the event handlers below, so useSyncExternalStore's
  // Object.is comparison between renders stays cheap and correct.
  const snapshotRef = useRef<InstallSnapshot>(SERVER_SNAPSHOT);

  const subscribe = useCallback((onStoreChange: () => void) => {
    function handleBeforeInstallPrompt(event: Event) {
      // Suppresses Chrome's own mini-infobar so our button is the one and
      // only prompt -- otherwise both could show up independently.
      event.preventDefault();
      snapshotRef.current = { event: event as BeforeInstallPromptEvent, installed: false };
      onStoreChange();
    }
    function handleAppInstalled() {
      snapshotRef.current = { event: null, installed: true };
      onStoreChange();
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const getSnapshot = useCallback(() => snapshotRef.current, []);
  const getServerSnapshot = useCallback(() => SERVER_SNAPSHOT, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function InstallAppCard() {
  const { event: installEvent, installed: appInstalledFired } = useInstallPrompt();
  const isIos = useIsIos();
  const isStandalone = useIsStandaloneDisplay();

  const installed = appInstalledFired || isStandalone;
  const showIosInstructions = !installed && isIos;

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    // No manual state update needed here -- a successful install fires the
    // browser's own "appinstalled" event, which useInstallPrompt already
    // listens for.
  }

  if (installed) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-(--viz-status-good)" />
          Installed as an app on this device.
        </CardContent>
      </Card>
    );
  }

  if (!showIosInstructions && !installEvent) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Get the app</CardTitle>
        <CardDescription>
          Add Solar Dashboard to your home screen for a full-screen, app-like experience -- no
          browser bar, its own icon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showIosInstructions ? (
          <p className="text-sm text-muted-foreground">
            Tap <Share className="inline size-3.5 -translate-y-px" /> Share in Safari&apos;s
            toolbar, then &quot;Add to Home Screen&quot;.
          </p>
        ) : (
          <Button size="sm" onClick={handleInstall}>
            <Download className="size-4" />
            Install app
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
