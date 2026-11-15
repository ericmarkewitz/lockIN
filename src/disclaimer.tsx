import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { acceptDisclaimer, hasAcceptedDisclaimer } from '@/data/settings';
import { useDb } from '@/db/DbContext';

/**
 * Bump DISCLAIMER_VERSION whenever the meaning of DISCLAIMER changes: everyone who accepted an
 * older version sees the disclaimer again on next launch. Typo fixes don't need a bump.
 */
export const DISCLAIMER_VERSION = 1;

export const DISCLAIMER: readonly string[] = [
  "lockIN is a log for your own workouts. It doesn't give medical, fitness or training advice.",
  'Check with a doctor before starting a new exercise program, and stop if anything hurts.',
];

type DisclaimerContextValue = { accepted: boolean; accept: () => Promise<void> };

const DisclaimerContext = createContext<DisclaimerContextValue>({ accepted: false, accept: async () => {} });

/** Loads whether the current disclaimer was accepted, and records acceptance. Must sit inside <DbProvider>. */
export function DisclaimerProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    hasAcceptedDisclaimer(db, DISCLAIMER_VERSION).then((a) => live && setAccepted(a));
    return () => { live = false; };
  }, [db]);

  // Render nothing until it's known (a few ms) so neither the app nor the disclaimer flashes.
  if (accepted === null) return null;

  const accept = async () => {
    await acceptDisclaimer(db, DISCLAIMER_VERSION);
    setAccepted(true);
  };
  return <DisclaimerContext.Provider value={{ accepted, accept }}>{children}</DisclaimerContext.Provider>;
}

/** Whether the current disclaimer is accepted; the root stack hides every other screen until it is. */
export const useDisclaimer = () => useContext(DisclaimerContext);
