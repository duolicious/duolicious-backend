import {
  Image,
  Pressable,
  View,
} from 'react-native';
import {
  useCallback,
  useState,
} from 'react';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons/faCircleXmark'

// TODO: Image picker is shit and doesn't allow cropping on web
// TODO: Image picker is shit and lets you upload any file type on web

const Images = () => {
  return (
    <View>
      <View>
        <PrimaryImage/>
        <SecondaryImages/>
      </View>
    </View>
  );
};

const ImagePlaceholder = () => {
  const [image, setImage] = useState(null);

  const addImage = useCallback(async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      selectionLimit: 1,
    });

    if (!result.canceled && result.assets[0].width && result.assets[0].height) {
      setImage(result.assets[0].uri);
    }
  }, []);

  const removeImage = useCallback(() => {
    setImage(null);
  }, []);

  const Image_ = ({uri}) => {
    return (
      <>
        <Image
          source={{uri: uri}}
          style={{
            height: '100%',
            width: '100%',
            borderRadius: 5,
            borderColor: '#eee',
            borderWidth: 1,
          }}
        />
        <Pressable
          style={{
            position: 'absolute',
            top: -10,
            left: -10,
            padding: 2,
            borderRadius: 999,
            backgroundColor: 'white',
          }}
          onPress={image === null ? undefined : removeImage}
        >
          <FontAwesomeIcon
            icon={faCircleXmark}
            size={26}
            color="#666"
          />
        </Pressable>
      </>
    );
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 5,
      }}
    >
      <Pressable
        onPress={addImage}
        style={{
          borderRadius: 5,
          backgroundColor: '#eee',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          width: '100%',
          aspectRatio: 1,
        }}
      >
        {image === null && <AddIcon/>}
        {image !== null && <Image_ uri={image}/>}
      </Pressable>
    </View>
  );
};

const PrimaryImage = () => {
  return <ImagePlaceholder/>
};

const SecondaryImages = () => {
  const Image_ = () => {
    return <ImagePlaceholder/>
  };

  const Row = () => {
    return (
      <View
        style={{
          flexDirection: 'row',
        }}
      >
        <Image_/>
        <Image_/>
        <Image_/>
      </View>
    );
  };

  return (
    <View>
      <Row/>
      <Row/>
    </View>
  );
};

const AddIcon = () => {
  return (
    <Ionicons
      style={{
        color: '#666',
        fontSize: 42,
      }}
      name="add"/>
  );
};

export {
  Images,
  SecondaryImages,
};
