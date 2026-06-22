import { useLayoutEffect, useState } from 'react';
import { Inbox, inboxStats } from '../index';
import { listen, lastEvent } from '../../../events/events';
import * as _ from 'lodash';

/**
 * React hook that returns memoized statistics about the current inbox.
 *
 * It subscribes to the global `"inbox"` event and recalculates the stats only
 * when the underlying inbox data actually changes. Components that consume
 * this hook therefore re-render only when the statistics themselves change.
 */
// Derive the stats type from the existing helper function
type InboxStats = ReturnType<typeof inboxStats>;

const useInboxStats = (shouldSubscribe: boolean = true): InboxStats | null => {
  // Get the initial inbox value synchronously (if available)
  const initialInbox = lastEvent<Inbox | null>('inbox') ?? null;
  const initialStats = initialInbox ? inboxStats(initialInbox) : null;

  const [stats, setStats] = useState<InboxStats | null>(initialStats);

  // Keep the stats in sync with inbox updates.
  useLayoutEffect(() => {
    if (!shouldSubscribe) {
      return;
    }
    return listen<Inbox | null>(
      'inbox',
      (newInbox) => {
        const newStats = newInbox ? inboxStats(newInbox) : null;
        setStats((prevStats) =>
          _.isEqual(prevStats, newStats) ? prevStats : newStats
        );
      },
      true, // Immediately fire with the current value
    );
  }, [shouldSubscribe]);

  return stats;
};

export {
  useInboxStats,
}; 
