type Scale = {
  scaleValue: (value: number, min: number, max: number) => number;
  descaleValue: (scaledValue: number, min: number, max: number) => number;
};

const LINEAR_SCALE: Scale = {
  scaleValue: (value) => value,
  descaleValue: (scaledValue) => scaledValue,
};

const LOGARITHMIC_SCALE: Scale = {
  scaleValue: (value, min, max) => Math.exp(
    Math.log(min) + (
      (Math.log(max) - Math.log(min)) / (max - min)) * (value - min)),
  descaleValue: (scaledValue, min, max) => (
    min + (
      (Math.log(scaledValue) - Math.log(min)) * (max - min)) / (
        Math.log(max) - Math.log(min))
  ),
};

export {
  Scale,
  LINEAR_SCALE,
  LOGARITHMIC_SCALE,
};
