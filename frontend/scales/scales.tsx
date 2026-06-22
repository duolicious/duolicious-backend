type Scale = {
  scaleValue: (value: number, min: number, max: number) => number;
  descaleValue: <V extends number | null>(scaledValue: V, min: number, max: number) => V;
};

const LINEAR_SCALE: Scale = {
  scaleValue: (value) => value,
  descaleValue: (scaledValue) => scaledValue,
};

const LOGARITHMIC_SCALE: Scale = {
  scaleValue: (value, min, max) => Math.exp(
    Math.log(min) + (
      (Math.log(max) - Math.log(min)) / (max - min)) * (value - min)),
  descaleValue: <V extends number | null>(scaledValue: V, min: number, max: number): V => (
    scaledValue === null
      ? null
      : min + (
        (Math.log(scaledValue) - Math.log(min)) * (max - min)) / (
          Math.log(max) - Math.log(min))
  ) as V,
};

export {
  Scale,
  LINEAR_SCALE,
  LOGARITHMIC_SCALE,
};
