import { getRotationSettings } from "./rotation-settings-view";

type FaqTopic = "performance" | "rotation" | "leaders";

const rrgGuideUrl =
  "https://chartschool.stockcharts.com/table-of-contents/chart-analysis/chart-types/relative-rotation-graphs-rrg-charts";

const topics: Record<FaqTopic, { label: string; content: () => string }> = {
  performance: {
    label: "Performance",
    content: () => `<h2>Performance</h2>
      <p class="faq-lead">Use Performance to find where price strength or weakness is concentrated. It ranks the same tracked sector and theme ETFs by their own price return over 1 Day, 1 Week, and 1 Month.</p>
      <section class="faq-note"><h3>A practical order for swing and position research</h3><ol class="faq-steps"><li><strong>Start with 1 Month.</strong> This is the best first screen for the recent trend. It answers which groups have led during the last several weeks.</li><li><strong>Check 1 Week.</strong> Use it to see whether the monthly trend is continuing, pausing, or reversing.</li><li><strong>Use 1 Day last.</strong> It is useful for timing and changes in leadership, but a single day should not overrule the broader trend by itself.</li></ol></section>
      <div class="faq-grid"><section><h3>What the panels mean</h3><p><strong>1 Day</strong> compares the latest completed session with the prior session. <strong>1 Week</strong> compares with five trading sessions earlier. <strong>1 Month</strong> compares with twenty-one trading sessions earlier. Green shows a positive return and red a negative return; bar length shows the size of the move within that panel.</p></section><section><h3>What to look for</h3><p>A group that is near the top of both 1 Month and 1 Week has persistent recent price strength. A strong 1 Day result with weak 1 Month performance can be a bounce rather than established leadership. A formerly strong 1 Month group that turns weak in 1 Week deserves a closer look for loss of momentum.</p></section><section><h3>What it does not tell you</h3><p>Performance is an absolute return, not a comparison with the broad market. A sector can rise while SPY rises more. Performance also does not identify an entry point, company quality, earnings risk, or position size.</p></section></div>
      <section class="faq-note"><h3>Best next step</h3><p>Use Performance to choose groups for research, then open <strong>Rotation</strong> to test whether each group is gaining or losing strength versus SPY. From there, use <strong>Stock Leaders</strong> to find individual stocks or ETFs whose own relative-strength readings match the setup you want to research.</p></section>`,
  },
  rotation: {
    label: "Rotation",
    content: () => {
      const settings = getRotationSettings();
      return `<h2>Rotation</h2>
        <p class="faq-lead">Rotation answers a different question from Performance: is a sector gaining or losing strength <em>relative to SPY</em>? It is an RRG-style view of price leadership, not a measure of actual investor dollar flows.</p>
        <div class="faq-grid"><section><h3>RS-Ratio: the level of leadership</h3><p>RS-Ratio compares the ETF’s price behavior with SPY and normalizes it around <strong>100</strong>. Above 100 means the ETF’s relative strength is above its recent norm; below 100 means it is below its recent norm. It does not mean an ETF will rise or fall in absolute price.</p></section><section><h3>RS-Momentum: the direction of change</h3><p>RS-Momentum is also centered on <strong>100</strong>. Above 100 means relative strength is accelerating; below 100 means it is decelerating. Read it with RS-Ratio: level tells you where leadership stands, momentum tells you whether that leadership is improving or fading.</p></section><section><h3>The four stages</h3><p><strong>Leading:</strong> both readings above 100; established and accelerating relative strength.<br><strong>Weakening:</strong> RS-Ratio above 100, momentum below; still strong relative to SPY but fading.<br><strong>Lagging:</strong> both below 100; weak and still deteriorating.<br><strong>Improving:</strong> RS-Ratio below 100, momentum above; not yet a leader, but relative strength is recovering.</p></section></div>
        <section class="faq-note"><h3>What to focus on</h3><p>For most swing or position research, begin with <strong>Medium term</strong>. It is the main view of the established rotation trend. Use <strong>Long term</strong> as a broader regime check: agreement with Medium adds context, while disagreement calls for more patience. Use <strong>Short term</strong> for timing: it can show a recovery or deterioration before it becomes visible in Medium term.</p><p>Leading sectors are the starting point for established-strength research. Improving sectors are earlier candidates that need more confirmation. Weakening sectors are where leadership may be rolling over; Lagging sectors are usually lower-priority research until their relative strength improves.</p></section>
        <section class="faq-grid"><section><h3>Short term: timing</h3><p>Current settings use ${settings.short.smoothingWindow} trading days of smoothing, a ${settings.short.normalizationWindow}-day baseline, and a ${settings.short.momentumLag}-day momentum comparison. It reacts fastest and is most sensitive to daily noise. Use it to refine timing, not as the only reason to choose a sector.</p></section><section><h3>Medium term: primary view</h3><p>Current settings use ${settings.medium.smoothingWindow} trading days of smoothing, a ${settings.medium.normalizationWindow}-day baseline, and a ${settings.medium.momentumLag}-day momentum comparison. This is the main swing-trading horizon and is also the first half of every Stock Leaders screen.</p></section><section><h3>Long term: structural context</h3><p>Current settings use ${settings.long.smoothingWindow} monthly observations of smoothing, a ${settings.long.normalizationWindow}-month baseline, and a ${settings.long.momentumLag}-month momentum comparison. It filters short-term movement and helps identify the broader leadership regime.</p></section></div>
        <section class="faq-note"><h3>Reading the chart</h3><p>The large dot is the latest reading; smaller dots form its recent trail. The upper-right quadrant is Leading, then rotation often progresses through Weakening, Lagging, and Improving. Trails are context, not a promise that every sector will follow the same path. The Settings tab lets you adjust the three inputs above and restore the defaults; those settings apply to both Rotation and Stock Leaders.</p><p class="faq-external">For background on the broader chart concept, see <a href="${rrgGuideUrl}" target="_blank" rel="noopener noreferrer">StockCharts’ Relative Rotation Graphs guide ↗</a>. This dashboard uses an RRG-style approximation, so its calculations and values can differ from that service.</p></section>`;
    },
  },
  leaders: {
    label: "Stock Leaders",
    content: () => `<h2>Stock Leaders</h2>
      <p class="faq-lead">Stock Leaders takes the sector idea down to individual names. It scans the tracked ETFs and their available top holdings, then selects stocks or ETFs whose own Medium- and Short-term readings meet the selected two-horizon combination.</p>
      <section class="faq-note"><h3>Where to start</h3><p>For established swing-trading candidates, begin with <strong>Confirmed Leader</strong>. Then review <strong>Leader Recovering</strong> for leaders whose short-term relative strength has begun to recover. Treat <strong>Emerging Leader</strong> as an earlier, more aggressive research list, and <strong>Early Improvement</strong> as a watchlist of the least-confirmed candidates.</p><p>These screens are a way to prioritize research. Before acting, review the chart, entry and stop plan, earnings date, liquidity, portfolio exposure, and position size.</p></section>
      <div class="faq-grid"><section><h3>1 — Leader Recovering</h3><p><strong>Medium Leading + Short Improving.</strong> The name has established medium-term leadership but its short-term relative strength is rebuilding. This can be useful for researching pullbacks or re-entries in stronger trends. It is not a guarantee that the recovery will continue.</p></section><section><h3>2 — Confirmed Leader</h3><p><strong>Medium Leading + Short Leading.</strong> Relative strength is established and positive on both horizons. This is the clearest starting screen when you want confirmed strength, though price can still be extended or near resistance.</p></section><section><h3>3 — Emerging Leader</h3><p><strong>Medium Improving + Short Leading.</strong> Short-term strength is already positive while the medium view is still recovering. It can identify leadership developing earlier, with more uncertainty than a Confirmed Leader.</p></section></div>
      <div class="faq-grid faq-grid-two"><section><h3>4 — Early Improvement</h3><p><strong>Medium Improving + Short Improving.</strong> Both horizons show recovering momentum, but neither has confirmed leadership yet. Use this as an observation list and look for further confirmation from price, volume, and the broader sector.</p></section><section><h3>A simple workflow</h3><ol class="faq-steps"><li>Use Performance to identify active groups.</li><li>Use Medium Rotation to check whether the group is Leading or Improving versus SPY.</li><li>Start Stock Leaders with Confirmed Leader, then Leader Recovering.</li><li>Use the chart and risk tools to decide whether a candidate has a valid setup for your plan.</li></ol></section></div>
      <section class="faq-note"><h3>How to read a result row</h3><div class="faq-definition-list"><p><strong>Ticker</strong> identifies the stock or ETF under review.</p><p><strong>Medium Stage / Short Stage</strong> show its current rotation quadrant at each horizon.</p><p><strong>RS-Ratio</strong> tells whether relative-strength level is above or below its normalized 100 center.</p><p><strong>RS-Momentum</strong> tells whether relative strength is accelerating or decelerating around its normalized 100 center.</p><p><strong>Source ETF / holdings date</strong> explains why the stock entered the research universe and how old the available ETF holdings snapshot is.</p></div><p>A count of two or six candidates does not rank their investment quality. Results are capped at 10, with at most two selections from one ETF group, so one popular ETF cannot dominate the screen. A stock appearing through an ETF also does not mean that ETF still owns it today.</p></section>
      <section class="faq-note"><h3>How the screens stay disciplined</h3><p>Every displayed stock or ETF must meet <strong>both</strong> stated stages. For example, Leader Recovering requires Medium Leading <em>and</em> Short Improving. The app uses the instrument’s own price history compared with SPY; it does not inherit the ETF’s rotation stage. Names with insufficient usable history are left out rather than forced into a stage.</p></section>`,
  },
};

export function initFaq() {
  const host = document.getElementById("faqContent") as HTMLElement;
  const controls = document.getElementById("faqTabs") as HTMLElement;
  let topic: FaqTopic = "performance";
  const render = () => {
    controls.innerHTML = (Object.keys(topics) as FaqTopic[])
      .map(
        (key) =>
          `<button class="button" type="button" data-faq-topic="${key}" aria-pressed="${key === topic}">${topics[key].label}</button>`,
      )
      .join("");
    host.innerHTML = topics[topic].content();
  };
  controls.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-faq-topic]");
    const next = button?.dataset.faqTopic as FaqTopic;
    if (!next || !topics[next]) return;
    topic = next;
    render();
  });
  document.querySelector('[data-tab="faq"]')?.addEventListener("click", render);
  render();
}
