/** Compact landscape layouts, real taps, and multi-touch joystick interruption. */
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const executablePath=process.env.CHROMIUM_PATH;
if(!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium or Chrome executable.');
const base=process.env.ETERNITY_URL || 'http://localhost:5173';
const args=['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'];
const sizes=[{width:360,height:240},{width:390,height:260},{width:400,height:260},
  {width:440,height:260},{width:441,height:260},{width:480,height:320},
  {width:568,height:320},{width:720,height:320},{width:801,height:320}];
const intersects=(a,b)=>a.x < b.x+b.width-.1 && a.x+a.width > b.x+.1 && a.y < b.y+b.height-.1 && a.y+a.height > b.y+.1;
for(const viewport of sizes) {
  const browser=await chromium.launch({executablePath,headless:true,args});
  try {
    const page=await browser.newPage({viewport,isMobile:true,hasTouch:true}),errors=[];
    page.on('pageerror',e=>errors.push(e.stack));
    await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject('disabled for QA')});
    await page.goto(base);await page.locator('[data-action=begin]').tap();await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine);
    // Position only; the actual repair, combat/skills and menu operations use taps.
    await page.evaluate(()=>{const {engine:e,state:s}=window.__ETERNITY_DEV__();s.player.x=108;s.player.z=324;
      e.world.updateStreaming(s.player.x,s.player.z);if(!s.world.visited.includes('tidegate')) s.world.visited.push('tidegate');
      const a=e.world.regions.get('tidegate').anchor;s.player.x=a.x+1;s.player.z=a.z;s.player.ore=4;s.player.echoes=4;
      s.player.skills.pulse=true;s.player.skills.ward=true;s.player.kit.supplies.flash=1;s.player.hp=40;
      // Prevent unrelated combat from interrupting this control-layout test.
      e.hurt=()=>{};
      e.player.position.set(s.player.x,0,s.player.z);e.renderHud();e.ui.toast('A useful notification','Visible without covering a control.');});
    await page.waitForFunction(()=>document.querySelector('#context-text')?.textContent.includes('Repair tide anchor'));
    assert.match(await page.locator('.touch-actions [data-action=interact]').getAttribute('aria-label'),/2 ore \+ 2 echoes/i);
    const layout=await page.evaluate(()=>{
      const visible=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
      const rect=n=>{const r=n.getBoundingClientRect();return {name:n.dataset.action||n.id,x:r.x,y:r.y,width:r.width,height:r.height};};
      const controls=[...document.querySelectorAll('.action-bar button,.touch-actions button,.dock-buttons button,.joystick,.quick-buttons button,.minimap-button')].filter(visible);
      const prompt=document.querySelector('#context-prompt'),text=document.querySelector('#context-text'),original=text.textContent;
      const examples=['Repair beacon · 2 ore + 2 echoes','Restore site · 3 ore + 3 sunpetals',
        'Repair tide anchor · 3 ore + 3 echoes','Restore waystone · 3 echoes','Examine archive lenses','Signal beacon repaired'];
      const prompts=examples.map(value=>{text.textContent=value;return {text:value,box:rect(prompt),clipped:text.scrollHeight>text.clientHeight+1};});
      text.textContent=original;
      return {controls:controls.map(n=>{const r=rect(n),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {...r,hit:!!top&&(top===n||n.contains(top)),top:top?.outerHTML.slice(0,120)};}),
        prompt:rect(prompt),prompts,toast:rect(document.querySelector('#toast-stack .toast:last-child'))};
    });
    for(const [i,a] of layout.controls.entries()) {
      assert.ok(a.width>=43.99 && a.height>=43.99,`${viewport.width}: target too small ${JSON.stringify(a)}`);
      assert.ok(a.x>=-.1&&a.y>=-.1&&a.x+a.width<=viewport.width+.1&&a.y+a.height<=viewport.height+.1,`${viewport.width}: offscreen ${JSON.stringify(a)}`);
      assert.equal(a.hit,true,`${viewport.width}: ${a.name} blocked by ${a.top}`);
      for(const b of layout.controls.slice(i+1)) assert.equal(intersects(a,b),false,`${viewport.width}: ${a.name} overlaps ${b.name}: ${JSON.stringify({a,b})}`);
      assert.equal(intersects(a,layout.prompt),false,`${viewport.width}: prompt overlaps ${a.name}: ${JSON.stringify({a,prompt:layout.prompt})}`);
      assert.equal(intersects(a,layout.toast),false,`${viewport.width}: notification covers ${a.name}: ${JSON.stringify({a,toast:layout.toast})}`);
      for(const p of layout.prompts) assert.equal(intersects(a,p.box),false,`${viewport.width}: ${p.text} covers ${a.name}`);
    }
    for(const p of layout.prompts) assert.equal(p.clipped,false,`${viewport.width}: prompt clips ${p.text}`);
    await page.locator('.touch-actions [data-action=interact]').tap();
    assert.deepEqual(await page.evaluate(()=>window.__ETERNITY_DEV__().state.world.tideAnchors),['tidegate']);
    await page.locator('.touch-actions [data-action=attack]').tap();
    assert.ok(await page.evaluate(()=>window.__ETERNITY_DEV__().engine.cooldowns.attack)>0);
    await page.locator('.touch-actions [data-action=dash]').tap();
    assert.ok(await page.evaluate(()=>window.__ETERNITY_DEV__().engine.cooldowns.dash)>0);
    await page.locator('.action-bar [data-action=pulse]').tap();
    assert.ok(await page.evaluate(()=>window.__ETERNITY_DEV__().engine.cooldowns.pulse)>0);
    await page.locator('.action-bar [data-action=ward]').tap();
    assert.ok(await page.evaluate(()=>window.__ETERNITY_DEV__().engine.cooldowns.ward)>0);
    await page.locator('.action-bar [data-action=potion]').tap();
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.player.potions),2);
    await page.locator('.action-bar [data-action=kit]').tap();
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().state.player.kit.supplies.flash),0);
    await page.locator('.quick-buttons [data-action=pause]').tap();
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().engine.paused),true);
    await page.locator('[data-action=settings]').tap();
    assert.equal(await page.locator('.settings-footer [data-action=fullscreen]').isVisible(),true);
    await page.locator('.modal-header [data-action=close]').tap();
    await page.locator('.bottom-dock [data-action=map]').tap();
    await page.locator('[data-action=board-tab][data-board=journal]').tap();
    assert.match(await page.locator('[data-action=board-tab][data-board=journal]').getAttribute('class'),/active/);
    await page.locator('[data-action=board-tab][data-board=character]').tap();
    assert.match(await page.locator('[data-action=board-tab][data-board=character]').getAttribute('class'),/active/);
    await page.locator('[data-action=board-tab][data-board=map]').tap();
    await page.locator('[data-action=atlas-chapter][data-chapter="4"]').tap();
    assert.equal(await page.locator('.map-zone').count(),10);
    await page.locator('.board-top [data-action=close]').tap();
    assert.deepEqual(errors,[]);console.log(`V6 touch hitboxes / actual actions / boards (${viewport.width}×${viewport.height}): PASS`);
  } finally {await browser.close();}
}

// Use the Chrome touch protocol so distinct pointers really are captured by
// the joystick. A second finger must not steal or release the first; pausing
// must reset it even if the first finger remains down.
const browser=await chromium.launch({executablePath,headless:true,args});
try {
  const page=await browser.newPage({viewport:{width:568,height:320},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject('disabled')});
  await page.goto(base);await page.locator('[data-action=begin]').tap();await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine);
  await page.evaluate(()=>{window.joystickPointer=null;window.strikeClicks=0;
    document.querySelector('#joystick').addEventListener('pointerdown',e=>window.joystickPointer=e.pointerId,{capture:true});
    document.addEventListener('click',e=>{if(e.target.closest('.touch-actions [data-action=attack]')) window.strikeClicks++;});});
  const cdp=await page.context().newCDPSession(page);
  const stick=await page.locator('#joystick').boundingBox(),pause=await page.locator('.quick-buttons [data-action=pause]').boundingBox();
  const one={x:stick.x+stick.width*.8,y:stick.y+stick.height/2,id:1};
  const two={x:stick.x+stick.width*.2,y:stick.y+stick.height/2,id:2};
  const pausePoint={x:pause.x+pause.width/2,y:pause.y+pause.height/2,id:3};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[one]});
  await page.waitForFunction(()=>window.__ETERNITY_DEV__().engine.touch.x>.3);
  const first=await page.evaluate(()=>({...window.__ETERNITY_DEV__().engine.touch}));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[one,two]});
  assert.deepEqual(await page.evaluate(()=>({...window.__ETERNITY_DEV__().engine.touch})),first);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[two]});
  assert.deepEqual(await page.evaluate(()=>({...window.__ETERNITY_DEV__().engine.touch})),first);
  // Strike and dodge with a second finger while the joystick remains held.
  const strike=await page.locator('.touch-actions [data-action=attack]').boundingBox();
  const dodge=await page.locator('.touch-actions [data-action=dash]').boundingBox();
  for(const [id,box,cooldown] of [[4,strike,'attack'],[5,dodge,'dash']]) {
    const point={id,x:box.x+box.width/2,y:box.y+box.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[one,point]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[point]});
    assert.ok(await page.evaluate(key=>window.__ETERNITY_DEV__().engine.cooldowns[key],cooldown)>0,`${cooldown} did not fire while moving`);
    assert.deepEqual(await page.evaluate(()=>({...window.__ETERNITY_DEV__().engine.touch})),first);
  }
  assert.equal(await page.evaluate(()=>window.strikeClicks),1,'a secondary tap must activate exactly once');
  // Releasing a touch outside a button must not accidentally activate it.
  const stray={...pausePoint,id:6},away={...stray,x:pausePoint.x-55,y:pausePoint.y+50};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[one,stray]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[one,away]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[away]});
  assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().engine.paused),false);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[one,pausePoint]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[pausePoint]});
  await page.waitForSelector('.pause-modal');
  assert.deepEqual(await page.evaluate(()=>({...window.__ETERNITY_DEV__().engine.touch})),{x:0,z:0});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[one]});
  await page.locator('[data-action=resume]').tap();
  assert.deepEqual(await page.evaluate(()=>({...window.__ETERNITY_DEV__().engine.touch})),{x:0,z:0});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[one]});
  await page.waitForFunction(()=>window.__ETERNITY_DEV__().engine.touch.x>.3);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForSelector('.pause-modal');
  assert.deepEqual(await page.evaluate(()=>({...window.__ETERNITY_DEV__().engine.touch})),{x:0,z:0});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[one]});
  assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().engine.ui.overlayType),'pause','releasing the stick must not click a menu behind it');
  await page.locator('[data-action=resume]').tap();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[one]});
  await page.waitForFunction(()=>window.__ETERNITY_DEV__().engine.touch.x>.3);
  // Activate pointer capture with a move, then lose it while the finger is down.
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...one,x:one.x+1}]});
  await page.evaluate(()=>document.querySelector('#joystick').releasePointerCapture(window.joystickPointer));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...one,x:one.x+2}]});
  await page.waitForFunction(()=>window.__ETERNITY_DEV__().engine.touch.x===0);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[one]});

  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[one]});
  await page.waitForFunction(()=>window.__ETERNITY_DEV__().engine.touch.x>.3);
  await page.setViewportSize({width:320,height:568});
  await page.waitForFunction(()=>window.__ETERNITY_DEV__().engine.orientationBlocked);
  assert.deepEqual(await page.evaluate(()=>({...window.__ETERNITY_DEV__().engine.touch})),{x:0,z:0});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[one]});
  await page.setViewportSize({width:568,height:320});
  await page.waitForFunction(()=>!window.__ETERNITY_DEV__().engine.orientationBlocked);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[one]});
  await page.waitForFunction(()=>window.__ETERNITY_DEV__().engine.touch.x>.3);
  // Emulate page hiding; the visibility handler pauses and resets the stick.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForSelector('.pause-modal');assert.deepEqual(await page.evaluate(()=>({...window.__ETERNITY_DEV__().engine.touch})),{x:0,z:0});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[one]});
  await page.evaluate(()=>{delete document.hidden;});
  assert.deepEqual(errors,[]);console.log('V6 two-finger combat / ownership / pause, blur, capture, orientation and hidden resets: PASS');
} finally {await browser.close();}
