import { storeKv } from './kv-storage';

const askedForReviewBefore = async (): Promise<boolean> => {
  const result = await storeKv('was_review_requested');

  await storeKv('was_review_requested', 'true');

  return result === 'true';
};

export {
  askedForReviewBefore,
}
