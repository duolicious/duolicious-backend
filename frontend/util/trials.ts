const clubsRedesign = (personId: number | undefined): boolean =>
  personId !== undefined && personId >= 391400 && (personId >> 1) % 2 === 0;

export { clubsRedesign };
