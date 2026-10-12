import { PixelRatio, StyleProp, processColor } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { Logo16 } from '.';
import { LogoSizeStrings, resolveLogoSize } from './common';
import { LOGO_SPINNERS } from './spinner';

const spinnerKey = (color: string, px: number) => `${String(processColor(color))} ${px}`;

const SPINNERS = new Map(
  LOGO_SPINNERS.map(([color, px, source]) => [spinnerKey(color, px), source]));

const PIXEL_SIZES = [...new Set(LOGO_SPINNERS.map(([, px]) => px))]
  .sort((a, b) => a - b);

const spinnerSource = (color: string, sizePx: number) => {
  const devicePx = PixelRatio.getPixelSizeForLayoutSize(sizePx);
  const px = PIXEL_SIZES.find((p) => p >= devicePx) ?? PIXEL_SIZES[PIXEL_SIZES.length - 1];
  return SPINNERS.get(spinnerKey(color, px));
};

const LogoActivityIndicator = ({
  size = 'large',
  color = 'white',
  style,
}: {
  size?: LogoSizeStrings,
  color?: string,
  style?: StyleProp<ImageStyle>,
}) => {
  const sizePx = resolveLogoSize(size);
  const source = spinnerSource(color, sizePx);

  if (source === undefined) {
    if (__DEV__) {
      console.warn(
        `No pre-rendered logo spinner in ${color}, so it falls back to a ` +
        `slower animation. Add the colour to spinnerColors in ` +
        `components/logo/logo-16.json, then run ` +
        `components/logo/generate-spinner.py.`
      );
    }

    return (
      <Logo16
        size={size}
        color={color}
        style={style}
        doAnimate={true}
        startVisible={true}
        fadeInDelay={0}
        fadeOutDelay={0}
      />
    );
  }

  return (
    <Image
      source={source}
      cachePolicy="memory"
      style={[{ width: sizePx, height: sizePx }, style]}
    />
  );
};

export { LogoActivityIndicator };
