const appStoreBadge = require('../../../assets/app-store-badges/download-on-the-app-store.png');

const AppStoreBadges = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      {!/android/i.test(window.navigator.userAgent) &&
        <a
          target="_blank"
          href="https://apps.apple.com/us/app/duolicious-dating-app/id6499066647"
          style={{
            flex: 1,
          }}
        >
          <img
            alt="Download on the App Store"
            src={appStoreBadge.uri}
            style={{
              width: '100%',
            }}
          />
        </a>
      }

      {!/iphone|ipod/i.test(window.navigator.userAgent) &&
        <a
          target="_blank"
          href="https://play.google.com/store/apps/details?id=app.duolicious&pcampaignid=pcampaignidMKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1"
          style={{
            flex: 1,
            display: 'block',
          }}
        >
          <img
            alt="Get it on Google Play"
            src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
            style={{
              width: '100%',
            }}
          />
        </a>
      }
    </div>
  );
};

export {
  AppStoreBadges,
};
