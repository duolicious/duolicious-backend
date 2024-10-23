import { japi } from '../api/api';
import { notify, lastEvent } from '../events/events';
import { searchQueue } from '../api/queue';

const CLUB_QUOTA = 100;

type ClubItem = {
  name: string,
  count_members: number,
  search_preference?: boolean,
};

const sortClubs = (cs: ClubItem[] | undefined) => {
  const unsortedCs = cs ?? [];
  const sortedCs = unsortedCs.sort((a, b) => {
    if (a.name.toLowerCase() > b.name.toLowerCase()) return +1;
    if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;

    if (a.name > b.name) return +1;
    if (a.name < b.name) return -1;

    return 0;
  });

  return sortedCs;
}

const joinClub = (
  name: string,
  countMembers: number,
  searchPreference?: boolean,
): boolean => {
  const existingClubs = lastEvent<ClubItem[]>('updated-clubs') ?? [];

  if (existingClubs.length >= CLUB_QUOTA) {
    return false;
  }

  searchQueue.addTask(async () => await japi('post', '/join-club', { name }));

  const updatedClubs = [
    ...existingClubs
      .filter((c) => c.name !== name)
      .map((c) => ({
        ...c,
        search_preference:
          searchPreference === true ? false : c.search_preference
      })),
    {
      name,
      count_members: countMembers,
      search_preference: searchPreference
    },
  ];

  sortClubs(updatedClubs)

  notify<ClubItem[]>('updated-clubs', updatedClubs);

  return true;
};

const leaveClub = (name: string): void => {
  searchQueue.addTask(async () => await japi('post', '/leave-club', { name }));

  const existingClubs = lastEvent<ClubItem[]>('updated-clubs') ?? [];

  const updatedClubs = existingClubs.filter((c) => c.name !== name);

  sortClubs(updatedClubs)

  notify<ClubItem[]>('updated-clubs', updatedClubs);
};

export {
  CLUB_QUOTA,
  ClubItem,
  joinClub,
  leaveClub,
  sortClubs,
};
