interface QqqChart {
  price: number | null;
  sma21: number | null;
  smaTrend: number | null;
  error?: string;
}

export function classifyQqqRisk(chart: QqqChart) {
  if (chart.price === null || chart.sma21 === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: chart.error || "Not enough 21 EMA data",
    };
  }

  if (chart.price < chart.sma21) {
    return { status: "risk-off", label: "Risk-Off", detail: "Below 21 EMA" };
  }

  if (chart.smaTrend === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: chart.error || "Not enough 21 EMA data",
    };
  }

  if (chart.price > chart.sma21 && chart.smaTrend > 0) {
    return { status: "risk-on", label: "Risk-On", detail: "Above rising 21 EMA" };
  }

  return {
    status: "neutral",
    label: "Mixed",
    detail: chart.price === chart.sma21 ? "At 21 EMA" : "Above 21 EMA, trend not rising",
  };
}
