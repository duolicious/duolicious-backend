const cmToFeetInches = (cm: number): {feet: number, inches: number} => {
    const inches = cm / 2.54;
    const feet = Math.floor(inches / 12);
    const remainingInches = Math.round(inches % 12);

    return {feet, inches: remainingInches};
};

const cmToFeetInchesStr = (cm: number): string => {
  const feetInches = cmToFeetInches(cm);
  return `${feetInches.feet}'${feetInches.inches}"`;
}

const kmToMiles = (km: number): number => {
    const miles = km * 0.621371;
    return miles;
}

export {
  cmToFeetInches,
  cmToFeetInchesStr,
  kmToMiles,
};
