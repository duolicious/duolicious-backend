import { useRef } from 'react';
import { View } from 'react-native';
import { DefaultText } from '../default-text';
import { getRandomElement } from '../../util/util';
import { PARTNER_URL } from '../../env/env';
import { useSignedInUser } from '../../events/signed-in-user';
import { AdSenseUnit } from '../adsense';

const AD_SLOTS_BY_ROUTE: Record<string, string[]> = {
  'Q&A': ['9659361574', '4220166788'],
  'Inbox': ['7936050512', '2520072307'],
  'Visitors': ['2715513425', '7461673725'],
};

type Partner = {
  name: string
  file: string
  link: string
};

const PARTNERS: Partner[] = [
  { name: 'SFDating',  file: 'sfdating.jpg',  link: 'https://discord.gg/REbbHqzD9p'},
  { name: 'duo3k',     file: 'duo3k.webp',    link: 'https://discord.gg/duo3k'},
  { name: 'Tiblur',    file: 'tiblur.jpg',    link: 'https://tiblur.com/register' },
  { name: 'NEET_Chat', file: 'neet-chat.png', link: 'https://discord.gg/96JShH3N7Y' },
  { name: 'Affinity',  file: 'affinity.png',  link: 'https://discord.gg/pvQ9EMVVq5' },
];

const DuoliciousRightPanelContent = () => {
  return (
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
        Do you have a Discord server, Reddit sub, forum or other social group
        you want to promote? You can do it here, for free!
        {'\n\n'}
        What’s the catch? You’ll have to promote Duolicious back. (Plus your
        group should be something Duolicious members would like.)
        {'\n\n'}
        Inquiries: {}
        <DefaultText
          style={{
            color: 'white',
            fontWeight: '700'
          }}
          // @ts-ignore
          href="mailto:admin@duolicious.app"
        >
          admin@duolicious.app
        </DefaultText>
      </DefaultText>
    </View>
  );
};

const SponsoredRightPanelContent = () => {
  const partner = useRef(getRandomElement(PARTNERS)).current;

  if (!partner) {
    return null;
  }

  return (
    <View
      style={{
        width: 300,
        gap: 10,
        justifyContent: 'center',
      }}
    >
      <a
        href={partner.link}
        target="_blank"
        style={{
          display: 'block',
          width: '100%',
          height: 250,
          borderWidth: 1,
          borderColor: 'black',
          borderStyle: 'solid',
        }}
      >
        <img
          src={`${PARTNER_URL}/${partner.file}`}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </a>

      <DefaultText style={{ color: '#999', textAlign: 'center' }}>
        <DefaultText style={{ fontWeight: '700' }}>
        {partner.name}
        </DefaultText>
        {} is a Duolicious partner
      </DefaultText>

      <DefaultText style={{ textAlign: 'center' }}>
        Want to promote your social group for free? Inquire at {}
        <DefaultText
          style={{
            fontWeight: '700'
          }}
          // @ts-ignore
          href="mailto:admin@duolicious.app"
        >
          admin@duolicious.app
        </DefaultText>
        .
      </DefaultText>
    </View>
  );
};

const AdSenseRightPanelContent = ({ slots }: { slots: string[] }) => {
  return (
    <View style={{ gap: 20 }}>
      {slots.map((slot) =>
        <AdSenseUnit
          key={slot}
          slot={slot}
          style={{ display: 'inline-block', width: 300, height: 250 }}
        />
      )}
    </View>
  );
};

const RightPanelContent = ({ routeName }: { routeName?: string }) => {
  const [signedInUser] = useSignedInUser();
  const rand = useRef(Math.random()).current;

  const adSlots = routeName ? AD_SLOTS_BY_ROUTE[routeName] : undefined;

  if (adSlots && !signedInUser?.hasGold) {
    return <AdSenseRightPanelContent slots={adSlots}/>;
  } else if (rand < 0.2) {
    return <DuoliciousRightPanelContent/>;
  } else {
    return <SponsoredRightPanelContent/>;
  }
};

const RightPanel = ({ routeName }: { routeName?: string }) => {
  return (
    <View
      style={{
        maxWidth: 360,
        padding: 20,
      }}
    >
      <RightPanelContent key={routeName} routeName={routeName}/>
    </View>
  );
};

export {
  RightPanel,
};
