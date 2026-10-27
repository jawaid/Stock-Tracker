import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  type IChartApi,
  LineSeries,
} from "lightweight-charts";
import type { MinerviniResult } from "../server/screeners/minervini";
import { minerviniPreviewData } from "./minervini-preview-data";

let closePreview: (() => void) | null = null;
export function openMinerviniPreview(row: MinerviniResult) {
  closePreview?.();
  const dialog = document.createElement("dialog");
  dialog.className = "minervini-preview";
  dialog.setAttribute("aria-labelledby", "minerviniPreviewTitle");
  const header = document.createElement("div");
  header.className = "screener-header";
  const title = document.createElement("h2");
  title.id = "minerviniPreviewTitle";
  title.textContent = `${row.symbol} · Chart`;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "button";
  close.textContent = "Close chart";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "button";
  copy.textContent = "Copy chart";
  copy.disabled = true;
  const actions = document.createElement("div");
  actions.className = "minervini-preview-actions";
  actions.append(copy, close);
  header.append(title, actions);
  const copyStatus = document.createElement("p");
  copyStatus.setAttribute("role", "status");
  copyStatus.hidden = true;
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = "Loading chart…";
  const host = document.createElement("div");
  host.className = "minervini-preview-canvas";
  host.setAttribute("role", "img");
  host.setAttribute(
    "aria-label",
    `${row.symbol} daily candlesticks, 20, 50 and 200 SMA, entry pivot, volume and 50-day average volume`,
  );
  dialog.append(header, status, copyStatus, host);
  document.body.append(dialog);
  const request = new AbortController();
  const timer = setTimeout(() => request.abort(), 25000);
  let chart: IChartApi | null = null;
  let observer: ResizeObserver | null = null;
  let frame = 0;
  copy.onclick = async () => {
    if (!chart) return;
    copy.disabled = true;
    copyStatus.hidden = false;
    copyStatus.textContent = "Copying chart…";
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
        throw new Error("Image clipboard unavailable");
      const snapshot = chart.takeScreenshot();
      const canvas = document.createElement("canvas");
      const scale = snapshot.width / host.clientWidth;
      const headingHeight = Math.ceil(64 * scale);
      canvas.width = snapshot.width;
      canvas.height = snapshot.height + headingHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image unavailable");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#17202a";
      ctx.font = `bold ${16 * scale}px sans-serif`;
      ctx.fillText(
        `${row.symbol} · Minervini Technical`,
        12 * scale,
        24 * scale,
        canvas.width - 24 * scale,
      );
      ctx.font = `${12 * scale}px sans-serif`;
      ctx.fillText(
        `Through ${row.date} · Delayed Yahoo daily OHLCV`,
        12 * scale,
        46 * scale,
        canvas.width - 24 * scale,
      );
      ctx.drawImage(snapshot, 0, headingHeight);
      const png = new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Image unavailable"))),
          "image/png",
        );
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      copyStatus.textContent = "Chart copied. Paste it into your message or document.";
    } catch {
      copyStatus.textContent =
        "Could not copy the chart. Allow clipboard access in your browser and retry, or take a screenshot.";
    } finally {
      copy.disabled = false;
    }
  };
  const cleanup = () => {
    request.abort();
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    observer?.disconnect();
    chart?.remove();
    dialog.remove();
    closePreview = null;
  };
  closePreview = () => dialog.close();
  dialog.addEventListener("close", cleanup, { once: true });
  close.onclick = () => dialog.close();
  dialog.showModal();
  void (async () => {
    try {
      const response = await fetch(`/api/analyze?symbol=${encodeURIComponent(row.symbol)}`, {
        signal: request.signal,
      });
      if (!response.ok) throw new Error("Chart could not load. Close and retry.");
      const data = await response.json();
      if (request.signal.aborted || !dialog.isConnected) return;
      const pivot = row.entry.entryPivot;
      const { bars, average, period, smas, pivotPoints } = minerviniPreviewData(
        data.chart?.candles,
        row.date,
        pivot,
        row.entry.pivotDate,
      );
      status.textContent = `Through ${row.date} · Delayed Yahoo daily OHLCV · 20 SMA (blue), 50 SMA (gold), 200 SMA (purple) · Volume bars + ${period}-day average volume (prior 50 bars) · ${row.entry.status} · Entry pivot: ${pivot === null ? "unavailable" : pivot.toFixed(2)} (scan value). Scroll to zoom; drag to pan.`;
      chart = createChart(host, {
        autoSize: false,
        width: host.clientWidth,
        height: host.clientHeight,
        layout: { textColor: "#617083" },
        grid: { vertLines: { color: "#edf1f5" }, horzLines: { color: "#edf1f5" } },
        timeScale: { rightOffset: 4 },
      });
      const price = chart.addSeries(CandlestickSeries, {
        upColor: "#108b7b",
        downColor: "#b3262f",
        borderVisible: false,
        wickUpColor: "#108b7b",
        wickDownColor: "#b3262f",
        priceLineVisible: false,
      });
      price.setData(bars);
      for (const [index, sma] of smas.entries()) {
        const series = chart.addSeries(LineSeries, {
          title: `${sma.period} SMA`,
          color: ["#2868f0", "#c98612", "#7c5cdb"][index],
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        series.setData(sma.points);
      }
      if (pivotPoints.length) {
        const pivotLine = chart.addSeries(LineSeries, {
          title: "Minervini entry pivot",
          color: "#245fc5",
          lineWidth: 2,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
        });
        pivotLine.setData(pivotPoints);
      } else if (pivot !== null) {
        status.textContent += " Pivot anchor unavailable in the returned history.";
      }
      const missingSmas = smas.filter((sma) => !sma.points.length).map((sma) => sma.period);
      if (missingSmas.length)
        status.textContent += ` Insufficient history for ${missingSmas.join(" / ")} SMA.`;
      const volume = chart.addSeries(
        HistogramSeries,
        { title: "Volume", priceFormat: { type: "volume" }, priceLineVisible: false },
        1,
      );
      volume.setData(
        bars.map((bar) => ({
          time: bar.time,
          value: bar.volume,
          color: bar.close >= bar.open ? "rgba(16,139,123,0.58)" : "rgba(179,38,47,0.5)",
        })),
      );
      const mean = chart.addSeries(
        LineSeries,
        {
          title: "50-day average volume",
          color: "#c98612",
          lineWidth: 2,
          priceFormat: { type: "volume" },
          priceLineVisible: false,
        },
        1,
      );
      mean.setData(average);
      if (!average.length) status.textContent += " Average volume unavailable: fewer than 50 bars.";
      chart.panes()[0]?.setStretchFactor(3);
      chart.panes()[1]?.setStretchFactor(1);
      chart
        .timeScale()
        .setVisibleLogicalRange({ from: Math.max(0, bars.length - 126), to: bars.length + 3 });
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() =>
          chart?.applyOptions({ width: host.clientWidth, height: host.clientHeight }),
        );
      });
      observer.observe(host);
      copy.disabled = false;
    } catch (error) {
      if (dialog.isConnected)
        status.textContent = request.signal.aborted
          ? "Chart request timed out. Close and retry."
          : error instanceof Error
            ? error.message
            : "Chart unavailable. Close and retry.";
    } finally {
      clearTimeout(timer);
    }
  })();
}
