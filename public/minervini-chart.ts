export type MinerviniChartSelection = {
  symbol: string;
  date: string | null;
  entryPivot: number | null;
  entryStop: number | null;
  baseHigh: number | null;
  baseLow: number | null;
};
let selected: MinerviniChartSelection | null = null;
export function selectMinerviniChart(value: MinerviniChartSelection | null) {
  selected = value;
}
export function minerviniChartLevels(symbol: string) {
  if (!selected || selected.symbol !== symbol) return [];
  const fields = [
    ["entryPivot", "Minervini entry pivot", "#245fc5"],
    ["entryStop", "Minervini entry stop", "#b3262f"],
    ["baseHigh", "Minervini base high", "#617083"],
    ["baseLow", "Minervini base low", "#92703d"],
  ] as const;
  return fields.flatMap(([key, label, color]) => {
    const price = selected?.[key];
    return typeof price === "number" && Number.isFinite(price) && price > 0
      ? [
          {
            price,
            color,
            title: `${label} (${selected?.date || "undated"})`,
            lineWidth: 1 as const,
            lineStyle: 2 as const,
            axisLabelVisible: true,
          },
        ]
      : [];
  });
}
