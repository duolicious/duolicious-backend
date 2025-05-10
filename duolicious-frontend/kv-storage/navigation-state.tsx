import { getCurrentScreen } from '../navigation/navigation';
import { storeKv } from './kv-storage';

// The screens 'Profile Option Screen' and 'Search Filter Option Screen'
// include parameters which aren't serializable. Those navigation states
// shouldn't be stored.
const safeScreens = [
  "Conversation Screen",
  "Home/Inbox",
  "Home/Profile/Profile Tab",
  "Home/Q&A",
  "Home/Search/Search Filter Screen/Q&A Filter Screen",
  "Home/Search/Search Filter Screen/Search Filter Tab",
  "Home/Search/Search Screen",
  "Home/Feed",
  "Prospect Profile Screen/Prospect Profile",
];

const navigationState = async (value?: any) => {
  const currentScreen = getCurrentScreen(value);
  if (currentScreen && !safeScreens.includes(currentScreen))
    return null;

  const result = await storeKv(
    "navigation_state",
    typeof value === "undefined" ? undefined
      : !value ? null
      : JSON.stringify(value)
  );

  if (!result) return null;

  try {
    return JSON.parse(result);
  } catch {
    // If the navigation state is invalid json, just ignore it. It will be
    // overwritten with a valid state on the next navigation.
    return null;
  }
};

export {
  navigationState,
}
