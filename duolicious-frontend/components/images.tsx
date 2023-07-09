import {
  ActivityIndicator,
  Image,
  Pressable,
  View,
} from 'react-native';
import {
  forwardRef,
  useCallback,
  useRef,
  useState,
} from 'react';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons/faCircleXmark'

// TODO: Image picker is shit and doesn't allow cropping on web
// TODO: Image picker is shit and lets you upload any file type on web

const Images = ({input, setIsLoading, setIsInvalid}) => {
  const isLoading1 = useRef(false);
  const isLoading2 = useRef(false);

  const isInvalid1 = useRef(false);
  const isInvalid2 = useRef(false);

  const setIsLoading_ = useCallback(() => setIsLoading(
    isLoading1.current ||
    isLoading2.current
  ), []);

  const setIsInvalid_ = useCallback(() => setIsInvalid(
    isInvalid1.current ||
    isInvalid2.current
  ), []);

  const setIsLoading1 = useCallback(
    x => { isLoading1.current = x; setIsLoading_() }, []);
  const setIsLoading2 = useCallback(
    x => { isLoading2.current = x; setIsLoading_() }, []);

  const setIsInvalid1 = useCallback(
    x => { isInvalid1.current = x; setIsInvalid_() }, []);
  const setIsInvalid2 = useCallback(
    x => { isInvalid2.current = x; setIsInvalid_() }, []);

  return (
    <View>
      <PrimaryImage
        input={input}
        fileNumber={1}
        setIsLoading={setIsLoading1}
        setIsInvalid={setIsInvalid1}
      />
      <SecondaryImages
        input={input}
        firstFileNumber={2}
        setIsLoading={setIsLoading2}
        setIsInvalid={setIsInvalid2}
      />
    </View>
  );
};

const UserImage = ({input, fileNumber, setIsLoading, setIsInvalid}) => {
  const [image, setImage] = useState(null);
  const [isLoading_, setIsLoading_] = useState(false);

  const addImage = useCallback(async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      selectionLimit: 1,
    });

    if (result.canceled) return;
    if (!result.assets[0].width) return;
    if (!result.assets[0].height) return;

    const uri = result.assets[0].uri;

    setIsLoading(true);
    setIsLoading_(true);
    setIsInvalid(false);

    if (await input.photos.submit(String(fileNumber), uri)) {
      setImage(uri);
      setIsLoading(false);
      setIsLoading_(false);
      setIsInvalid(false);
    } else {
      setIsLoading(false);
      setIsLoading_(false);
      setIsInvalid(true);
    }
  }, []);

  const removeImage = useCallback(async () => {
    setIsLoading(true);
    setIsLoading_(true);
    setIsInvalid(false);

    if (await input.photos.delete(fileNumber)) {
      setImage(null);
      setIsLoading(false);
      setIsLoading_(false);
      setIsInvalid(false);
    } else {
      setIsLoading(false);
      setIsLoading_(false);
      setIsInvalid(true);
    }
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
          onPress={(image === null || isLoading_) ? undefined : removeImage}
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
        onPress={isLoading_ ? undefined : addImage}
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
        { isLoading_ && <Loading/>}
        {!isLoading_ && image === null && <AddIcon/>}
        {!isLoading_ && image !== null && <Image_ uri={image}/>}
      </Pressable>
    </View>
  );
};

const PrimaryImage = ({input, fileNumber, setIsLoading, setIsInvalid}) => {
  return <UserImage {...{input, fileNumber, setIsLoading, setIsInvalid}}/>
};

const Row = ({input, firstFileNumber, setIsLoading, setIsInvalid}) => {
  const isLoading1 = useRef(false);
  const isLoading2 = useRef(false);
  const isLoading3 = useRef(false);

  const setIsLoading_ = useCallback(() => setIsLoading(
    isLoading1.current ||
    isLoading2.current ||
    isLoading3.current
  ), []);

  const setIsLoading1 = useCallback(
    x => { isLoading1.current = x; setIsLoading_() }, []);
  const setIsLoading2 = useCallback(
    x => { isLoading2.current = x; setIsLoading_() }, []);
  const setIsLoading3 = useCallback(
    x => { isLoading3.current = x; setIsLoading_() }, []);

  return (
    <View
      style={{
        flexDirection: 'row',
      }}
    >
      <UserImage
        input={input}
        fileNumber={firstFileNumber + 0}
        setIsLoading={setIsLoading1}
        setIsInvalid={setIsInvalid}
      />
      <UserImage
        input={input}
        fileNumber={firstFileNumber + 1}
        setIsLoading={setIsLoading2}
        setIsInvalid={setIsInvalid}
      />
      <UserImage
        input={input}
        fileNumber={firstFileNumber + 2}
        setIsLoading={setIsLoading3}
        setIsInvalid={setIsInvalid}
      />
    </View>
  );
};

const SecondaryImages = (
  {input, firstFileNumber, setIsLoading, setIsInvalid}
) => {
  const isLoading1 = useRef(false);
  const isLoading2 = useRef(false);

  const setIsLoading_ = useCallback(() => setIsLoading(
    isLoading1.current ||
    isLoading2.current
  ), []);

  const setIsLoading1 = useCallback(
    x => { isLoading1.current = x; setIsLoading_() }, []);
  const setIsLoading2 = useCallback(
    x => { isLoading2.current = x; setIsLoading_() }, []);

  return (
    <View>
      <Row
        input={input}
        firstFileNumber={firstFileNumber + 0}
        setIsLoading={setIsLoading1}
        setIsInvalid={setIsInvalid}
      />
      <Row
        input={input}
        firstFileNumber={firstFileNumber + 1}
        setIsLoading={setIsLoading2}
        setIsInvalid={setIsInvalid}
      />
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

const Loading = () => {
  return (
    <ActivityIndicator size="large" color="#70f"/>
  );
}

export {
  Images,
  SecondaryImages,
};
