import { OptionGroup, OptionGroupInputs } from '../data/option-groups';

export type OptionScreenPayload = {
  optionGroups: OptionGroup<OptionGroupInputs>[];
  showSkipButton?: boolean;
  showCloseButton?: boolean;
  showBackButton?: boolean;
  onSubmitSuccess?: () => void;
  backgroundColor?: string;
  color?: string;
};

const store: Record<string, OptionScreenPayload | undefined> = {};

// These payloads intentionally live outside of React Navigation's route params
// because they contain functions and complex objects that aren't URL-serializable.
// Callers should populate the store before navigating to the target screen.
// If no payload is registered (e.g. page load via direct URL), the OptionScreen
// will fall back gracefully (pop to top).
//
// Keyed by route name. The implicit invariant is that at most one OptionScreen
// instance for a given route name is mid-mount at any time. The current call
// sites all populate the store synchronously immediately before
// `navigation.navigate(...)`, and OptionScreen snapshots the payload in a
// `useState` initializer (which runs synchronously on mount), so a same-tick
// double-write is the only way callers could clobber each other. Multi-step
// wizards (`OptionScreen._onSubmitSuccess`) rely on this: each step writes a
// fresh payload then pushes another copy of the same screen.
export const setOptionScreenPayload = (
  screenName: string,
  payload: OptionScreenPayload,
) => {
  store[screenName] = payload;
};

export const getOptionScreenPayload = (
  screenName: string,
): OptionScreenPayload | undefined => {
  return store[screenName];
};

export const clearOptionScreenPayload = (screenName: string) => {
  delete store[screenName];
};

// Drop every queued payload. Called on sign-out so that a stale wizard
// payload from the previous session can't be picked up by a different user
// signing in on the same browser.
export const resetOptionScreenPayloads = () => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
};
