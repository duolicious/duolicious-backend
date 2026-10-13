import { ReactNode } from 'react';
import { Pressable, ViewStyle } from 'react-native';
import { HoverCircle, useHover } from '../hover';

const IconButton = ({
  onPress,
  label,
  style,
  children,
}: {
  onPress: () => void,
  label?: string,
  style?: ViewStyle,
  children: ReactNode,
}) => {
  const { hovered, hoverProps } = useHover();

  return (
    <Pressable
      aria-label={label}
      onPress={onPress}
      style={style}
      {...hoverProps}
    >
      <HoverCircle visible={hovered} />
      {children}
    </Pressable>
  );
};

export {
  IconButton,
};
