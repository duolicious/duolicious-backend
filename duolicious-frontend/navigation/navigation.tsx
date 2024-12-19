const getCurrentScreen = (navigationState: any): string | null => {
  // Validate the basic structure of the navigation state
  if (
    !navigationState ||
    typeof navigationState !== 'object' ||
    !Array.isArray(navigationState.routes) ||
    typeof navigationState.index !== 'number'
  ) {
    return null;
  }

  // Access the current route using the index
  const currentRoute = navigationState.routes[navigationState.index];
  if (!currentRoute) {
    return null;
  }

  // Recurse into nested state if it exists
  if (currentRoute.state) {
    return currentRoute.name + "/" + getCurrentScreen(currentRoute.state);
  }

  // Return the name of the current route if available
  return currentRoute.name || null;
};

const getCurrentParams = (navigationState: any) => {
  // Validate the basic structure of the navigation state
  if (
    !navigationState ||
    typeof navigationState !== 'object' ||
    !Array.isArray(navigationState.routes) ||
    typeof navigationState.index !== 'number'
  ) {
    return null;
  }

  // Access the current route using the index
  const currentRoute = navigationState.routes[navigationState.index];
  if (!currentRoute) {
    return null;
  }

  // Recurse into nested state if it exists
  if (currentRoute.state) {
    return getCurrentParams(currentRoute.state);
  }

  // Return the params of the current route if available
  return currentRoute.params || null;
};

export {
  getCurrentScreen,
  getCurrentParams,
};
