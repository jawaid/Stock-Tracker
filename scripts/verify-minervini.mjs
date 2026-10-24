// Real frontend + real scan route with synthetic provider; no personal data or network providers.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import app from "../public/index.html";
import { minerviniHandler } from "../server/screeners/minervini-route.ts";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
function bars(symbol) {
  const date = new Date("2024-01-01T00:00:00Z");
  const values = Array.from({length: symbol === "SHORT" ? 10 : 320}, (_,i) => {
    do { date.setUTCDate(date.getUTCDate()+1); } while ([0,6].includes(date.getUTCDay()));
    const close = 100+i;
    return {time:date.toISOString().slice(0,10),open:close,high:close+1,low:close-1,close,volume:1000};
  });
  if(symbol === "ENTRY") {
    for(let i=254;i<320;i++) Object.assign(values[i],{open:125,high:126,low:124,close:125,volume:1000});
    Object.assign(values[259],{open:155,high:160,low:154,close:155});
    Object.assign(values[279],{open:102,high:103,low:100,close:102});
    for(let i=309;i<319;i++) Object.assign(values[i],{open:109,high:110,low:108,close:109,volume:100});
    Object.assign(values[319],{open:109,high:113,low:109,close:112,volume:2000});
  }
  return values;
}
const analysis = symbol => ({security:{symbol,name:symbol,price:112},chart:{candles:bars(symbol),emas:{}},technical:{},fundamentals:{},news:[],fetchedAt:"2026-10-21T12:00:00Z"});
const handler=minerviniHandler(async symbol=>{if(symbol==="FAIL")throw Error("fixture");return analysis(symbol);});
const server=Bun.serve({hostname:"127.0.0.1",port:0,routes:{"/":app,"/api/screeners/minervini":{POST:handler}},development:false});
const browser=await chromium.launch({headless:true,channel:"chrome"});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on("pageerror",e=>errors.push(e.message));
const symbols=["ENTRY","SHORT","FAIL",...Array.from({length:50},(_,i)=>`T${String(i).padStart(2,"0")}`)];
const portfolio={positions:[],history:[],watchlists:[{id:"default-watchlist",name:"Minervini fixtures",items:symbols.map(ticker=>({id:ticker,ticker}))},{id:"small",name:"Small universe",items:[{id:"T00",ticker:"T00"}]}]};
try {
 await page.addInitScript(()=>{localStorage.setItem("stock-tracker.disclaimer-accepted.v1","accepted");window.__chartLabels=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(String(text).includes("Minervini"))window.__chartLabels.push(text);return original.call(this,text,...args);};});
 await page.route("**/api/**",route=>{const url=new URL(route.request().url());if(url.pathname==="/api/screeners/minervini")return route.continue();if(url.pathname==="/api/positions")return route.fulfill({json:portfolio});if(url.pathname==="/api/analyze")return route.fulfill({json:analysis(url.searchParams.get("symbol"))});return route.fulfill({json:{}});});
 await page.route(/^https:\/\//,r=>r.abort());
 await page.goto(server.url.toString());await page.locator('[data-tab="screener"]').click();await page.locator('[data-screener-panel="minervini"]').click();
 const panel=page.locator("#minerviniContent");await panel.getByRole("button",{name:"Run Screen",exact:true}).click();await page.waitForFunction(()=>document.querySelector("#minerviniStatus").textContent.startsWith("Scan complete"));
 assert.equal(await panel.locator("tbody tr").count(),53);assert.ok(!(await panel.locator("th").allTextContents()).some(text=>/RS proxy|TT8/.test(text)));
 assert.match(await panel.locator("tbody tr").filter({hasText:"SHORT"}).innerText(),/Insufficient data/);
 assert.match(await panel.locator("tbody tr").filter({hasText:"ENTRY"}).innerText(),/Low cheat/);
 const headers=await panel.locator("th button").allTextContents();
 for(const label of ["Entry Pivot","Entry Stop"]){
   const index=headers.indexOf(label);
   assert.equal(await panel.locator("tbody tr").filter({hasText:"T00"}).locator("td").nth(index).innerText(),label === "Entry Pivot" ? "419.00" : "408.00");
   assert.equal(await panel.locator("tbody tr").filter({hasText:"SHORT"}).locator("td").nth(index).innerText(),"Insufficient data");
 }
 assert.equal(await panel.locator("tbody tr").filter({hasText:"ENTRY"}).locator("td").nth(headers.indexOf("Entry Pivot")).innerText(),"110.00");
 assert.equal(await panel.locator("tbody tr").filter({hasText:"ENTRY"}).locator("td").nth(headers.indexOf("Entry Stop")).innerText(),"108.00");
 assert.match(await panel.locator("tbody tr").filter({hasText:"T00"}).innerText(),/No completed pullback/);
 assert.ok(!(await panel.innerText()).includes("Percentiles"));

 await panel.locator('[data-sort="symbol"]').click();assert.equal(await panel.locator("tbody tr td:first-child").first().innerText(),"ENTRY");
 await panel.getByLabel("All 7 rules pass only").check();assert.equal(await panel.locator("tbody tr").count(),50);await panel.getByLabel("All 7 rules pass only").uncheck();
 for(const [width,height,name]of[[1440,1000,"desktop"],[390,844,"mobile"]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await panel.screenshot({path:`/tmp/minervini-${name}.png`});}
 await page.setViewportSize({width:1440,height:1000});await panel.locator("tbody tr").filter({hasText:"ENTRY"}).getByRole("button",{name:"Analyze",exact:true}).click();
 await page.waitForFunction(()=>window.__chartLabels.some(s=>s.includes("entry pivot")));
 const labels=await page.evaluate(()=>window.__chartLabels.join("\n"));for(const label of["entry pivot","entry stop","base high","base low"])assert.ok(labels.includes(label),label);
 await page.locator("#analyzeChart").screenshot({path:"/tmp/minervini-chart.png"});
 await page.locator('[data-tab="watchlist"]').click();await page.locator('[data-watchlist-list-id="small"]').click();await page.locator('[data-tab="screener"]').click();
 assert.equal(await panel.locator("tbody tr").count(),0);await panel.getByRole("button",{name:"Run Screen",exact:true}).click();await page.waitForFunction(()=>document.querySelector("#minerviniStatus").textContent.startsWith("Scan complete"));assert.ok(!(await panel.innerText()).includes("RS proxy"));await panel.getByLabel("All 7 rules pass only").check();assert.equal(await panel.locator("tbody tr").count(),1);assert.equal(await panel.locator("tbody tr td").nth(3).innerText(),"7/7");
 assert.deepEqual(errors,[]);console.log("Minervini passed: actual route, failure isolation, seven-rule qualification, sorting/filter, list change, desktop/mobile, and all four rendered chart lines.");
}finally{await browser.close();server.stop(true);}
