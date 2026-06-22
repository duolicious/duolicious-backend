import {
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
} from 'react-native';
import Animated, { AnimatedStyle } from 'react-native-reanimated';
import { useAppTheme } from '../app-theme/app-theme';

const montserratFontFamily: Record<string, string> = {
  '100': 'MontserratThin',
  '200': 'MontserratExtraLight',
  '300': 'MontserratLight',
  '400': 'MontserratRegular',
  '500': 'MontserratMedium',
  '600': 'MontserratSemiBold',
  '700': 'MontserratBold',
  '800': 'MontserratExtraBold',
  '900': 'MontserratBlack',
};

const DefaultText = (props: TextProps & {
  animated?: boolean,
  disableTheme?: boolean,
  animatedStyle?: AnimatedStyle<TextStyle>,
}) => {
  const { appTheme } = useAppTheme();

  const { animatedStyle, ...rest } = props;

  const flatStyle = StyleSheet.flatten(props.style);
  const fontWeight = flatStyle?.fontWeight;
  const fontFamily = flatStyle?.fontFamily;
  const { disableTheme = false } = props;

  const montserratFont: string | undefined = (
    montserratFontFamily[fontWeight ?? ''] || 'MontserratRegular');

  const baseStyle = [
    { fontFamily: fontFamily || montserratFont },
    (disableTheme ? { } : { color: appTheme.secondaryColor }),
    props.style,
  ];

  if (props.animated) {
    return (
      <Animated.Text
        selectable={false}
        {...{...rest, style: [...baseStyle, animatedStyle, { fontWeight: undefined }]}}
      >
        {props.children}
      </Animated.Text>
    );
  } else {
    return (
      <Text
        selectable={false}
        {...{...rest, style: [...baseStyle, { fontWeight: undefined }]}}
      >
        {props.children}
      </Text>
    );
  }
};

export {
  DefaultText,
};
