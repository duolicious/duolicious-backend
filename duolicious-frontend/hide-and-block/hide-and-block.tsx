import { japi } from '../api/api';
import { notify } from '../events/events';
import { setConversationArchived } from '../chat/application-layer';

const setSkipped = async (
  personUuid: string,
  isSkipped: boolean,
  reportReason?: string,
): Promise<boolean> => {
  const endpoint = (
    isSkipped ?
    `/skip/by-uuid/${personUuid}` :
    `/unskip/by-uuid/${personUuid}`);

  const payload =
    (isSkipped && reportReason) ?
    { report_reason: reportReason } :
    undefined;

  const response = await japi('post', endpoint, payload);

  if (!response.ok) {
    return false;
  }

  notify(
    isSkipped ?
    `skip-profile-${personUuid}` :
    `unskip-profile-${personUuid}`
  );

  setConversationArchived(personUuid, isSkipped);

  return true;
};

export {
  setSkipped,
};
