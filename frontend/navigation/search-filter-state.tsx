import { notify } from '../events/events';

// Module-level store for the search-filter Q&A answers so that the filter tab
// and the Q&A filter sub-screen can share state without passing mutable
// objects or callbacks through navigation params.

export type SearchFilterAnswer = {
  question_id: number;
  question: string;
  topic: string;
  answer: boolean | null;
  accept_unanswered: boolean;
};

let answers: SearchFilterAnswer[] = [];

export const setSearchFilterAnswers = (next: SearchFilterAnswer[]) => {
  answers = [...next];
  notify('search-filter-answers-updated', answers);
};

export const getSearchFilterAnswers = (): SearchFilterAnswer[] => answers;

// Drop any cached answers on sign-out so the next user doesn't inherit the
// previous user's filter state. Doesn't notify subscribers because there
// shouldn't be any mounted at sign-out time (the screens live behind auth).
export const resetSearchFilterAnswers = () => {
  answers = [];
};
