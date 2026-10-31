/** Export a passphrase-protected journey from the delivered V5 HTML and
 * import it into the current dev build, preserving Sound and route progress.
 */
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {newGame} from '../src/core/state.js';
import {encryptSave} from '../src/core/save.js';
const executablePath=process.env.CHROMIUM_PATH;
if(!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium or Chrome executable.');
const base=process.env.ETERNITY_URL || 'http://localhost:5173/';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'eternity-v6-migration-'));
const fixture=path.join(temp,'v5-fixture.eternity'),exportPath=path.join(temp,'v5-protected.eternity');
const s=newGame('Coastal traveller');s.player.coins=2317;s.player.ore=7;
s.world.visited.push('tidegate');s.world.tideAnchors.push('tidegate');s.world.lore.push('tidegate');
s.world.quests['opening-the-sound']='active';s.activeQuest='opening-the-sound';
s.world.trails.active='first-footsteps';
fs.writeFileSync(fixture,JSON.stringify(await encryptSave(s,'initial coast')));
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
try {
  let context=await browser.newContext({viewport:{width:1100,height:700},acceptDownloads:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject('disabled')});
  await page.goto(pathToFileURL(path.resolve('Eternity-V5.html')).href);
  await page.locator('#title-screen [data-action=slots]').click();await page.locator('#import-file').setInputFiles(fixture);
  await page.locator('#import-password').fill('initial coast');await page.locator('[data-action=import-slot][data-slot="0"]').click();
  await page.locator('[data-action=slot-start][data-slot="0"]').click();await page.waitForSelector('canvas');
  await page.keyboard.press('Escape');await page.locator('[data-action=return-title]').click();
  await page.locator('#title-screen [data-action=slots]').click();await page.locator('[data-action=slot-export][data-slot="0"]').click();
  await page.locator('#export-password').fill('v5 coast');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action=export-confirm]').click()]);
  await download.saveAs(exportPath);assert.equal(JSON.parse(fs.readFileSync(exportPath)).protected,true);await context.close();

  context=await browser.newContext({viewport:{width:1100,height:700}});page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject('disabled')});
  await page.goto(base);await page.locator('#title-screen [data-action=slots]').click();await page.locator('#import-file').setInputFiles(exportPath);
  await page.locator('#import-password').fill('wrong');await page.locator('[data-action=import-slot][data-slot="1"]').click();
  await page.waitForSelector('.inline-feedback');assert.match(await page.locator('.inline-feedback').innerText(),/wrong|changed|could not/i);
  await page.locator('#import-password').fill('v5 coast');await page.locator('[data-action=import-slot][data-slot="1"]').click();
  await page.locator('[data-action=slot-start][data-slot="1"]').click();await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine);
  const actual=await page.evaluate(()=>{const s=window.__ETERNITY_DEV__().state;return {version:s.version,coins:s.player.coins,ore:s.player.ore,
    anchors:s.world.tideAnchors,lore:s.world.lore,quest:s.world.quests['opening-the-sound'],route:s.world.trails.active};});
  assert.deepEqual(actual,{version:5,coins:2317,ore:7,anchors:['tidegate'],lore:['tidegate'],quest:'active',route:'first-footsteps'});
  await page.keyboard.press('Escape');await page.locator('[data-action=save-now]').click();
  await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='SAVED');
  await page.reload();await page.locator('[data-action=begin]').click();await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine);
  const reloaded=await page.evaluate(()=>{const s=window.__ETERNITY_DEV__().state;return {anchors:s.world.tideAnchors,coins:s.player.coins,quest:s.world.quests['opening-the-sound']};});
  assert.deepEqual(reloaded,{anchors:['tidegate'],coins:2317,quest:'active'});assert.deepEqual(errors,[]);
  await context.close();console.log('V5 protected export → V6 import / wrong pass / Sound and route preservation / reload: PASS');
} finally {await browser.close();fs.rmSync(temp,{recursive:true,force:true});}
