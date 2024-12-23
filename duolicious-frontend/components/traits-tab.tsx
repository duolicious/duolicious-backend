import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  TextInput,
  View,
  ViewStyle,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { DefaultText } from './default-text';
import { Chart } from './chart';
import * as Clipboard from 'expo-clipboard';
import { faCopy } from '@fortawesome/free-solid-svg-icons/faCopy'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { DuoliciousTopNavBar } from './top-nav-bar';
import { referrerId } from '../App';
import { api } from '../api/api';
import { useFocusEffect } from '@react-navigation/native';
import { WEB_BASE_URL } from '../env/env';

const sideMargins: StyleProp<ViewStyle> = {
  marginLeft: 10,
  marginRight: 10,
};

const ShareNotice = ({personId}) => {
  const [isCopied, setIsCopied] = useState(false);

  const url = `${WEB_BASE_URL}/me/${personId}`;

  const onPressNotice = useCallback(async () => {
    await Clipboard.setStringAsync(url);
    setIsCopied(true);
  }, [url]);

  return (
    <Pressable
      style={{
        marginTop: 10,
        marginBottom: 20,
        backgroundColor: 'rgba(119, 0, 255, 0.1)',
        padding: 5,
        borderRadius: 5,
        width: '100%',
      }}
      onPress={onPressNotice}
    >
      <DefaultText
        style={{
          width: '100%',
          color: '#70f',
          fontWeight: '600',
          marginRight: 5,
        }}
      >
        {isCopied ? 'Copied!' : 'Share'}
      </DefaultText>

      <View style={{ flexDirection: 'row' }}>
        <TextInput
          style={{
            color: '#70f',
            padding: 0,
            margin: 0,
            flexGrow: 1,
          }}
          inputMode="none"
          value={url}
        />

        <FontAwesomeIcon
          icon={faCopy}
          size={16}
        />
      </View>
    </Pressable>
  );
}

let isTraitDataDirty = true;
const markTraitDataDirty = () => {
  isTraitDataDirty = true;
}

const TraitsTab = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>();

  const fetchData = useCallback(async () => {
    const response = await api(
      'get',
      '/me/' + (referrerId === undefined ? '' : referrerId)
    );
    isTraitDataDirty = false;
    setData(response.json);
    setIsLoading(false);
  }, []);

  useFocusEffect(() => {
    if (!data || isTraitDataDirty) {
      setIsLoading(true);
      fetchData();
    }
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeAreaView}>
        <DuoliciousTopNavBar/>
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
          }}
        >
          <ActivityIndicator size="large" color="#70f"/>
        </View>
      </SafeAreaView>
    )
  }

  if (data === undefined) {
    return (
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexGrow: 1,
        }}
      >
        <DefaultText>Not found</DefaultText>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <DuoliciousTopNavBar/>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 10,
          paddingLeft: 10,
          paddingRight: 10,
          paddingBottom: 20,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <DefaultText
          style={{
            marginTop: 5,
            fontWeight: '600',
            fontSize: 20,
            marginBottom: 20,
          }}
        >
          {data.name + (String(data.name).endsWith('s') ? "'" : "'s")}
          {' '}Personality
        </DefaultText>

        {referrerId === undefined &&
          <ShareNotice personId={data.person_id}/>
        }

        {data.personality.map((trait) =>
          <Chart
            key={JSON.stringify(trait)}
            dimensionName={trait.trait_min_label ? undefined : trait.trait_name}
            minLabel={trait.trait_min_label}
            maxLabel={trait.trait_max_label}
            name1={null}
            percentage1={trait.person_percentage ?? undefined}
            name2={undefined}
            percentage2={undefined}
          >
            {trait.trait_description}
          </Chart>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1
  }
});

export {
  TraitsTab,
  markTraitDataDirty,
};
