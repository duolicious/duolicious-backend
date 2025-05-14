import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { DefaultText } from './default-text';
import { listen, notify } from '../events/events';

type TooltipState = {
  text: string
  bottom?: number
  top?: number
  left?: number
  right?: number
} | null | undefined;

const EVENT_KEY = 'tooltip';

const setTooltip = (state: TooltipState) => {
  notify<TooltipState>(EVENT_KEY, state);
}

const Tooltip = ({
  children,
  style,
}: {
  children: any,
  style?: object,
}) => {
  return (
    <DefaultText
      style={{
        backgroundColor: 'black',
        color: 'white',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
        fontSize: 14,
        ...style,
      }}
      numberOfLines={1}
    >
      {children}
    </DefaultText>
  );
};

const TooltipListener = () => {
  const [state, setState] = useState<TooltipState>(null);

  useEffect(() => {
    listen<TooltipState>(EVENT_KEY, setState);
  }, []);

  if (Platform.OS !== 'web') {
    return null;
  }

  if (!state) {
    return null;
  }

  const padding = 10;

  return (
    <View
      style={{
        position: 'absolute',
        top: state.top === undefined ? undefined : state.top - padding,
        bottom: state.bottom === undefined ? undefined : state.bottom - padding,
        left: state.left === undefined ? undefined : state.left - padding,
        right: state.right === undefined ? undefined : state.right - padding,

        paddingTop: state.top === undefined ? undefined : padding,
        paddingBottom: state.bottom === undefined ? undefined : padding,
        paddingLeft: state.left === undefined ? undefined : padding,
        paddingRight: state.right === undefined ? undefined : padding,
      }}
      // @ts-ignore
      onMouseLeave={
        () => setTooltip(null)
      }
    >
      <Tooltip>{state.text}</Tooltip>
    </View>
  );
};

export {
  Tooltip,
  TooltipListener,
  TooltipState,
  setTooltip,
};
