/** Optional integration smoke test. Start `npm run dev`, then set
 * CHROMIUM_PATH to a local Chromium/Chrome executable before running it.
 * ETERNITY_URL overrides the default http://localhost:5173.
 * Debug-only state setup accelerates scenarios; the tested interactions use UI controls.
 */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const executablePath=process.env.CHROMIUM_PATH;
if (!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium or Chrome executable.');
const base=process.env.ETERNITY_URL || 'http://localhost:5173';
const launch=()=>chromium.launch({executablePath,headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader',
]});

async function newPage(browser, options) {
  const page=await browser.newPage(options),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  // Automation resizes the viewport, so do not enter a real fullscreen window.
  await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('disabled in smoke test'));});
  await page.goto(base);
  return {page,errors};
}
async function begin(page,touch=false) {
  await page.locator('[data-action=begin]')[touch?'tap':'click']();
  await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine,null,{timeout:30000});
}

async function desktop() {
  const browser=await launch();
  try {
    const {page,errors}=await newPage(browser,{viewport:{width:1100,height:700}});
    await begin(page);
    await page.keyboard.press('m');
    await page.locator('[data-action=atlas-chapter][data-chapter="3"]').click();
    assert.equal(await page.locator('.map-zone').count(),10);
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();
      s.player.x=108;s.player.z=216;s.player.ore=30;s.player.bloom=30;s.player.echoes=30;
      e.world.updateStreaming(s.player.x,s.player.z);const n=e.world.npcs().find(n=>n.id==='kea');
      s.player.x=n.x+1;s.player.z=n.z+1;e.interact(n);});
    assert.equal(await page.locator('.dialogue-copy h2').innerText(),'Kea');
    await page.locator('[data-action=quest-accept]').click();
    await page.locator('[data-action=close]').first().click();
    await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();const item=e.world.records().find(r=>r.data.id==='southgate').archive;
      s.player.x=item.x+1;s.player.z=item.z;e.interact(item);});
    await page.locator('[data-action=archive-align]').click();
    assert.match(await page.locator('.frontier-feedback').innerText(),/do not align/i);
    await page.locator('[data-action=archive-dial][data-index="1"]').click();
    await page.locator('[data-action=archive-dial][data-index="2"]').click();
    await page.locator('[data-action=archive-dial][data-index="2"]').click();
    await page.locator('[data-action=archive-align]').click();
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.archives.southgate.solved),true);
    await page.locator('[data-action=close]').first().click();
    await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();const item=e.world.records().find(r=>r.data.id==='southgate').project;
      s.player.x=item.x+1;s.player.z=item.z;e.interact(item);});
    await page.locator('[data-action=project-select][data-choice="watch"]').click();
    await page.locator('[data-action=project-confirm]').click();
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.projects.southgate),'watch');
    await page.locator('[data-action=close]').first().click();
    await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();const n=e.world.npcs().find(n=>n.id==='kea');s.player.x=n.x+1;s.player.z=n.z+1;e.interact(n);});
    await page.locator('[data-action=quest-complete]').click();
    await page.locator('[data-action=close]').first().click();
    await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();const stone=e.world.records().find(r=>r.data.id==='southgate').shrine;
      s.player.x=stone.x+1;s.player.z=stone.z;e.interact(stone);});
    await page.keyboard.press('c');
    await page.locator('[data-action=character-tab][data-tab=charms]').click();
    await page.locator('[data-action=charm-craft][data-charm="oak-heart"]').click();
    await page.locator('[data-action=charm-equip][data-charm="oak-heart"]').click();
    await page.keyboard.press('Escape');
    const combat=await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();e.setPaused(true);
      s.player.x=108;s.player.z=216;e.world.updateStreaming(108,216);const c=e.world.enemies().find(n=>n.type==='caster'&&n.region==='southgate');
      s.player.x=c.x+8;s.player.z=c.z;s.player.hp=100;e.invulnerable=0;c.state='chase';c.cooldown=0;c.stateTime=0;e.updateEnemies(.05);
      const direction={...c.aim};s.player.z+=3;for(let i=0;i<23;i++)e.updateEnemies(.05);
      const fired={...e.projectiles[0].direction};for(let i=0;i<20;i++)e.updateProjectiles(.1);const dodge=s.player.hp;
      s.player.x=c.x+8;s.player.z=c.z;s.player.hp=100;e.invulnerable=0;c.state='chase';c.cooldown=0;c.stateTime=0;e.updateEnemies(.05);
      for(let i=0;i<23;i++)e.updateEnemies(.05);for(let i=0;i<20;i++)e.updateProjectiles(.1);
      const hit=s.player.hp;e.setPaused(false);return {direction,fired,dodge,hit};});
    assert.deepEqual(combat.direction,combat.fired);assert.equal(combat.dodge,100);assert.ok(combat.hit<100);
    await page.waitForTimeout(1800);await page.reload();await begin(page);
    const saved=await page.evaluate(()=>{const s=window.__ETERNITY_DEV__().state;return {archive:s.world.archives.southgate.solved,
      project:s.world.projects.southgate,quest:s.world.quests['gate-of-questions'],gear:s.player.gear.equipped};});
    assert.deepEqual(saved,{archive:true,project:'watch',quest:'complete',gear:'oak-heart'});
    assert.deepEqual(errors,[]);console.log('Desktop archive / choice / quest / charm / combat / encrypted reload: PASS');
  } finally {await browser.close();}
}

async function mobile() {
  const browser=await launch();
  try {
    const {page,errors}=await newPage(browser,{viewport:{width:568,height:320},isMobile:true,hasTouch:true});
    await begin(page,true);
    await page.locator('.bottom-dock [data-action=map]').tap();
    await page.locator('[data-action=atlas-chapter][data-chapter="3"]').tap();
    const bounds=await page.locator('.atlas-chapters button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,right:r.right};}));
    assert.equal(bounds.length,4);for(let i=1;i<bounds.length;i++) assert.ok(bounds[i-1].right<=bounds[i].x);
    await page.locator('.board-top [data-action=close]').tap();
    await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();s.player.x=108;s.player.z=216;s.player.ore=30;s.player.bloom=30;
      e.world.updateStreaming(108,216);const o=e.world.records().find(r=>r.data.id==='southgate').archive;s.player.x=o.x+1;s.player.z=o.z;e.renderHud();});
    await page.locator('.touch-actions [data-action=interact]').tap();
    await page.locator('[data-action=archive-dial][data-index="1"]').tap();
    await page.locator('[data-action=archive-dial][data-index="2"]').tap();await page.locator('[data-action=archive-dial][data-index="2"]').tap();
    await page.locator('[data-action=archive-align]').tap();
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.archives.southgate.solved),true);
    await page.locator('.archive-modal [data-action=close]').first().tap();
    await page.setViewportSize({width:320,height:568});
    await page.locator('.rotate-screen').waitFor({state:'visible'});await page.waitForTimeout(250);
    const time=await page.evaluate(()=>window.__ETERNITY_DEV__().engine.time);
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().engine.time),time);
    await page.setViewportSize({width:568,height:320});
    await page.locator('.rotate-screen').waitFor({state:'hidden'});await page.waitForTimeout(400);
    assert.ok(await page.evaluate(()=>window.__ETERNITY_DEV__().engine.time)>time);
    assert.deepEqual(errors,[]);console.log('Touch atlas / puzzle / portrait pause / landscape resume: PASS');
  } finally {await browser.close();}
}

await desktop();await mobile();
