import { storeKv } from './kv-storage';

const thisVersion = '1';

const doUpgrade = () => {
  console.log('Performing upgrade');
  storeKv('navigation_state', null);
};

const maybeDoUpgrade = async (): Promise<void> => {
  const result = await storeKv('last_version');

  if (result !== thisVersion) {
    doUpgrade();
  };

  storeKv('last_version', thisVersion);
};

export {
  maybeDoUpgrade,
}
