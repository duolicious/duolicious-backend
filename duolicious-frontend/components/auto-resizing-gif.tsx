import {
  ActivityIndicator,
  ImageStyle,
  StyleProp,
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import { useImage, Image } from 'expo-image';

const AutoResizingGif = ({
  uri,
  onError,
  style,
}: {
  uri: string
  onError?: () => void
  style?: StyleProp<ImageStyle>,
}) => {
  const image = useImage(uri, { onError });

  if (!image) {
    return (
      <View
        style={{
          // The dimensions are chosen so the height of the placeholder will be
          // less than or equal to the rendered image. Otherwise
          // scroll-to-bottom will be broken in the case that the image loads
          // after the conversation screen already scrolled to the bottom.
          width: '100%',
          aspectRatio: 1,

          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          borderRadius: 10,
          gap: 12,
        }}
      >
        <ActivityIndicator size="large" color="white" />
        <DefaultText
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: 'white',
          }}
        >
          GIF
        </DefaultText>
      </View>
    );
  }

  return (
    <Image
      source={image}
      transition={150}
      style={[
        {
          width: '100%',
          aspectRatio: image.width / image.height,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: 10,
          overflow: 'hidden',
        },
        style,
      ]}
    />
  );
};

export {
  AutoResizingGif,
};
