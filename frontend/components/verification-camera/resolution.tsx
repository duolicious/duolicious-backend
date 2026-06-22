type Resolution = { width: number; height: number };

const parseResolution = (resolutionText: string): Resolution | null => {
  if (!/^\d+x\d+$/.test(resolutionText)) {
    return null;
  }

  const [horizontalText, verticalText] = resolutionText.split("x");
  const width = Number(horizontalText);
  const height = Number(verticalText);

  return Number.isFinite(width) && Number.isFinite(height)
    ? { width, height }
    : null;
};

const error = (a: Resolution, b: Resolution) => {
  return Math.abs(a.height - b.height) + Math.abs(a.width - b.width);
};

const comparator = (target: Resolution) => (a: Resolution, b: Resolution) => {
  const errorA = error(target, a);
  const errorB = error(target, b);

  if (errorA > errorB) {
    return 1;
  } else if (errorA < errorB) {
    return -1;
  } else {
    return 0;
  }
};

const getBestResolution = (
  resolutionTexts: string[] | null | undefined,
  targetResolution: Resolution = { height: 900, width: 900 },
): string | null => {
  if (!resolutionTexts) {
    return null;
  }

  const parsedResolutions = resolutionTexts
    .map(parseResolution)
    .filter((candidate): candidate is Resolution => candidate !== null);

  parsedResolutions.sort(comparator(targetResolution));

  if (parsedResolutions.length === 0) {
    return null;
  } else {
    const bestResolution = parsedResolutions[0];
    return `${bestResolution.width}x${bestResolution.height}`;
  }
};

export {
  getBestResolution,
};
