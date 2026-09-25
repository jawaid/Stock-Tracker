export type DailyBar = {
  time?: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ScreenParameters = Record<string, boolean | number | string>;

export type ScreenMetric = {
  close: number;
  average21: number;
  atr: number;
  distanceAtr: number;
  slope: number;
  date: string;
};

export type ScreenEvaluation = {
  setup: string;
  passed: boolean;
  failedRules: string[];
  metrics: ScreenMetric | null;
};

export type ScreenerScreen = {
  id: string;
  name: string;
  description: string;
  defaults: ScreenParameters;
  evaluate: (bars: DailyBar[], parameters: ScreenParameters) => ScreenEvaluation[];
};
