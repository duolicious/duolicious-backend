import { View } from 'react-native';
import { DefaultText } from '../default-text';

const RightPanel = () => {
  return (
    <View
      style={{
        maxWidth: 360,
        padding: 20,
      }}
    >
      <View
        style={{
          borderRadius: 10,
          backgroundColor: '#70f',
          width: '100%',
          padding: 20,
          gap: 20,
          alignItems: 'center',
        }}
      >
        <DefaultText
          style={{
            color: 'white',
            fontWeight: '900',
            fontSize: 22,
            textAlign: 'center',
          }}
        >
          Your Social Group Here
        </DefaultText>

        <DefaultText
          style={{
            color: 'white',
            textAlign: 'center',
            backgroundColor: 'black',
            borderRadius: 10,
            padding: 14,
          }}
        >
          Do you have a Discord server, Reddit sub, or other social group you
          want to promote? You can do it here, for free!
          {'\n\n'}
          What’s the catch? You’ll have to promote Duolicious back. (Plus your
          group should be something Duolicious members would like.)
          {'\n\n'}
          Enquiries: {}
          <DefaultText
            style={{
              fontWeight: '700'
            }}
            // @ts-ignore
            href="mailto:admin@duolicious.app"
          >
            admin@duolicious.app
          </DefaultText>
        </DefaultText>
      </View>
    </View>
  );
};

export {
  RightPanel,
};
