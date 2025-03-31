import {
  ViewProps,
  ImageBackground,
} from 'react-native';
import { isMobile } from '../util/util';

type HeartBackgroundProps = ViewProps & {
  children: React.ReactNode;
};

const HeartBackground: React.FC<HeartBackgroundProps> = ({ children, ...props }) => {
  if (isMobile()) {
    return <>{children}</>;
  }

  return (
    <ImageBackground
      source={require('../assets/tiled-hearts-64.png')}
      resizeMode="repeat"
      {...props}
    >
      {children}
    </ImageBackground>
  );
};

export { HeartBackground };
