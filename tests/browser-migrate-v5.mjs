/** Export a protected V4 journey through the old UI, then import into V5. */
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const executablePath=process.env.CHROMIUM_PATH;
if(!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium or Chrome executable.');
const base=process.env.ETERNITY_URL || 'http://localhost:5173/';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'eternity-v5-migration-')),exportPath=path.join(temp,'v4-export.eternity');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
try {
  let context=await browser.newContext({viewport:{width:1100,height:700},acceptDownloads:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject('disabled')});
  await page.goto(pathToFileURL(path.resolve('Eternity-V4.html')).href);await page.locator('[data-action=begin]').click();await page.waitForSelector('canvas');
  await page.keyboard.down('KeyW');await page.keyboard.down('KeyD');
  await page.waitForFunction(()=>!document.querySelector('#context-prompt')?.classList.contains('hidden') && document.querySelector('#context-text')?.textContent==='Talk to Mira',null,{timeout:30000});
  await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');await page.keyboard.press('KeyE');await page.waitForSelector('.dialogue-modal');
  await page.locator('[data-action=quest-accept]').click();await page.locator('.dialogue-modal [data-action=close]').first().click();
  await page.keyboard.press('Tab');await page.locator('[data-action=journal-tab][data-tab=routes]').click();
  await page.locator('[data-action=track-route][data-trail=first-footsteps]').click();await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');await page.locator('[data-action=return-title]').click();
  await page.locator('#title-screen [data-action=slots]').click();await page.locator('[data-action=slot-export][data-slot="0"]').click();
  await page.locator('#export-password').fill('v4 secret');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action=export-confirm]').click()]);
  await download.saveAs(exportPath);assert.equal(JSON.parse(fs.readFileSync(exportPath)).protected,true);await context.close();

  context=await browser.newContext({viewport:{width:1100,height:700}});page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject('disabled')});
  await page.goto(base);await page.locator('#title-screen [data-action=slots]').click();await page.locator('#import-file').setInputFiles(exportPath);
  await page.locator('#import-password').fill('wrong password');await page.locator('[data-action=import-slot][data-slot="1"]').click();
  await page.waitForSelector('.toast');assert.match(await page.locator('.toast').last().innerText(),/wrong|changed|could not/i);
  assert.equal(await page.locator('[data-action=import-slot]').count(),3);
  await page.locator('#import-password').fill('v4 secret');await page.locator('[data-action=import-slot][data-slot="1"]').click();
  await page.locator('[data-action=slot-start][data-slot="1"]').click();await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine);
  const state=await page.evaluate(()=>{const s=window.__ETERNITY_DEV__().state;return {version:s.version,quest:s.world.quests['first-light'],
    trails:s.world.trails,anchors:s.world.tideAnchors,pin:s.world.pinnedRegion,kit:s.player.kit};});
  assert.equal(state.version,5);assert.equal(state.quest,'active');assert.deepEqual(state.trails,{claimed:[],active:'first-footsteps'});
  assert.deepEqual(state.anchors,[]);assert.equal(state.pin,null);assert.equal(state.kit.selected,'flash');
  assert.deepEqual(errors,[]);console.log('V4 protected export → current-version import / wrong-pass rejection / route preservation: PASS');
  await context.close();
} finally {await browser.close();fs.rmSync(temp,{recursive:true,force:true});}
