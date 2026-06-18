const defaultEmaPeriod = 21;
const defaultRsiPeriod = 14;
const defaultSigmaPeriod = 63;

export function asFiniteNumber(value: any) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function calculateEma(values: any, period: any = defaultEmaPeriod) {
  const prices = values.map(asFiniteNumber).filter((value: any) => value !== null);

  if (prices.length < period) {
    return null;
  }

  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum: any, price: any) => sum + price, 0) / period;

  for (let index = period; index < prices.length; index += 1) {
    ema = (prices[index] - ema) * multiplier + ema;
  }

  return Number(ema.toFixed(4));
}

export function calculateEmaSeries(values: any, period: any) {
  const result = Array(values.length).fill(null);
  const seed = [];
  const multiplier = 2 / (period + 1);
  let ema = null;

  for (let index = 0; index < values.length; index += 1) {
    const value = asFiniteNumber(values[index]);
    if (value === null) {
      continue;
    }

    if (ema === null) {
      seed.push(value);
      if (seed.length === period) {
        ema = seed.reduce((sum: any, price: any) => sum + price, 0) / period;
        result[index] = Number(ema.toFixed(4));
      }
      continue;
    }

    ema = (value - ema) * multiplier + ema;
    result[index] = Number(ema.toFixed(4));
  }

  return result;
}

export function calculateRsi(values: any, period: any = defaultRsiPeriod) {
  const prices = values.map(asFiniteNumber).filter((value: any) => value !== null);

  if (prices.length <= period) {
    return null;
  }

  let gainSum = 0;
  let lossSum = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = prices[index] - prices[index - 1];
    if (change >= 0) {
      gainSum += change;
    } else {
      lossSum += Math.abs(change);
    }
  }

  let averageGain = gainSum / period;
  let averageLoss = lossSum / period;

  for (let index = period + 1; index < prices.length; index += 1) {
    const change = prices[index] - prices[index - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
  }

  if (averageLoss === 0) {
    return averageGain === 0 ? 50 : 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return Number((100 - 100 / (1 + relativeStrength)).toFixed(2));
}

export function calculateSmaSeries(values: any, period: any) {
  return values.map((_: any, index: any) => {
    if (index + 1 < period) {
      return null;
    }

    const slice = values.slice(index + 1 - period, index + 1).map(asFiniteNumber);
    if (slice.some((value: any) => value === null)) {
      return null;
    }

    return Number((slice.reduce((sum: any, value: any) => sum + value, 0) / period).toFixed(4));
  });
}

export function rollingZScore(values: any, index: any, period: any = defaultSigmaPeriod) {
  const value = asFiniteNumber(values[index]);
  if (value === null) {
    return null;
  }

  const sample = [];
  for (let cursor = index; cursor >= 0 && sample.length < period; cursor -= 1) {
    const sampleValue = asFiniteNumber(values[cursor]);
    if (sampleValue !== null) {
      sample.unshift(sampleValue);
    }
  }

  if (sample.length < Math.min(period, 20)) {
    return null;
  }

  const mean = sample.reduce((sum: any, sampleValue: any) => sum + sampleValue, 0) / sample.length;
  const variance =
    sample.reduce((sum: any, sampleValue: any) => sum + (sampleValue - mean) ** 2, 0) /
    sample.length;
  const standardDeviation = Math.sqrt(variance);

  if (!standardDeviation) {
    return null;
  }

  return Number(((value - mean) / standardDeviation).toFixed(2));
}

export function percentChange(currentValue: any, previousValue: any) {
  const current = asFiniteNumber(currentValue);
  const previous = asFiniteNumber(previousValue);

  if (current === null || previous === null || previous === 0) {
    return null;
  }

  return Number((((current - previous) / previous) * 100).toFixed(4));
}

export function latestFiniteValue(values: any) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = asFiniteNumber(values[index]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function validChartEntries(timestamps: any, values: any) {
  return values
    .map((value: any, index: any) => ({
      value: asFiniteNumber(value),
      timestamp: timestamps[index] || null,
    }))
    .filter((entry: any) => entry.value !== null);
}

export function isAboveSma(values: any, period: any, endOffset: any = 0) {
  const prices = values.map(asFiniteNumber).filter((value: any) => value !== null);
  const end = prices.length - endOffset;

  if (end < period || end <= 0) {
    return null;
  }

  const latest = prices[end - 1];
  const sma =
    prices.slice(end - period, end).reduce((sum: any, price: any) => sum + price, 0) / period;
  return latest > sma;
}

export function isAboveEma(values: any, period: any, endOffset: any = 0) {
  const prices = values.map(asFiniteNumber).filter((value: any) => value !== null);
  const end = prices.length - endOffset;

  if (end < period || end <= 0) {
    return null;
  }

  const ema = latestFiniteValue(calculateEmaSeries(prices.slice(0, end), period));
  return ema === null ? null : prices[end - 1] > ema;
}

export function calculateParticipationHistory(
  charts: any,
  periods: any = [5, 20, 50, 200],
  maxPoints: any = 130,
) {
  const normalizedPeriods = [...new Set(periods)]
    .map((period: any) => Number(period))
    .filter((period: any) => Number.isInteger(period) && period > 0)
    .sort((a: any, b: any) => a - b);
  const chartValues = charts instanceof Map ? [...charts.values()] : Object.values(charts || {});
  const sessionsByDate = new Map<string, Record<string, any>>();
  let chartCount = 0;

  for (const chart of chartValues as any[]) {
    const closes = Array.isArray(chart) ? chart : chart?.closes || [];
    const timestamps = Array.isArray(chart) ? [] : chart?.timestamps || [];
    const entries = validChartEntries(timestamps, closes)
      .filter((entry: any) => entry.timestamp)
      .sort((a: any, b: any) => a.timestamp - b.timestamp);
    if (!entries.length) {
      continue;
    }

    chartCount += 1;
    const values = entries.map((entry: any) => entry.value);
    const movingAverages = new Map(
      normalizedPeriods.map((period: any) => [period, calculateSmaSeries(values, period)]),
    );

    entries.forEach((entry: any, index: any) => {
      const date = new Date(entry.timestamp * 1000).toISOString().slice(0, 10);
      if (!sessionsByDate.has(date)) {
        sessionsByDate.set(date, {
          date,
          above: Object.fromEntries(normalizedPeriods.map((period: any) => [period, 0])),
          valid: Object.fromEntries(normalizedPeriods.map((period: any) => [period, 0])),
        });
      }

      const session = sessionsByDate.get(date);
      if (!session) {
        return;
      }

      for (const period of normalizedPeriods) {
        const movingAverage = movingAverages.get(period)?.[index] ?? null;
        if (movingAverage === null) {
          continue;
        }

        session.valid[period] += 1;
        if (entry.value > movingAverage) {
          session.above[period] += 1;
        }
      }
    });
  }

  const minimumParticipants = Math.max(1, Math.floor(chartCount * 0.5));
  const points = [...sessionsByDate.values()]
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .map((session: any) => {
      const point: Record<string, any> = { date: session.date };
      for (const period of normalizedPeriods) {
        const valid = session.valid[period];
        point[`valid${period}`] = valid;
        point[`above${period}`] =
          valid >= minimumParticipants
            ? Number(((session.above[period] / valid) * 100).toFixed(2))
            : null;
      }
      return point;
    })
    .filter((point: any) =>
      normalizedPeriods.some((period: any) => point[`above${period}`] !== null),
    );

  return {
    periods: normalizedPeriods,
    minimumParticipants,
    points: points.slice(-Math.max(1, Number(maxPoints) || 130)),
  };
}
