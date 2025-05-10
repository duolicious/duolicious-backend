import { Component, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

/** How many times the boundary will call `onError` before giving up. */
const MAX_RETRIES = 3;

interface Props {
  children: ReactNode;
  /**
   * Attempt to recover from the error.
   * Return (or resolve) without throwing to signal success.
   * Throw / reject to signal failure so the boundary can try again.
   */
  onError: () => Promise<void> | void;
  /** Override the retry limit (defaults to 3). */
}

interface State {
  hasError: boolean;
  attempts: number;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, attempts: 0 };

  static getDerivedStateFromError(): Partial<State> {
    // Tell React to render fallback until we decide what to do.
    return { hasError: true };
  }

  componentDidCatch() {
    const { onError } = this.props;
    const { attempts } = this.state;

    if (!onError) {
      return;
    }

    if (attempts >= MAX_RETRIES) {
      return;
    }

    (async () => {
      try {
        await onError();
        // Recovery succeeded – clear the error and re‑render the tree.
      } catch (error) {
        console.error(error);
      }

      this.setState(prev => ({
        hasError: true,
        attempts: prev.attempts + 1,
      }));
    })();
  }

  render() {
    const { hasError, attempts } = this.state;
    const { children } = this.props;

    if (hasError && attempts >= MAX_RETRIES) {
      /* Final hard‑crash message */
      return (
        <View style={styles.container}>
          <Text style={styles.text}>
            Duolicious crashed so hard we don't even have a pretty error
            message.
            {'\n\n'}
            Try clearing your cache/storage or reinstalling the app.
            {'\n\n'}
            If this error persists, contact: support@duolicious.app
          </Text>
        </View>
      );
    }

    return children;
  }
}

/* Example React‑Native styles; replace with your actual StyleSheet */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 26,
  },
  text: {
    textAlign: 'center',
    fontSize: 16,
    color: 'red',
  },
});
