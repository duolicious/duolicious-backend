import { listen, lastEvent, notify } from '../../../events/events';
import { useRetained } from '../../../events/use-retained';
import { EV_CHAT_WS_RECEIVE, send } from '../../websocket-layer';
import { getRandomString } from '../../../random/string';

type Reaction = {
  emoji: string;
  reactionFrom: 'self' | 'other';
};

const eventKey = (mamId: string) => `use-reaction-${mamId}`;

const reactionsEqual = (a: Reaction | null, b: Reaction | null): boolean =>
  a?.emoji === b?.emoji && a?.reactionFrom === b?.reactionFrom;

const setReaction = (
  mamId: string | undefined,
  emoji: string,
  reactionFrom: 'self' | 'other',
) => {
  if (!mamId) {
    return;
  }

  const value: Reaction | null = emoji ? { emoji, reactionFrom } : null;

  notify<Reaction | null>(eventKey(mamId), value);
};

const getReaction = (mamId: string): Reaction | null => {
  return lastEvent<Reaction | null>(eventKey(mamId)) ?? null;
};

const onReceiveReaction = (doc: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const reaction = doc?.duo_reaction;

  if (!reaction) {
    return;
  }

  setReaction(reaction['@mam_id'], reaction['@emoji'] ?? '', 'other');
};

listen(EV_CHAT_WS_RECEIVE, onReceiveReaction);

const ingestMamReaction = (
  mamId: string | undefined,
  emoji: string | undefined,
  reactionFrom: string | undefined,
) =>
  setReaction(mamId, emoji ?? '', reactionFrom === 'self' ? 'self' : 'other');

const useReaction = (mamId: string | undefined): Reaction | null =>
  useRetained<Reaction>(mamId ? eventKey(mamId) : undefined);

const sendReactionAndNotify = async (
  targetMamId: string,
  emoji: string,
): Promise<void> => {
  if (!targetMamId) {
    return;
  }

  const previous = getReaction(targetMamId);
  const optimistic: Reaction | null =
    emoji ? { emoji, reactionFrom: 'self' } : null;

  setReaction(targetMamId, emoji, 'self');

  const id = getRandomString(40);

  const data = {
    duo_reaction: {
      '@id': id,
      '@mam_id': targetMamId,
      '@emoji': emoji,
    },
  };

  const responseDetector = (doc: any): { ok: boolean } | null => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (doc?.duo_reaction_delivered?.['@id'] === id) {
      return { ok: true };
    }
    if (doc?.duo_reaction_blocked?.['@id'] === id) {
      return { ok: false };
    }
    return null;
  };

  const response = await send({ data, responseDetector, timeoutMs: 10000 });

  if (
    (response === 'timeout' || !response.ok) &&
    reactionsEqual(getReaction(targetMamId), optimistic)
  ) {
    notify<Reaction | null>(eventKey(targetMamId), previous);
  }
};

export {
  Reaction,
  ingestMamReaction,
  sendReactionAndNotify,
  useReaction,
};
