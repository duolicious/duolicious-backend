const discordIcon = require('../../../assets/social/discord-white.svg');
const twitterIcon = require('../../../assets/social/twitter-white.svg');
const redditIcon = require('../../../assets/social/reddit-white.svg');
const githubIcon = require('../../../assets/social/github-white.svg');
const koFiIcon = require('../../../assets/social/ko-fi.png');

const appStoreBadge = require('../../../assets/app-store-badges/download-on-the-app-store.png');

const SocialBadges = () => {
  return (
    <ul
      style={{
        boxSizing: 'border-box',
        flexWrap: 'wrap',
        listStyleType: 'none',
        width: '100%',
        justifyContent: 'center',
        display: 'flex',
        gap: '24px',
        border: 'none',
        padding: '0',
        marginTop: 8,
        marginBottom: 8,
      }}
    >
      <li>
        <a target="_blank" href="https://discord.gg/cxrgbPT5Ua">
          <img src={discordIcon.uri} style={{ height: '20px' }} />
        </a>
      </li>
      <li>
        <a target="_blank" href="https://twitter.com/duoliciousapp">
          <img src={twitterIcon.uri} style={{ height: '20px' }} />
        </a>
      </li>
      <li>
        <a target="_blank" href="https://www.reddit.com/r/duolicious">
          <img src={redditIcon.uri} style={{ height: '20px' }} />
        </a>
      </li>
      <li>
        <a target="_blank" href="https://github.com/duolicious">
          <img src={githubIcon.uri} style={{ height: '20px' }} />
        </a>
      </li>
      <li>
        <a target="_blank" href="https://ko-fi.com/duolicious">
          <img src={koFiIcon.uri} style={{ height: '20px' }} />
        </a>
      </li>
    </ul>
  );
};

const AppStoreBadges = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
      }}
    >
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
    </div>
  );
};

const WebBarFooter = () => {
  return (
    <div
      style={{
        width: '100%',
        marginLeft: '15px',
        marginRight: '15px',
        justifyContent: 'center',
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AppStoreBadges/>
      <SocialBadges/>
    </div>
  );
};

export {
  WebBarFooter,
}
