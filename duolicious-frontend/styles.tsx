import { StyleSheet } from 'react-native';

const commonStyles = StyleSheet.create({
  primaryEnlargeablePhotoBigScreen: {
    overflow: 'hidden',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  secondaryEnlargeablePhoto: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
  },
  secondaryEnlargeablePhotoInner: {
  },
  cardBorders: {
    borderRadius: 10,

    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 3,
  },
});

export {
  commonStyles,
};
