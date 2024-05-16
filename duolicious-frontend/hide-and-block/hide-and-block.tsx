import { japi } from '../api/api';
import { notify } from '../events/events';
import { setConversationArchived } from '../xmpp/xmpp';

const setSkipped = async (
  personId: number,
  personUuid: string,
  isSkipped: boolean,
  reportReason?: string,
): Promise<boolean> => {
  const endpoint = (
    isSkipped ?
    `/skip/by-uuid/${personUuid}` :
    `/unskip/${personId}`);

  const payload =
    (isSkipped && reportReason) ?
    { report_reason: reportReason } :
    undefined;

  const response = await japi('post', endpoint, payload);

  if (response.ok) {
    notify(
      isSkipped ?
      `skip-profile-${personId}` :
      `unskip-profile-${personId}`
    );

    setConversationArchived(personUuid, isSkipped);

    return true;
  }

  return false;
};

export {
  setSkipped,
};
