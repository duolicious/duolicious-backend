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
    return getCurrentScreen(currentRoute.state);
  }

  // Return the name of the current route if available
  return currentRoute.name || null;
};

export {
  getCurrentScreen,
};
