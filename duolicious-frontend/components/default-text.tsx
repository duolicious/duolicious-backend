import {
  Text,
  TextProps,
} from 'react-native';

const DefaultText = (props: TextProps) => {
  const fontWeight = (props?.style as any)?.fontWeight;
  const fontFamily = (props?.style as any)?.fontFamily;

  const montserratFontFamily: string | undefined = {
    '100': 'MontserratThin',
    '200': 'MontserratExtraLight',
    '300': 'MontserratLight',
    '400': 'MontserratRegular',
    '500': 'MontserratMedium',
    '600': 'MontserratSemiBold',
    '700': 'MontserratBold',
    '800': 'MontserratExtraBold',
    '900': 'MontserratBlack',
  }[fontWeight] || 'MontserratRegular';

  const props_ = {
    style: [
      {fontFamily: fontFamily || montserratFontFamily},
      props.style,
      {fontWeight: undefined},
    ]
  };
  return (
    <Text
      selectable={false}
      {...{...props, ...props_}}
    >
      {props.children}
    </Text>
  );
};

export {
  DefaultText,
};
