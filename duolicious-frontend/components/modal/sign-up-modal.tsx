import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import { DefaultModal } from './default-modal';
import { backgroundColors } from './background-colors';
import { WelcomeScreen } from '../welcome-screen';
import { listen, notify, lastEvent } from '../../events/events';
import { useSignedInUser } from '../../events/signed-in-user';
import { navigationContainerRef } from '../../App';

const showSignUp = (isVisible: boolean) => {
  notify<boolean>('show-sign-up', isVisible);
};

const useShowSignUp = () => {
  const [isVisible, setIsVisible] = useState<boolean>(
    () => lastEvent<boolean>('show-sign-up') ?? false);

  useEffect(() => {
    return listen<boolean>(
      'show-sign-up',
      (x) => {
        if (x === undefined) {
          return;
        }

        setIsVisible(x);
      },
      true,
    );
  }, []);

  return [isVisible, setIsVisible] as const;
};

const SignUpModal = () => {
  const [isVisible] = useShowSignUp();
  const [signedInUser] = useSignedInUser();

  const onPressClose = useCallback(() => showSignUp(false), []);

  useEffect(() => {
    if (!isVisible) return;
    if (!signedInUser) return;

    showSignUp(false);
    navigationContainerRef.current?.reset({
      routes: [
        { name: 'Home', state: { routes: [{ name: 'Search' }] } },
      ],
    });
  }, [isVisible, signedInUser?.personUuid]);

  return (
    <DefaultModal
      transparent={true}
      visible={isVisible}
      onRequestClose={onPressClose}
    >
      <View
        style={{
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          paddingHorizontal: 10,
          paddingVertical: 20,
          ...backgroundColors.dark,
        }}
      >
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 600,
            maxHeight: 900,
            height: '100%',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <NavigationIndependentTree>
            <NavigationContainer documentTitle={{ enabled: false }}>
              <WelcomeScreen />
            </NavigationContainer>
          </NavigationIndependentTree>
        </View>
      </View>
    </DefaultModal>
  );
};

export {
  showSignUp,
  useShowSignUp,
  SignUpModal,
};
