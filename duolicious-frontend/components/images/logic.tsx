import * as _ from "lodash";

type OccupancyMap = {
  [k: number]: boolean
};

type WorkingValue = {
 startingKey: number
 occupied: boolean
};

type WorkingMap = {
  [k: number]: WorkingValue
};

type FinalMap = {
  [k: number]: number
};

const makeWorkingMap = (
  occupancyMap: OccupancyMap,
  fromKey: number
): WorkingMap => {
  const workingMap =
    Object
      .entries(occupancyMap)
      .reduce(
        (acc, [startingKey, occupied]) => {
          acc[startingKey] = { startingKey: Number(startingKey), occupied };
          return acc;
        },
        {} as WorkingMap
      );

  return workingMap;
};

const workingMapToFinalMap = (
  workingMap: WorkingMap,
): FinalMap => {
  const finalMap =
    Object
      .entries(workingMap)
      .reduce(
        (acc, [finalKey, { startingKey, occupied }]) => {
          acc[Number(startingKey)] = Number(finalKey);
          return acc;
        },
        {} as FinalMap
      );

  return finalMap;
}

const swapInPlace = (workingMap: WorkingMap, fromKey: number, toKey: number): void => {
  const fromVal = workingMap[fromKey];
  const toVal = workingMap[toKey];

  workingMap[fromKey] = toVal;
  workingMap[toKey] = fromVal;
};

const remap = (
  occupancyMap: OccupancyMap,
  fromKey: number,
  toKey: number
): FinalMap => {
  const workingMap = makeWorkingMap(occupancyMap, fromKey);

  if (!occupancyMap[fromKey]) {
    return workingMapToFinalMap(workingMap);
  }

  if (fromKey === toKey) {
    return workingMapToFinalMap(workingMap);
  }

  // Decide which direction to move photos in. We want to move photos towards
  // the space created by the element at `fromKey` being removed.
  const direction = fromKey < toKey ? -1 : +1;

  /**
   * Bubbles the occupant at `pos` in the given direction
   * until it finds a gap (an unoccupied position) or
   * the old `fromKey` (which we vacated).
   *
   * This "chain reaction" is what allows us to skip
   * shifting large ranges if we encounter a gap early.
   */
  const vacatePosition = (pos: number): void => {
    // If there's no occupant at `pos`, we're done; it's already a gap.
    if (!workingMap[pos].occupied) {
      return;
    }

    const nextPos = pos + direction;

    vacatePosition(nextPos);

    swapInPlace(workingMap, pos, nextPos);
  }

  // We remove the item at `fromKey` to give `vacatePosition` space to move
  // the elements around. We'll add the item back in once we've made space for
  // it at its destination.
  workingMap[fromKey].occupied = false;

  vacatePosition(toKey);

  // Now the item we want to move from `fromKey` to `toKey` has either:
  //   1. Already moved to `toKey`; or
  //   2. Hasn't moved at all.
  const isAtDestination =
    workingMap[toKey].startingKey === fromKey;

  const isUnmoved =
    workingMap[fromKey].startingKey === fromKey;

  if (isAtDestination) {
    ;
  } else if (isUnmoved) {
    swapInPlace(workingMap, fromKey, toKey);
  } else {
    throw Error('Unexpected state');
  }

  workingMap[toKey].occupied = true;

  return workingMapToFinalMap(workingMap);
};

export {
  remap,
};
