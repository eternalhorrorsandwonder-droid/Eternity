/** Optional V4 desktop UI regression test against the development server.
 * Set CHROMIUM_PATH and optionally ETERNITY_URL, then run npm run test:browser.
 * Dev-only setup accelerates state; clicks, controls, save/export use the UI.
 */
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const executablePath=process.env.CHROMIUM_PATH;
if (!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium or Chrome executable.');
const base=process.env.ETERNITY_URL || 'http://localhost:5173';
const b=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await b.newPage({viewport:{width:1100,height:700},acceptDownloads:true}), errors=[];page.on('pageerror',e=>errors.push(e.stack));
try {
 await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('disabled for QA'));});
 await page.goto(base);await page.locator('[data-action=begin]').click();await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine);
 await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='SAVED');
 // Moving after a completed save must not be labelled durable until the next snapshot.
 await page.keyboard.down('KeyS');await page.waitForTimeout(250);await page.keyboard.up('KeyS');
 await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='UNSAVED');
 await page.keyboard.press('Escape');await page.locator('[data-action=save-now]').click();
 await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='SAVED');
 await page.locator('[data-action=resume]').click();
 console.log('guide',await page.locator('#guide-bearing').innerText());assert.match(await page.locator('#guide-target').innerText(),/Mira/);
 await page.evaluate(()=>{const {state:s}=window.__ETERNITY_DEV__();s.world.visited.push('fields','grove');});
 await page.keyboard.press('m');await page.locator('[data-action=region-select][data-region=fields]').click();await page.locator('[data-action=pin-region]').click();
 assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.pinnedRegion),'fields');await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#guide-target')?.textContent.includes('Pinned'));
 await page.keyboard.press('m');await page.locator('[data-action=region-select][data-region=fields]').click();await page.locator('[data-action=pin-region]').click();assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.pinnedRegion),null);await page.keyboard.press('Escape');
 await page.keyboard.press('Tab');await page.locator('[data-action=journal-tab][data-tab=routes]').click();assert.equal(await page.locator('.route-card').count(),16);
 await page.locator('[data-action=track-route][data-trail=first-footsteps]').click();assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.trails.active),'first-footsteps');await page.keyboard.press('Escape');
 await page.evaluate(()=>{const {state:s,engine:e}=window.__ETERNITY_DEV__();s.world.activated.push('fields');s.world.lore.push('grove');const stone=e.world.records().find(r=>r.data.id==='haven').shrine;s.player.x=stone.x+1;s.player.z=stone.z;s.player.ore=10;s.player.echoes=10;e.player.position.set(s.player.x,0,s.player.z);});
 await page.keyboard.press('Tab');await page.locator('[data-action=claim-route][data-trail=first-footsteps]').click();assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.trails.claimed.length),1);await page.keyboard.press('Escape');
 await page.keyboard.press('c');await page.locator('[data-action=character-tab][data-tab=kit]').click();await page.locator('[data-action=kit-craft][data-kit=flash]').click();assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.player.kit.supplies.flash),1);await page.keyboard.press('Escape');
 await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();const enemy=e.world.enemies().find(v=>v.type==='wisp');enemy.x=s.player.x+2;enemy.z=s.player.z;enemy.alive=true;enemy.state='windup';enemy.stateTime=0;enemy.windup=1;enemy.attackRange=1.4;enemy.model.visible=true;enemy.model.userData.ring.visible=true;});
 await page.keyboard.press('r');let kit=await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();const enemy=e.world.enemies().find(v=>v.type==='wisp');return {count:s.player.kit.supplies.flash,status:enemy.state,ring:enemy.model.userData.ring.visible}});console.log('flash',kit);assert.equal(kit.count,0);assert.equal(kit.status,'stunned');assert.equal(kit.ring,false);
 const peaceful=await page.evaluate(()=>{const {engine:e}=window.__ETERNITY_DEV__();const enemy=e.world.enemies().find(v=>v.region==='haven' && v.type==='wisp');
   enemy.state='stunned';enemy.stateTime=1.2;enemy.aggravated=false;e.updateEnemies(.01);return enemy.state;});
 assert.equal(peaceful,'idle');
 await page.keyboard.press('Tab');await page.locator('[data-action=journal-tab][data-tab=field-guide]').click();assert.equal(await page.locator('.field-card').count(),8);assert.ok((await page.locator('.field-card:not(.unknown)').count())>=1);await page.keyboard.press('Escape');
 await page.keyboard.press('Escape');await page.locator('[data-action=settings]').click();await page.locator('[data-action=bind-key][data-binding=interact]').click();await page.keyboard.press('j');assert.match(await page.locator('.binding-error').innerText(),/assigned/i);await page.keyboard.press('f');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('eternity.settings')).bindings.interact),'KeyF');
 await page.locator('[data-setting=largeText]').check();await page.locator('[data-setting=highContrast]').check();assert.equal(await page.locator('#app').evaluate(el=>el.classList.contains('high-contrast')&&el.classList.contains('large-text')),true);await page.keyboard.press('Escape');
 await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();const n=e.world.npcs().find(n=>n.id==='mira');s.player.x=n.x+1;s.player.z=n.z;e.player.position.set(s.player.x,0,s.player.z);});await page.keyboard.press('f');assert.equal(await page.locator('.dialogue-copy h2').innerText(),'Mira');await page.keyboard.press('Escape');
 // Click the far side of a rock using screen-space projection, and follow the planned route.
 const screen=await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();s.player.x=11;s.player.z=13;e.player.position.set(11,0,13);e.world.updateStreaming(11,13);e.camera.position.set(11,17,34);e.camera.lookAt(11,0,11);e.camera.updateMatrixWorld();return e.project(19,0,13);});
 console.log('click screen',screen);await page.mouse.click(screen.x,screen.y);let plan=await page.evaluate(()=>{const e=window.__ETERNITY_DEV__().engine;return {target:e.target,path:e.clickPath,goal:e.clickGoal}});console.log('click plan',plan);assert.ok(plan.goal);
 await page.waitForTimeout(4500);
 const walked=await page.evaluate(()=>{const {state:s,engine:e}=window.__ETERNITY_DEV__();return {x:s.player.x,z:s.player.z,target:e.target,path:e.clickPath}});
 assert.ok(Math.hypot(walked.x-19,walked.z-13)<1.2,JSON.stringify(walked));
 // Simulate the authoritative slot write failing; a current in-memory export must still work.
 await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='eternity.vale.v1.slot.0')throw new DOMException('Simulated full storage','QuotaExceededError');return window.originalSet.call(this,k,v)};const {engine:e,state:s}=window.__ETERNITY_DEV__();s.player.coins=4321;e.queueSave();});
 await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='SAVE FAILED');await page.keyboard.press('Escape');await page.locator('[data-action=export-current]').click();
 await page.locator('#export-password').fill('road home');
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-action=export-confirm]').click();const download=await downloadPromise;const text=await fs.readFile(await download.path(),'utf8');
 const exported=await page.evaluate(async text=>{const {decryptSave}=await import('/src/core/save.js');return (await decryptSave(JSON.parse(text),'road home')).player.coins;},text);assert.equal(exported,4321);console.log('memory export after quota failure',exported);
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSet});await page.locator('[data-action=save-now]').click();await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='SAVED');
 const durable=await page.evaluate(async()=>{const {decryptSave}=await import('/src/core/save.js');return (await decryptSave(JSON.parse(localStorage.getItem('eternity.vale.v1.slot.0')))).player.coins;});
 assert.equal(durable,4321);
 assert.deepEqual(errors,[]);console.log('V4 desktop PASS');
} finally {await b.close();}
