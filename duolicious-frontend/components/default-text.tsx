import {
  Text,
  TextProps,
} from 'react-native';
import Animated from 'react-native-reanimated';
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
  disableTheme?: boolean
}) => {
  const { appTheme } = useAppTheme();

  const fontWeight = (props?.style as any)?.fontWeight;
  const fontFamily = (props?.style as any)?.fontFamily;
  const { disableTheme = false } = props;

  const montserratFont: string | undefined = (
    montserratFontFamily[fontWeight] || 'MontserratRegular');

  const props_ = {
    style: [
      { fontFamily: fontFamily || montserratFont },
      (disableTheme ? { } : { color: appTheme.secondaryColor }),
      props.style,
      { fontWeight: undefined },
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
