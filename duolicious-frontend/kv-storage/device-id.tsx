import { storeKv } from './kv-storage';
import { getRandomString } from '../random/string';

const deviceId = async () => {
  const key = 'device_id';

  const deviceId_ = await storeKv(key);

  if (deviceId_) {
    return deviceId_;
  }

  const newDeviceId = getRandomString(16);

  await storeKv(key, newDeviceId);

  return newDeviceId;
};

export {
  deviceId,
};
