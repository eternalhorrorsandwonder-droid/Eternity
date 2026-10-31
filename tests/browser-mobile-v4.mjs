/** Touch layout and controls at representative narrow landscape sizes. */
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

const executablePath=process.env.CHROMIUM_PATH;
if (!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium or Chrome executable.');
const base=process.env.ETERNITY_URL || 'http://localhost:5173';
const args=['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'];
const intersects=(a,b)=>a.x<b.right && a.right>b.x && a.y<b.bottom && a.bottom>b.y;

// Separate browsers avoid WebGL-context exhaustion in software-rendered CI.
for (const viewport of [{width:801,height:320},{width:720,height:320},{width:568,height:320},{width:480,height:320},{width:400,height:260}]) {
  const browser=await chromium.launch({executablePath,headless:true,args});
  try {
    const page=await browser.newPage({viewport,isMobile:true,hasTouch:true}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('disabled in smoke test'));});
    await page.goto(base);
    await page.locator('[data-action=begin]').tap();
    await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine);
    const boxes=await page.locator('.action-bar button, .touch-actions button, .dock-buttons button, .joystick').evaluateAll(nodes=>
      nodes.filter(n=>{const r=n.getBoundingClientRect(),style=getComputedStyle(n);return r.width>0 && r.height>0 && style.display!=='none' && style.visibility!=='hidden';})
      .map(n=>{const r=n.getBoundingClientRect();return {name:n.dataset.action || 'joystick',x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));
    for (let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++)
      assert.equal(intersects(boxes[i],boxes[j]),false,`${viewport.width}px: ${boxes[i].name} overlaps ${boxes[j].name}`);
    if (viewport.width>=568 && viewport.width<=800) for (const box of boxes.filter(b=>['map','journal','character'].includes(b.name)))
      assert.ok(box.width>=44 && box.height>=44,`${box.name} touch target is too small`);
    const tracker=await page.locator('.quest-tracker').boundingBox();
    const joystick=boxes.find(box=>box.name==='joystick');
    assert.equal(intersects({...tracker,right:tracker.x+tracker.width,bottom:tracker.y+tracker.height},joystick),false,`${viewport.width}px: tracker covers joystick`);
    const player=await page.locator('.player-panel').boundingBox(), upper=await page.locator('.upper-right').boundingBox();
    assert.equal(intersects({...player,right:player.x+player.width,bottom:player.y+player.height},{...upper,right:upper.x+upper.width,bottom:upper.y+upper.height}),false,`${viewport.width}px: player panel covers map controls`);
    // Insert a fresh notification rather than depending on startup timing.
    await page.evaluate(()=>window.__ETERNITY_DEV__().engine.ui.toast('Layout check','Touch controls remain clear.','info'));
    const toast=await page.locator('.toast').last().boundingBox();
    assert.ok(toast,'notification should be visible');
    for (const box of boxes)
      assert.equal(intersects({...toast,right:toast.x+toast.width,bottom:toast.y+toast.height},box),false,`${viewport.width}px: toast covers ${box.name}`);
    await page.locator('.bottom-dock [data-action=journal]').tap();
    await page.locator('[data-action=journal-tab][data-tab=routes]').tap();
    await page.locator('[data-action=track-route][data-trail=first-footsteps]').tap();
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.trails.active),'first-footsteps');
    await page.locator('.board-top [data-action=close]').tap();
    await page.locator('.bottom-dock [data-action=character]').tap();
    await page.locator('[data-action=character-tab][data-tab=kit]').tap();
    assert.equal(await page.locator('.kit-card').count(),3);
    assert.deepEqual(errors,[]);
    console.log(`V4 touch controls and boards (${viewport.width}×${viewport.height}): PASS`);
  } finally {await browser.close();}
}
