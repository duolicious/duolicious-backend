import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { DefaultText } from '../default-text';
import { useAppTheme } from '../../app-theme/app-theme';
import { setQuote } from '../conversation-screen/quote';
import { AboutReplyHint } from '../hints/about-reply-hint';
import { NativeAboutText } from './native-about-text';

const WebAboutText = ({
  name,
  about,
  color,
}: {
  name: string,
  about: string,
  color: string,
}) => {
  const ref = useRef<View>(null);
  const isFocused = useIsFocused();

  // Only track selections while this profile is the focused screen. The
  // Conversation Screen gets pushed on top of this profile, which stays mounted
  // underneath; if the listener stayed active, focusing/typing in the message
  // box would collapse the document selection, fire the handler, and wipe the
  // very quote we navigated there to send.
  useEffect(() => {
    if (!isFocused) return;

    const handler = () => {
      const active = document.activeElement;
      if (
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLInputElement
      ) {
        return;
      }

      const selection = window.getSelection?.();
      const node = ref.current as unknown as Node | null;

      if (!selection || selection.isCollapsed || !node) {
        setQuote(null);
        return;
      }

      const within =
        (!!selection.anchorNode && node.contains(selection.anchorNode)) ||
        (!!selection.focusNode && node.contains(selection.focusNode));

      if (within) {
        setQuote({
          text: selection.toString(),
          attribution: name,
        });
      } else {
        setQuote(null);
      }
    };

    document.addEventListener('selectionchange', handler);

    return () => document.removeEventListener('selectionchange', handler);
  }, [isFocused, name]);

  return (
    <View ref={ref}>
      <DefaultText style={{ color }} selectable={true}>
        {about}
      </DefaultText>
    </View>
  );
};

const AboutText = ({
  name,
  about,
  color,
  canReply = false,
}: {
  name: string,
  about: string,
  color: string | undefined,
  canReply?: boolean,
}) => {
  const { appTheme } = useAppTheme();

  const props = {
    name,
    about,
    color: color ?? appTheme.secondaryColor,
  };

  // The main purpose of the remount key is to work around behavior on Android.
  // On Android it becomes impossible to select text on a profile after
  // navigating back to it from a conversation without remounting the text
  // input.
  //
  // It also has the effect of deselecting the highlighted text. That way, the
  // quote is only set when the user has some visual indication of it being set,
  // either on the conversation screen, or the profile.
  const isFocused = useIsFocused();
  const [focus, setFocus] = useState({ isFocused, remountKey: 0 });
  if (focus.isFocused !== isFocused) {
    setFocus({ isFocused, remountKey: focus.remountKey + (isFocused ? 1 : 0) });
  }
  const { remountKey } = focus;

  useEffect(() => {
    return () => setQuote(null);
  }, []);

  return (
    <View style={{ position: 'relative', zIndex: 1000, marginBottom: 20 }}>
      {
        Platform.OS === 'web'
          ? <WebAboutText key={remountKey} {...props} />
          : <NativeAboutText key={remountKey} {...props} />
      }
      {canReply && <AboutReplyHint color={props.color} />}
    </View>
  );
};

export {
  AboutText,
};
