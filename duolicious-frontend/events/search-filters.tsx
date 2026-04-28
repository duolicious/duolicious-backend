import { useLayoutEffect, useState } from 'react';
import { listen, notify, lastEvent } from './events';
import type { SearchFilterAnswer } from '../navigation/search-filter-state';

type SearchFilters = Record<string, any> & {
  answer?: SearchFilterAnswer[];
};

const EVENT_KEY = 'search-filters';

const getSearchFilters = (): SearchFilters | undefined => {
  return lastEvent<SearchFilters | undefined>(EVENT_KEY);
};

const setSearchFilters = (next: SearchFilters | undefined) => {
  notify<SearchFilters | undefined>(EVENT_KEY, next);
};

const patchSearchFilters = (partial: SearchFilters) => {
  const prev = getSearchFilters();
  if (!prev) return;
  notify<SearchFilters>(EVENT_KEY, { ...prev, ...partial });
};

const resetSearchFilters = () => {
  notify<SearchFilters | undefined>(EVENT_KEY, undefined);
};

const useSearchFilters = () => {
  const [value, setValue] = useState<SearchFilters | undefined>(
    getSearchFilters());

  useLayoutEffect(() => {
    return listen<SearchFilters | undefined>(EVENT_KEY, setValue, true);
  }, []);

  return value;
};

export {
  SearchFilters,
  getSearchFilters,
  patchSearchFilters,
  resetSearchFilters,
  setSearchFilters,
  useSearchFilters,
};
