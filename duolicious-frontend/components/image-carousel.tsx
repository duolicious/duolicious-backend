import {
  useState,
} from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Pressable,
  View,
} from 'react-native';
import { isMobile } from '../util/util';
import { ImageOrSkeleton } from './profile-card';
import { ChevronLeft, ChevronRight } from "react-native-feather";

const ImageCarousel = ({
  uuids,
  activeIndex,
  onChangeActiveIndex,
  onChangeEmbiggened,
}: {
  uuids: string[] | undefined
  activeIndex: number
  onChangeActiveIndex: (n: number) => void
  onChangeEmbiggened: (uuid: string) => void
}) => {
  const goToPrevSlide = () => {
    if (uuids !== undefined && activeIndex > 0)
      onChangeActiveIndex(activeIndex - 1);
  };

  const goToNextSlide = () => {
    if (uuids !== undefined && activeIndex < uuids.length - 1)
      onChangeActiveIndex(activeIndex + 1);
  };

  return (
    <View style={styles.container}>
      {uuids === undefined &&
        <ImageOrSkeleton
          resolution={900}
          imageUuid={undefined}
          style={styles.image}
        />
      }

      {uuids !== undefined && uuids.length === 0 &&
        <ImageOrSkeleton
          resolution={900}
          imageUuid={null}
          style={styles.image}
        />
      }

      {uuids !== undefined && uuids.map((uuid, index) => (
        <ImageOrSkeleton
          key={index}
          resolution={900}
          imageUuid={uuid}
          style={[styles.image, { opacity: index === activeIndex ? 1 : 0 }]}
          showGradient={false}
        />
      ))}

      {uuids !== undefined && uuids.length >= 2 &&
        <View style={styles.pagination}>
          {uuids.map((_, index) => (
            <View key={index} style={index === activeIndex ? styles.activeDot : styles.dot} />
          ))}
        </View>
      }

      {uuids !== undefined && uuids.length >= 2 &&
        <Pressable onPress={goToPrevSlide} style={styles.leftPressable}>
          {!isMobile() &&
            <View style={styles.leftButton}>
              <ChevronLeft
                stroke="white"
                strokeWidth={4}
                width={40}
                height={40}
              />
            </View>
          }
        </Pressable>
      }

      {uuids !== undefined && uuids.length >= 1 &&
        <Pressable
          onPress={() => onChangeEmbiggened(uuids[activeIndex])}
          style={styles.middleButton}
        />
      }

      {uuids !== undefined && uuids.length >= 2 &&
        <Pressable onPress={goToNextSlide} style={styles.rightPressable}>
          {!isMobile() &&
            <View style={styles.rightButton}>
              <ChevronRight
                stroke="white"
                strokeWidth={4}
                width={40}
                height={40}
              />
            </View>
          }
        </Pressable>
      }
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    userSelect: 'none',
    width: '100%',
    aspectRatio: 1,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  pagination: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    justifyContent: 'center',
    width: '100%',
    display: 'flex',
    padding: 3,
  },
  dot: {
    margin: 3,
    flex: 1,
    height: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#777',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  activeDot: {
    margin: 3,
    flex: 1,
    height: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#777',
    backgroundColor: 'white',
  },
  leftPressable: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '33%',
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'flex-start',
    alignSelf: 'center',
  },
  middleButton: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  rightPressable: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '33%',
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'flex-end',
    alignSelf: 'center',
  },
  leftButton: {
    opacity: 0.6,
    backgroundColor: 'black',
    borderRadius: 999,
    marginLeft: 5,
    paddingLeft: 3,
    height: 50,
    width: 50,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  rightButton: {
    opacity: 0.6,
    backgroundColor: 'black',
    borderRadius: 999,
    marginRight: 5,
    paddingRight: 3,
    height: 50,
    width: 50,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});

export {
  ImageCarousel,
}
