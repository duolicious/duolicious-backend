import {
  Text,
  TextProps,
} from 'react-native';
import Animated from 'react-native-reanimated';

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

const DefaultText = (props: TextProps & { animated?: boolean }) => {
  const fontWeight = (props?.style as any)?.fontWeight;
  const fontFamily = (props?.style as any)?.fontFamily;

  const montserratFont: string | undefined = (
    montserratFontFamily[fontWeight] || 'MontserratRegular');

  const props_ = {
    style: [
      {fontFamily: fontFamily || montserratFont},
      props.style,
      {fontWeight: undefined},
    ]
  };

  if (props.animated) {
    return (
      <Animated.Text
        selectable={false}
        {...{...props, ...props_}}
      >
        {props.children}
      </Animated.Text>
    );
  } else {
    return (
      <Text
        selectable={false}
        {...{...props, ...props_}}
      >
        {props.children}
      </Text>
    );
  }
};

export {
  DefaultText,
};
