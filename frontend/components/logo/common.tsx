import { StyleProp, ViewStyle } from 'react-native';
import logo16 from './logo-16.json';

type LogoSizeStrings = keyof typeof logo16.sizesPx;

type LogoSize = number | LogoSizeStrings;

// Sizes are multiples of 16 (the logo's grid resolution) so each cell maps to a
// whole number of pixels and stays crisp on low-dpi displays.
const LOGO_SIZE_PX: Record<LogoSizeStrings, number> = logo16.sizesPx;

const resolveLogoSize = (size: LogoSize): number =>
  typeof size === 'number' ? size : LOGO_SIZE_PX[size];

type Logo14Props = {
  size?: number,
  color?: string,
  rectSize?: number,
};

type Logo16Props = {
  size?: LogoSize;
  color?: string;
  rectSize?: number;
  fadeOutDelay?: number;
  fadeInDelay?: number;
  doAnimate?: boolean;
  doLoop?: boolean;
  startVisible?: boolean;
  style?: StyleProp<ViewStyle>;
};

const LOGO_16_RECT_COORDINATES = logo16.cells.map(([x, y]) => ({
  x: x * 0.26458332,
  y: y * 0.26458332,
}));

const LOGO_16_STAGGER_MS = logo16.staggerMs;

const LOGO_16_FADE_MS = logo16.fadeMs;

export {
  LOGO_16_FADE_MS,
  LOGO_16_STAGGER_MS,
  Logo14Props,
  Logo16Props,
  LogoSize,
  LogoSizeStrings,
  LOGO_16_RECT_COORDINATES,
  resolveLogoSize,
}
