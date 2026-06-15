import { Pressable, View } from 'react-native';
import { CrossFade, CrossFadeText } from './cross-fade';
import { DefaultText } from './default-text';
import { Logo16 } from './logo';
import { isMobile } from '../util/util';
import { useAppTheme } from '../app-theme/app-theme';
import { showSignUp } from './modal/sign-up-modal';
import { useNumActiveUsers } from './welcome-screen';
import { useBannerProspectName } from '../events/banner-prospect-name';

const SignUpBanner = ({ prospectHandle }: { prospectHandle?: string }) => {
  const { appTheme } = useAppTheme();
  const numActiveUsers = useNumActiveUsers(undefined);
  const prospectName = useBannerProspectName(prospectHandle);

  // Longer names blow out the button's width, so fall back to the default copy.
  const label = prospectName && prospectName.length <= 5
    ? `Message\xa0${prospectName}`
    : `Join or\xa0sign\xa0in`;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: isMobile() ? 70 : 20,
        left: 0,
        right: 0,
        height: 100,
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 999,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
          maxWidth: 900,
          height: '100%',
          backgroundColor: 'white',
          borderRadius: 15,
          borderWidth: 1,
          borderColor: 'black',
          paddingHorizontal: 20,
          gap: 14,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <Logo16 size={64} color={appTheme.brandColor} rectSize={0.3} />
          <CrossFade
            style={{ flexShrink: 1 }}
            showFront={numActiveUsers !== undefined}
            minBackMs={2000}
            front={
              <>
                <DefaultText style={{ fontWeight: '900', fontSize: 20 }}>
                  {numActiveUsers === undefined ? '\xa0' : numActiveUsers.toLocaleString()}
                </DefaultText>
                <DefaultText style={{ fontWeight: '600', fontSize: 14 }}>
                  Active Members
                </DefaultText>
              </>
            }
            back={
              <DefaultText style={{ fontWeight: '600', fontSize: 12 }}>
                Online dating, but based and true love-pilled
              </DefaultText>
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={() => showSignUp(true)}
            style={{
              backgroundColor: appTheme.brandColor,
              borderRadius: 999,
              paddingVertical: 16,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: appTheme.secondaryColor,
            }}
          >
            <CrossFadeText triggerKey={label} style={{ width: '100%' }}>
              <DefaultText
                style={{
                  color: appTheme.primaryColor,
                  fontWeight: '700',
                  fontSize: 16,
                  textAlign: 'center',
                }}
              >
                {label}
              </DefaultText>
            </CrossFadeText>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export {
  SignUpBanner,
};
