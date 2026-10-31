/** V5 integration: browser UI, live models, collision and encrypted reload.
 * Dev-only positioning supplies late-game fixtures; repair and dialogue use real keys/UI.
 */
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const executablePath=process.env.CHROMIUM_PATH;
if(!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium or Chrome executable.');
const base=process.env.ETERNITY_URL || 'http://localhost:5173';
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:700}}),errors=[];
page.on('pageerror',error=>errors.push(error.stack));
try {
  await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('disabled for QA'));});
  await page.goto(base);await page.locator('[data-action=begin]').click();
  await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine);
  // Enter the chapter and set up its NPC. The dialogue itself is opened by E.
  await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();
    s.player.x=108;s.player.z=324;s.player.level=20;s.player.hp=200;s.player.ore=0;s.player.echoes=0;
    e.world.updateStreaming(s.player.x,s.player.z);s.world.visited.push('tidegate');
    const n=e.world.npcs().find(n=>n.id==='nia');s.player.x=n.x+1;s.player.z=n.z;
    e.player.position.set(s.player.x,0,s.player.z);e.renderHud();});
  await page.keyboard.press('KeyE');await page.waitForSelector('.dialogue-modal');
  assert.equal(await page.locator('.dialogue-copy h2').innerText(),'Nia');
  await page.waitForFunction(()=>{const img=document.querySelector('.dialogue-art img');return img?.complete && img.naturalWidth>0});
  assert.match(await page.locator('.dialogue-copy').innerText(),/circle|surge/i);
  await page.locator('[data-action=quest-accept]').click();
  await page.locator('.dialogue-modal [data-action=close]').first().click();
  assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.quests['opening-the-sound']),'active');

  // Exercise actual rendered warning geometry and engine damage with controlled time.
  const tide=await page.evaluate(()=>{
    const {engine:e,state:s}=window.__ETERNITY_DEV__();e.setPaused(true);
    const record=e.world.regions.get('tidegate'),surge=record.surges[0];
    s.player.x=surge.x;s.player.z=surge.z;s.player.hp=200;e.invulnerable=0;e.tideRegion=null;
    e.updateTides(2.6);const warning={visible:surge.warning.visible,scale:surge.warning.scale.x,radius:surge.radius,phase:surge.cycle.phase,hp:s.player.hp};
    e.updateTides(1.4);const before=s.player.hp;e.updateTides(.11);const after=s.player.hp;
    e.updateTides(.1);const once=s.player.hp;
    surge.cycle.phase='warning';surge.cycle.remaining=.01;e.invulnerable=.3;e.updateTides(.02);const dodged=s.player.hp;
    surge.cycle.phase='warning';surge.cycle.remaining=.01;e.invulnerable=0;s.player.x=surge.x+surge.radius+.05;e.updateTides(.02);const outside=s.player.hp;
    e.setPaused(false);return {warning,before,after,once,dodged,outside};
  });
  assert.equal(tide.warning.visible,true);assert.equal(tide.warning.phase,'warning');
  assert.equal(tide.warning.scale,tide.warning.radius);assert.equal(tide.before,200);assert.equal(tide.after,178);
  assert.equal(tide.once,178);assert.equal(tide.dodged,178);assert.equal(tide.outside,178);

  // The actual E interaction fails safely, then spends once and changes the model.
  await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();const a=e.world.regions.get('tidegate').anchor;
    s.player.x=a.x+1;s.player.z=a.z;e.player.position.set(s.player.x,0,s.player.z);e.renderHud();});
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>[...document.querySelectorAll('.toast')].some(n=>n.textContent.includes('Materials needed')));
  assert.deepEqual(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.tideAnchors),[]);
  await page.evaluate(()=>{let {state:s}=window.__ETERNITY_DEV__();s.player.ore=5;s.player.echoes=5;});
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__ETERNITY_DEV__().state.world.tideAnchors.includes('tidegate'));
  let repair=await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();const r=e.world.regions.get('tidegate');return {ore:s.player.ore,echoes:s.player.echoes,active:r.anchor.model.userData.active,warning:r.surges.some(x=>x.warning.visible)};});
  assert.deepEqual(repair,{ore:3,echoes:3,active:true,warning:false});
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.player.ore),3);

  // Read the memory and turn in Nia's request through normal UI.
  await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();const item=e.world.regions.get('tidegate').interactables.find(x=>x.kind==='lore');
    s.player.x=item.x+1;s.player.z=item.z;e.player.position.set(s.player.x,0,s.player.z);e.renderHud();});
  await page.keyboard.press('KeyE');await page.waitForSelector('.memory-modal');
  await page.locator('.memory-modal [data-action=close]').first().click();
  await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();const n=e.world.npcs().find(n=>n.id==='nia');
    s.player.x=n.x+1;s.player.z=n.z;e.player.position.set(s.player.x,0,s.player.z);e.renderHud();});
  await page.keyboard.press('KeyE');await page.waitForSelector('.dialogue-modal');
  assert.match(await page.locator('.dialogue-copy').innerText(),/first anchor is holding/i);
  await page.locator('[data-action=quest-complete]').click();await page.locator('.dialogue-modal [data-action=close]').first().click();
  assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.quests['opening-the-sound']),'complete');

  // The new enemy's real model and state machine lock a lane, miss a sidestep,
  // hit a stationary player, and stop at scenery. No cosmetic-only checks.
  const runner=await page.evaluate(()=>{
    const {engine:e,state:s}=window.__ETERNITY_DEV__();e.setPaused(true);
    const n=e.world.enemies().find(n=>n.region==='tidegate'&&n.type==='surger');
    const oldEnemies=e.world.enemies,oldColliders=e.world.colliders,oldNpcs=e.world.npcs;
    let colliders=[];e.world.enemies=()=>[n];e.world.colliders=()=>colliders;e.world.npcs=()=>[];
    n.alive=true;n.model.visible=true;n.x=n.homeX;n.z=n.homeZ;n.state='chase';n.stateTime=0;n.cooldown=0;
    s.player.x=n.x+5;s.player.z=n.z;s.player.hp=200;e.invulnerable=0;e.updateEnemies(.05);
    const aim={...n.aim},lane=n.state;
    s.player.z+=3;e.updateEnemies(.6);const shown=n.warnings[0].visible;e.updateEnemies(.7);
    const charging=n.state;e.updateEnemies(1);const sidestep={hp:s.player.hp,state:n.state,dx:n.x-n.homeX};
    n.x=n.homeX;n.z=n.homeZ;n.state='charging';n.aim={x:1,z:0};n.chargeRemaining=7;s.player.x=n.x+5;s.player.z=n.z;s.player.hp=200;e.invulnerable=0;
    e.updateEnemies(1);const hit=s.player.hp;
    n.x=n.homeX;n.z=n.homeZ;n.state='charging';n.aim={x:1,z:0};n.chargeRemaining=7;s.player.x=n.x+5;s.player.z=n.z;s.player.hp=200;e.invulnerable=0;
    colliders=[{x:n.x+3,z:n.z,r:.6}];e.updateEnemies(1);const blocked={hp:s.player.hp,dx:n.x-n.homeX,state:n.state};
    e.world.enemies=oldEnemies;e.world.colliders=oldColliders;e.world.npcs=oldNpcs;e.setPaused(false);
    return {aim,lane,shown,charging,sidestep,hit,blocked};
  });
  assert.deepEqual(runner.aim,{x:1,z:0});assert.equal(runner.lane,'windup');assert.equal(runner.shown,true);assert.equal(runner.charging,'charging');
  assert.equal(runner.sidestep.hp,200);assert.equal(runner.sidestep.state,'recover');assert.ok(Math.abs(runner.sidestep.dx-7)<.02);
  assert.ok(runner.hit<200);assert.equal(runner.blocked.hp,200);assert.equal(runner.blocked.state,'recover');assert.ok(runner.blocked.dx<2.01);

  // Atlas and field guide expose actual state, then encrypted autosave survives reload.
  await page.keyboard.press('KeyM');await page.locator('[data-action=atlas-chapter][data-chapter="4"]').click();
  await page.locator('[data-action=region-select][data-region=tidegate]').click();
  assert.match(await page.locator('.atlas-detail').innerText(),/TIDE ANCHOR REPAIRED/);
  await page.keyboard.press('Escape');await page.keyboard.press('Tab');await page.locator('[data-action=journal-tab][data-tab=field-guide]').click();
  assert.equal(await page.locator('.field-card').filter({hasText:'Tide-runner'}).count(),1);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('[data-action=save-now]').click();
  await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='SAVED');
  await page.reload();await page.locator('[data-action=begin]').click();await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine);
  const saved=await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();return {version:s.version,anchors:s.world.tideAnchors,quest:s.world.quests['opening-the-sound'],
    seen:s.world.bestiary.surger?.seen,model:e.world.regions.get('tidegate')?.anchor?.model.userData.active};});
  assert.deepEqual(saved,{version:5,anchors:['tidegate'],quest:'complete',seen:true,model:true});
  assert.deepEqual(errors,[]);console.log('V5 dialogue / tide warning and repair / runner / atlas / encrypted reload: PASS');
} finally {await browser.close();}
