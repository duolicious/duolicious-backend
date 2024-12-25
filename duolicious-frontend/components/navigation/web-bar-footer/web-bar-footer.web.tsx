import { WEB_VERSION } from '../../../env/env';

const discordIcon = require('../../../assets/social/discord-white.svg');
const twitterIcon = require('../../../assets/social/twitter-white.svg');
const redditIcon = require('../../../assets/social/reddit-white.svg');
const githubIcon = require('../../../assets/social/github-white.svg');
const koFiIcon = require('../../../assets/social/ko-fi.png');


const WebBarFooter = () => {
  return (
    <div
      style={{
        width: '100%',
        marginLeft: '15px',
        marginRight: '15px',
        justifyContent: 'center',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ul
        style={{
          boxSizing: 'border-box',
          flexWrap: 'wrap',
          listStyleType: 'none',
          width: '100%',
          justifyContent: 'center',
          display: 'flex',
          gap: '30px',
          border: 'none',
          padding: '0',
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
      <span
        style={{
          textAlign: 'center',
          color: 'white',
          fontFamily: 'MontserratRegular',
          fontSize: 12,
          opacity: 0.4,
        }}
      >
        Duolicious Web Version {WEB_VERSION}
      </span>
    </div>
  );
};

export {
  WebBarFooter,
}
