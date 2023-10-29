import { api } from '../api/api';
import { notify } from '../events/events';
import { setBlocked as xmppSetBlocked } from '../xmpp/xmpp';

const setBlocked = async (
  personId: number,
  isBlocked: boolean
): Promise<boolean> => {
  const status = await xmppSetBlocked(personId, isBlocked);

  if (status === undefined) {
    const endpoint = (
      isBlocked ?
      `/block/${personId}` :
      `/unblock/${personId}`);

    const response = await api('post', endpoint);

    if (response.ok) {
      notify(
        isBlocked ?
        `hide-profile-${personId}` :
        `unhide-profile-${personId}`
      );

      return true;
    }
  } else if (status === 'timeout') {
    ;
  } else {
    throw Error(`Unexpected status: ${status}`);
  }

  return false;
};

const setHidden = async (
  personId: number,
  isHidden: boolean
): Promise<boolean> => {
  const status = await xmppSetBlocked(personId, isHidden);

  if (status === undefined) {
    const endpoint = (
      isHidden ?
      `/hide/${personId}` :
      `/unhide/${personId}`);

    const response = await api('post', endpoint);

    if (response.ok) {
      notify(
        isHidden ?
        `hide-profile-${personId}` :
        `unhide-profile-${personId}`
      );

      return true;
    }
  } else if (status === 'timeout') {
    ;
  } else {
    throw Error(`Unexpected status: ${status}`);
  }

  return false;
};

export {
  setBlocked,
  setHidden,
};
