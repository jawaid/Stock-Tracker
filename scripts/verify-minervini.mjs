// Real frontend + real scan route with synthetic provider; no personal data or network providers.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import app from "../public/index.html";
import { vcpFixture, appendBars, tightPauseFixture } from "../server/screeners/minervini-fixtures.ts";
import { evaluateMinerviniUniverse } from "../server/screeners/minervini.ts";
import { minerviniHandler } from "../server/screeners/minervini-route.ts";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
function bars(symbol) {
 if(symbol === "FORMING") return appendBars(appendBars(tightPauseFixture().slice(0,-5),[98.5,98.5,101]),[102]);
 if(symbol === "TIGHT") return appendBars(tightPauseFixture(),[98.75]);
 if(symbol === "ENTRY") return appendBars(vcpFixture(),[97]);
 if(symbol === "STOP") return appendBars(vcpFixture(),[97,90]);
 if(symbol === "REBREAK") return appendBars(vcpFixture(),[97,98,94,97]);
 const growth=symbol === "SPY" ? 0.02 : 0.4 + Number(symbol.slice(1)||0)*0.02;
 return Array.from({length:symbol === "SHORT"?10:329},(_,i)=>{
  const close=20+i*(Number.isFinite(growth)?growth:0.4);
  return {time:new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),open:close,high:close+0.1,low:close-0.1,close,volume:1000};
 });
}
const analysis = symbol => ({security:{symbol,name:symbol,price:112},chart:{candles:bars(symbol),emas:{}},technical:{},fundamentals:{},news:[],fetchedAt:"2026-10-21T12:00:00Z"});
const scanHandler=minerviniHandler(async symbol=>{if(symbol==="FAIL")throw Error("fixture");return analysis(symbol);});
// Isolated response fixture exercises long depth lists without any real symbol data.
const handler=async request=>{
 const response=await scanHandler(request);const data=await response.json();
 const row=data.rows?.find(row=>row.symbol==="T49");
 if(row) row.vcp={...row.vcp,contractionDepths:[.0467,.1293,.0336,.0497,.0414,.0632,.0482,.0403,.0318],evaluatedFrom:2,contractionsShrinking:false,contractionFailures:["contraction count from largest must be 2–6 (found 8)","contraction #4 exceeds 115% of #3","contraction #6 exceeds 115% of #5"]};
 return Response.json(data,{status:response.status});
};
const server=process.env.MINERVINI_TEST_URL ? null : Bun.serve({hostname:"127.0.0.1",port:0,routes:{"/":app,"/api/screeners/minervini":{POST:handler}},development:false});
const browser=await chromium.launch({headless:true,channel:"chrome"});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on("pageerror",e=>errors.push(e.message));
const symbols=["ENTRY","TIGHT","FORMING","SHORT","FAIL","STOP","REBREAK",...Array.from({length:50},(_,i)=>`T${String(i).padStart(2,"0")}`)];
const portfolio={positions:[],history:[],watchlists:[{id:"default-watchlist",name:"Minervini fixtures",items:symbols.map(ticker=>({id:ticker,ticker}))},{id:"small",name:"Small universe",items:[{id:"T00",ticker:"T00"}]}]};
try {
 await page.addInitScript(()=>{localStorage.setItem("stock-tracker.disclaimer-accepted.v1","accepted");window.__chartLabels=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(/Minervini|Volume|50-day average volume/.test(String(text)))window.__chartLabels.push(text);return original.call(this,text,...args);};});
 await page.route("**/api/**",async route=>{const url=new URL(route.request().url());if(url.pathname==="/api/screeners/minervini") {
 if (!process.env.MINERVINI_TEST_URL) return route.continue();
 const response=await handler(new Request(url,{method:"POST",body:route.request().postData()}));
 return route.fulfill({status:response.status, json:await response.json()});
 }if(url.pathname==="/api/positions")return route.fulfill({json:portfolio});if(url.pathname==="/api/analyze")return route.fulfill({json:analysis(url.searchParams.get("symbol"))});return route.fulfill({json:{}});});
 await page.route(/^https:\/\//,r=>r.abort());
 await page.context().grantPermissions(["clipboard-read","clipboard-write"]);
 await page.goto(process.env.MINERVINI_TEST_URL || server.url.toString());await page.locator('[data-tab="screener"]').click();await page.locator('[data-screener-panel="minervini"]').click();
 const panel=page.locator("#minerviniContent");await panel.getByRole("button",{name:"Run Screen",exact:true}).click();await page.waitForFunction(()=>document.querySelector("#minerviniStatus").textContent.startsWith("Scan complete"));
 assert.match(await page.locator("#minerviniStatus").innerText(),/Latest available session per symbol: 56 included, 0 excluded, 1 unavailable/);
 assert.equal(await panel.locator("tbody tr").count(),57);
 assert.ok(!(await panel.locator("th").allTextContents()).some(label=>/^TT[1-8]$/.test(label)||["Trend Status","RS Rating","RS Source"].includes(label)));
 const expected=evaluateMinerviniUniverse(symbols.map(symbol=>({symbol,bars:symbol === "FAIL"?[]:bars(symbol)})));
 const headers=await panel.locator("th").allTextContents();
 assert.deepEqual(headers.slice(headers.indexOf("Pass Count")+1,headers.indexOf("Pass Count")+7),["Contraction Depths (heuristic)","Contractions Shrinking","Volume Dry-Up","Entry Type (advisory)","Entry Pivot","Entry Stop"]);
 const entry=panel.locator("tbody tr").filter({hasText:"ENTRY"});
 assert.match(await panel.locator("tbody tr").filter({hasText:"SHORT"}).innerText(),/IPO – partial TT/);
 assert.match(await entry.innerText(),/Classic pivot/);
 const forming=panel.locator("tbody tr").filter({hasText:"FORMING"});
 assert.match(await forming.innerText(),/No setup – pause forming \(1 of 3 bars\)/);
 assert.equal(await forming.locator("td").nth(headers.indexOf("Entry Pivot")).innerText(),"101.00\npause forming");
 assert.equal(await forming.locator("td").nth(headers.indexOf("Entry Stop")).innerText(),"pending");
 for(const [label,value] of [["Entry Pivot","96.00"],["Entry Stop","90.00"],["Buy Point","96.10"],["Setup Status","In buy range"]])
   assert.equal(await entry.locator("td").nth(headers.indexOf(label)).innerText(),label === "Entry Pivot" ? `${value}\nconfirmed swing` : value);
 assert.match(await panel.locator("tbody tr").filter({hasText:"STOP"}).innerText(),/Stopped out on/);
 assert.match(await panel.locator("tbody tr").filter({hasText:"REBREAK"}).innerText(),/Re-breakout \(attempt 2\)/);
 await panel.locator('[data-sort="symbol"]').click();
 assert.equal(await panel.locator("tbody tr td:first-child").first().innerText(),"ENTRY");
 await panel.getByLabel("All 7 rules pass only").check();
 assert.equal(await panel.locator("tbody tr").count(),expected.filter(row=>row.allPass).length);
 await panel.getByLabel("All 7 rules pass only").uncheck();
 await panel.locator("tbody tr").filter({hasText:"STOP"}).getByRole("button",{name:"History (1)",exact:true}).click();
 assert.match(await page.getByRole("dialog").innerText(),/Stopped out/);
 await page.getByRole("button",{name:"Close history"}).click();
 assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith("stock-tracker.minervini-vcp-history.v2."))));
 for(const [width,height,name]of[[1440,1000,"desktop"],[390,844,"mobile"]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await panel.locator(".table-wrap").evaluate(el=>{el.scrollLeft=0;});await page.evaluate(()=>scrollTo(0,0));
 if(width===1440) {
   const viewport=await panel.locator(".table-wrap").boundingBox();
   for(const key of ["depths","shrinking","dry","entryType","entryPivot","entryStop"]) {
     const box=await panel.locator(`[data-sort="${key}"]`).boundingBox();
     assert.ok(box.x>=viewport.x && box.x+box.width<=viewport.x+viewport.width, `${key} must be visible without horizontal scrolling`);
   }
 }
 assert.match(await panel.locator("tbody tr").filter({hasText:"TIGHT"}).innerText(),/tight pause \(<3%\)/);
 await page.screenshot({path:`/tmp/minervini-${name}.png`});
 const tightPivot=panel.locator("tbody tr").filter({hasText:"TIGHT"}).locator("td").nth(headers.indexOf("Entry Pivot"));
 await tightPivot.scrollIntoViewIfNeeded();
 assert.equal(await tightPivot.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
 await page.screenshot({path:`/tmp/minervini-tight-${name}.png`});
 const formingPivot=forming.locator("td").nth(headers.indexOf("Entry Pivot"));
 await formingPivot.scrollIntoViewIfNeeded();
 assert.equal(await formingPivot.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
 await page.screenshot({path:`/tmp/minervini-forming-${name}.png`});
 const depthCell=panel.locator("tbody tr").filter({hasText:"T49"}).locator("td").nth(headers.indexOf("Contraction Depths (heuristic)"));
 await depthCell.scrollIntoViewIfNeeded();
 assert.match(await depthCell.innerText(),/9 total: #1 4.67%/);
 assert.match(await depthCell.innerText(),/#9 3.18%/);
 assert.match(await depthCell.innerText(),/contraction #4 exceeds 115% of #3/);
 assert.equal(await depthCell.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
 await page.screenshot({path:`/tmp/minervini-depths-${name}.png`});}
 for(const [width,height,name] of [[1440,1000,"desktop"],[390,844,"mobile"]]) {
   await page.setViewportSize({width,height});
   await page.locator("#minerviniStatus").scrollIntoViewIfNeeded();
   assert.equal(await page.locator("#minerviniStatus").evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
   await page.screenshot({path:`/tmp/minervini-session-${name}.png`});
   await panel.getByRole("button",{name:"Chart for ENTRY",exact:true}).click();
   const preview=page.getByRole("dialog");
   await preview.getByRole("status").filter({hasText:"Entry pivot: 96.00"}).waitFor();
   await page.waitForFunction(()=>window.__chartLabels.some(s=>s.includes("50-day average volume")));
   const rendered=await page.evaluate(()=>window.__chartLabels.join("\n"));
   assert.match(rendered,/Minervini entry pivot/);
   assert.match(rendered,/Volume/);
   assert.match(await preview.innerText(),/50-day average volume/);
   assert.equal(await preview.locator("canvas").count()>0,true);
   assert.equal(await preview.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
   await preview.getByRole("button",{name:"Copy chart",exact:true}).click();
   await preview.getByRole("status").filter({hasText:"Chart copied."}).waitFor();
   const copied=await page.evaluate(async()=>{
     const items=await navigator.clipboard.read();
     const blob=await items[0].getType("image/png");
     const bitmap=await createImageBitmap(blob);
     return {size:blob.size,width:bitmap.width,height:bitmap.height};
   });
   assert.ok(copied.size>1000 && copied.width>200 && copied.height>200);
   await preview.screenshot({path:`/tmp/minervini-preview-${name}.png`});
   if(name === "mobile") {
     await page.evaluate(()=>{window.__clipboardWrite=navigator.clipboard.write; navigator.clipboard.write=async()=>{throw new DOMException("Denied","NotAllowedError");};});
     await preview.getByRole("button",{name:"Copy chart",exact:true}).click();
     await preview.getByRole("status").filter({hasText:"Could not copy the chart"}).waitFor();
     assert.equal(await preview.getByRole("button",{name:"Copy chart",exact:true}).isEnabled(),true);
     await page.evaluate(()=>{navigator.clipboard.write=window.__clipboardWrite;});
   }
   await page.keyboard.press("Escape");
   await preview.waitFor({state:"detached"});
   assert.equal(await panel.locator("tbody tr").count(),57);
 }
 await page.evaluate(()=>{window.__chartLabels=[];});
 await page.setViewportSize({width:1440,height:1000});await panel.locator("tbody tr").filter({hasText:"ENTRY"}).getByRole("button",{name:"Analyze",exact:true}).click();
 await page.waitForFunction(()=>window.__chartLabels.some(s=>s.includes("entry pivot")));
 const labels=await page.evaluate(()=>window.__chartLabels.join("\n"));for(const label of["entry pivot","entry stop","base high","base low"])assert.ok(labels.includes(label),label);
 await page.locator("#analyzeChart").screenshot({path:"/tmp/minervini-chart.png"});
 await page.locator('[data-tab="watchlist"]').click();await page.locator('[data-watchlist-list-id="small"]').click();await page.locator('[data-tab="screener"]').click();
 assert.equal(await panel.locator("tbody tr").count(),0);await panel.getByRole("button",{name:"Run Screen",exact:true}).click();await page.waitForFunction(()=>document.querySelector("#minerviniStatus").textContent.startsWith("Scan complete"));assert.ok(!(await panel.innerText()).includes("RS proxy"));await panel.getByLabel("All 7 rules pass only").check();assert.equal(await panel.locator("tbody tr").count(),1);assert.equal(await panel.locator("tbody tr td").nth(4).innerText(),"7/7");
 assert.deepEqual(errors,[]);console.log("Minervini passed: actual route, failure isolation, seven-rule qualification, IPO labeling, reset history, sorting/filter, list change, desktop/mobile, and all four rendered chart lines.");
}finally{await browser.close();server?.stop(true);}
