export type Clock = {
  now(): Date;
};

export type IdGenerator = {
  generate(): string;
};

export const systemClock: Clock = {
  now: () => new Date(),
};
