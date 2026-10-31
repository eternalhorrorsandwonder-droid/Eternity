/** New chapter tabs and real touch interactions at compact landscape sizes. */
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const executablePath=process.env.CHROMIUM_PATH;
if(!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium or Chrome executable.');
const base=process.env.ETERNITY_URL || 'http://localhost:5173';
const args=['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'];
for(const viewport of [{width:801,height:320},{width:720,height:320},{width:568,height:320},{width:480,height:320},{width:400,height:260}]) {
  const browser=await chromium.launch({executablePath,headless:true,args});
  try {
    const page=await browser.newPage({viewport,isMobile:true,hasTouch:true}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject('disabled')});
    await page.goto(base);await page.locator('[data-action=begin]').tap();
    await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine);
    await page.locator('.bottom-dock [data-action=map]').tap();
    const frame=await page.locator('.map-frame').boundingBox();
    const tabs=await page.locator('.atlas-chapters button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width};}));
    assert.equal(tabs.length,4);
    for(let i=0;i<tabs.length;i++) {
      assert.ok(tabs[i].width>0 && tabs[i].x>=frame.x && tabs[i].right<=frame.x+frame.width,`${viewport.width}: tab ${i+1} outside map`);
      if(i) assert.ok(tabs[i-1].right<=tabs[i].x,`${viewport.width}: overlapping chapter tabs`);
    }
    await page.locator('[data-action=atlas-chapter][data-chapter="4"]').tap();
    assert.equal(await page.locator('.map-zone').count(),10);
    assert.ok((await page.locator('[data-action=atlas-chapter][data-chapter="4"]').getAttribute('class')).includes('active'));
    if (viewport.width===400) {
      const sizes=await page.locator('.map-zone').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height}}));
      assert.ok(sizes.every(r=>r.width>=44 && r.height>=44),'small atlas needs usable map targets');
      await page.locator('.atlas-layout').evaluate(node=>node.scrollTop=75);
      await page.locator('[data-action=region-select][data-region=echoharbor]').tap();
      assert.ok(await page.locator('.atlas-layout').evaluate(node=>node.scrollTop)>0,'atlas scroll should survive selection');
    }
    await page.locator('.board-top [data-action=close]').tap();
    // Late-game setup; the touch USE button performs the repair itself.
    await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();s.player.x=108;s.player.z=324;
      e.world.updateStreaming(s.player.x,s.player.z);s.world.visited.push('tidegate');
      const a=e.world.regions.get('tidegate').anchor;s.player.x=a.x+1;s.player.z=a.z;s.player.ore=4;s.player.echoes=4;
      e.player.position.set(s.player.x,0,s.player.z);e.renderHud();});
    assert.match(await page.locator('#context-text').innerText(),/2 ore \+ 2 echoes/i);
    assert.equal(await page.locator('#context-prompt').isVisible(),true);
    assert.match(await page.locator('.touch-actions [data-action=interact]').getAttribute('aria-label'),/2 ore \+ 2 echoes/i);
    const prompt=await page.locator('#context-prompt').boundingBox();
    const controls=await page.locator('.action-bar button, .touch-actions button, .dock-buttons button, .joystick').evaluateAll(nodes=>nodes
      .filter(n=>{const r=n.getBoundingClientRect(),style=getComputedStyle(n);return r.width>0 && r.height>0 && style.display!=='none' && style.visibility!=='hidden';})
      .map(n=>{const r=n.getBoundingClientRect();return {name:n.dataset.action || 'joystick',x:r.x,y:r.y,width:r.width,height:r.height};}));
    for(const b of controls) assert.ok(!(prompt.x<b.x+b.width && prompt.x+prompt.width>b.x && prompt.y<b.y+b.height && prompt.y+prompt.height>b.y),`${viewport.width}: prompt overlaps ${b.name}`);
    await page.locator('.touch-actions [data-action=interact]').tap();
    assert.deepEqual(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.tideAnchors),['tidegate']);
    await page.locator('.bottom-dock [data-action=map]').tap();
    await page.locator('[data-action=region-select][data-region=tidegate]').tap();
    assert.match(await page.locator('.atlas-detail').innerText(),/TIDE ANCHOR REPAIRED/);
    assert.deepEqual(errors,[]);console.log(`V5 touch atlas and repair (${viewport.width}×${viewport.height}): PASS`);
  } finally {await browser.close();}
}
