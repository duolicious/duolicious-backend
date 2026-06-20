import { useEffect } from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { DefaultText } from './default-text';

const IS_LOCALHOST =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

const ADSENSE_CLIENT = 'ca-pub-2356864342428722';
const ADSENSE_SCRIPT_SRC =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

const AdSensePlaceholder = ({
  slot,
  style,
}: {
  slot: string
  style?: StyleProp<ViewStyle>
}) => (
  <View
    style={[
      {
        width: 300,
        height: 250,
        borderWidth: 1,
        borderColor: '#ccc',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
      },
      style,
    ]}
  >
    <DefaultText style={{ color: '#999' }}>
      Ad placeholder (slot {slot})
    </DefaultText>
  </View>
);

const AdSenseUnit = ({
  slot,
  style,
  format,
  layoutKey,
  fullWidthResponsive,
  placeholderStyle,
}: {
  slot: string
  style?: any
  format?: string
  layoutKey?: string
  fullWidthResponsive?: boolean
  placeholderStyle?: StyleProp<ViewStyle>
}) => {
  useEffect(() => {
    if (Platform.OS !== 'web' || IS_LOCALHOST) {
      return;
    }

    if (!document.querySelector(`script[src="${ADSENSE_SCRIPT_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = ADSENSE_SCRIPT_SRC;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
    }
  }, []);

  if (Platform.OS !== 'web') {
    return null;
  }

  if (IS_LOCALHOST) {
    return <AdSensePlaceholder slot={slot} style={placeholderStyle}/>;
  }

  return (
    <ins
      className="adsbygoogle"
      style={style}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-ad-layout-key={layoutKey}
      data-full-width-responsive={fullWidthResponsive ? 'true' : undefined}
    />
  );
};

// All of our in-feed ad units share the one fluid layout; only the slot
// differs between placements (e.g. the feed vs. the Visitors tab).
const IN_FEED_AD_LAYOUT_KEY = '-f9+5v+4m-d8+7b';

const InFeedAd = ({
  slot,
  style,
}: {
  slot: string
  style?: StyleProp<ViewStyle>
}) => (
  <View style={style}>
    <AdSenseUnit
      slot={slot}
      style={{ display: 'block' }}
      format="fluid"
      layoutKey={IN_FEED_AD_LAYOUT_KEY}
      placeholderStyle={{ width: '100%', height: 250 }}
    />
  </View>
);

const ResponsiveAd = ({
  slot,
  style,
  placeholderHeight = 250,
}: {
  slot: string
  style?: StyleProp<ViewStyle>
  placeholderHeight?: number
}) => (
  <View style={style}>
    <AdSenseUnit
      slot={slot}
      style={{ display: 'block', width: '100%' }}
      format="auto"
      fullWidthResponsive
      placeholderStyle={{ width: '100%', height: placeholderHeight }}
    />
  </View>
);

export {
  AdSenseUnit,
  InFeedAd,
  ResponsiveAd,
  IS_LOCALHOST,
};
