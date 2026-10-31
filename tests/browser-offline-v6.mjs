/** Offline standalone and cached site: import a real encrypted late-game fixture,
 * repair an anchor through the UI, and verify it after an encrypted reload.
 */
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {newGame,maxHealth} from '../src/core/state.js';
import {encryptSave} from '../src/core/save.js';
import {REGIONS,REGION_BY_ID,worldPosition} from '../src/data/world.js';
import {isBossType} from '../src/data/encounters.js';
const executablePath=process.env.CHROMIUM_PATH;
if(!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium or Chrome executable.');
const production=process.env.ETERNITY_PRODUCTION_URL || 'http://localhost:5175/';
const standalone=path.resolve('Eternity-V6.html'),html=fs.readFileSync(standalone,'utf8');
for(const name of ['mira','tavi','sera','rowan','bram','kea','nia']) {
  const data=fs.readFileSync(`public/assets/${name}-portrait.webp`).toString('base64');assert.ok(html.includes(data),`${name} not embedded`);
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'eternity-v6-offline-'));
const buildFixture=async (item,file)=>{
  const s=newGame('Offline Wayfinder'),region=REGION_BY_ID.tidegate,pos=worldPosition(region,item.x+1,item.z);
  s.player.x=pos.x;s.player.z=pos.z;s.player.level=20;s.player.hp=maxHealth(s.player);s.player.ore=5;s.player.echoes=5;
  s.world.visited.push('tidegate');s.world.activated.push('tidegate');s.player.lastShrine='tidegate';
  for(const r of REGIONS) r.enemies.forEach(([type],index)=>{if(!isBossType(type)) s.world.respawns[`enemy:${r.id}:${index}`]=Date.now()+600000;});
  fs.writeFileSync(file,JSON.stringify(await encryptSave(s,'offline coast')));
};
const anchorFixture=path.join(temp,'anchor.eternity'),niaFixture=path.join(temp,'nia.eternity');
await buildFixture(REGION_BY_ID.tidegate.anchor,anchorFixture);await buildFixture(REGION_BY_ID.tidegate.npc,niaFixture);
const launch=()=>chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
async function importStart(page,file) {
  await page.locator('#title-screen [data-action=slots]').click();await page.locator('#import-file').setInputFiles(file);
  await page.locator('#import-password').fill('offline coast');await page.locator('[data-action=import-slot][data-slot="0"]').click();
  await page.locator('[data-action=slot-start][data-slot="0"]').click();await page.waitForSelector('canvas');
}
async function repairAndReload(page) {
  await page.waitForFunction(()=>document.querySelector('#context-text')?.textContent.includes('Repair tide anchor'),null,{timeout:30000});
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>[...document.querySelectorAll('.toast')].some(n=>n.textContent.includes('Tide anchor restored')));
  await page.keyboard.press('KeyM');assert.match(await page.locator('.atlas-detail').innerText(),/TIDE ANCHOR REPAIRED/);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('[data-action=save-now]').click();
  await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='SAVED');
  await page.reload();await page.locator('[data-action=begin]').click();await page.waitForSelector('canvas');
  await page.keyboard.press('KeyM');assert.match(await page.locator('.atlas-detail').innerText(),/TIDE ANCHOR REPAIRED/);
}
async function standaloneFile() {
  const browser=await launch();
  try {
    let context=await browser.newContext({viewport:{width:1100,height:700}});await context.setOffline(true);
    let page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/^https?:/.test(r.url())) requests.push(r.url())});
    await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject('disabled')});
    await page.goto(pathToFileURL(standalone).href);await importStart(page,anchorFixture);await repairAndReload(page);
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);await context.close();
    // A separate offline journey proves the new portrait is not merely present
    // in the HTML: it is actually decoded by the real dialogue panel.
    context=await browser.newContext({viewport:{width:1100,height:700}});await context.setOffline(true);
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())) requests.push(r.url())});
    await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject('disabled')});
    await page.goto(pathToFileURL(standalone).href);await importStart(page,niaFixture);
    await page.waitForFunction(()=>document.querySelector('#context-text')?.textContent==='Talk to Nia',null,{timeout:30000});
    await page.keyboard.press('KeyE');await page.waitForSelector('.dialogue-modal');assert.equal(await page.locator('.dialogue-copy h2').innerText(),'Nia');
    await page.waitForFunction(()=>{const img=document.querySelector('.dialogue-art img');return img?.complete&&img.naturalWidth>0});
    assert.match(await page.locator('.dialogue-art img').getAttribute('src'),/^data:image\/webp;base64,/);
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);await context.close();
    console.log('V6 file offline, actual Nia portrait, anchor repair and encrypted reload: PASS');
  } finally {await browser.close();}
}
async function standaloneTouch() {
  const browser=await launch();
  try {
    const context=await browser.newContext({viewport:{width:568,height:320},isMobile:true,hasTouch:true});
    await context.setOffline(true);const page=await context.newPage(),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())) requests.push(r.url());});
    await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject('disabled')});
    await page.goto(pathToFileURL(standalone).href);await page.locator('[data-action=begin]').tap();
    await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='SAVED');
    await page.evaluate(()=>{window.actionClicks=[];document.addEventListener('click',e=>{const b=e.target.closest('.touch-actions button');if(b) window.actionClicks.push(b.dataset.action);});});
    const cdp=await context.newCDPSession(page),stick=await page.locator('#joystick').boundingBox(),
      strike=await page.locator('.touch-actions [data-action=attack]').boundingBox(),
      dodge=await page.locator('.touch-actions [data-action=dash]').boundingBox(),
      pause=await page.locator('.quick-buttons [data-action=pause]').boundingBox();
    const one={id:1,x:stick.x+stick.width*.8,y:stick.y+stick.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[one]});
    for(const [id,box] of [[2,strike],[3,dodge],[4,pause]]) {
      const point={id,x:box.x+box.width/2,y:box.y+box.height/2};
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[one,point]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[point]});
    }
    await page.waitForSelector('.pause-modal');
    assert.deepEqual(await page.evaluate(()=>window.actionClicks),['attack','dash']);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[one]});
    assert.equal(await page.locator('.pause-modal').isVisible(),true);
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);await context.close();
    console.log('V6 standalone offline two-finger actions and pause: PASS');
  } finally {await browser.close();}
}
async function hosted() {
  const browser=await launch();
  try {
    const context=await browser.newContext({viewport:{width:1100,height:700},serviceWorkers:'allow'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject('disabled')});
    await page.goto(production);await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:30000});
    const resources=await page.evaluate(async()=>{const keys=await caches.keys();const cache=await caches.open(keys.find(k=>k.startsWith('eternity-vale-')));return (await cache.keys()).map(r=>r.url)});
    for(const asset of ['nia-portrait.webp','mira-portrait.webp','wayfinder.glb']) assert.ok(resources.some(url=>url.endsWith(asset)),asset);
    await context.setOffline(true);await page.reload();await importStart(page,anchorFixture);await repairAndReload(page);
    const image=await page.evaluate(async()=>{const r=await fetch('/assets/nia-portrait.webp');return r.ok&&(await r.blob()).size>1000});
    assert.equal(image,true);assert.deepEqual(errors,[]);await context.close();
    console.log(`V6 hosted offline cache (${resources.length} resources), repair and encrypted reload: PASS`);
  } finally {await browser.close();}
}
try {await standaloneFile();await standaloneTouch();await hosted();} finally {fs.rmSync(temp,{recursive:true,force:true});}
