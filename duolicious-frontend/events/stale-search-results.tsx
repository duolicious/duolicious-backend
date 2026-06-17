// Answering Q&A questions re-ranks a user's search results (server-side for
// signed-in users, via their anonymous answers for logged-out web users). The
// search tab caches its results, so without a nudge it keeps showing the old
// ranking until manually refreshed. We flag the results as stale whenever an
// answer changes and let the search tab refetch the next time it's focused.

let isStale = false;

const markSearchResultsStale = (): void => {
  isStale = true;
};

// Whether the results have gone stale since this was last called. Reading it
// clears the flag, so the search tab refreshes exactly once per change.
const consumeStaleSearchResults = (): boolean => {
  const wasStale = isStale;
  isStale = false;
  return wasStale;
};

export {
  markSearchResultsStale,
  consumeStaleSearchResults,
};
