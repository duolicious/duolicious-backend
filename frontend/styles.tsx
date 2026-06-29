import { StyleSheet } from 'react-native';

const commonStyles = StyleSheet.create({
  primaryEnlargeablePhotoBigScreen: {
    overflow: 'hidden',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  secondaryEnlargeablePhoto: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 12,
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
