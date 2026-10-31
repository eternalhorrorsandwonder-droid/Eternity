/** V6 regression: real UI/session locks, storage failures, confirmed imports and file races.
 * Run against the dev server; use a real Chromium executable in CHROMIUM_PATH.
 */
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {newGame} from '../src/core/state.js';
import {encryptSave} from '../src/core/save.js';
const executablePath=process.env.CHROMIUM_PATH;
if(!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium or Chrome executable.');
const base=process.env.ETERNITY_URL || 'http://localhost:5173';
const args=['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'];
const launch=()=>chromium.launch({executablePath,headless:true,args});
const file=(name,value)=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
const slot='eternity.vale.v1.slot.0';

async function sessionLifecycle() {
  const browser=await launch();
  try {
    const page=await browser.newPage({viewport:{width:1100,height:700}}),errors=[];
    page.on('pageerror',e=>errors.push(e.stack));
    await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject('disabled for QA')});
    await page.goto(base);await page.locator('[data-action=begin]').click();
    await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine);
    await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='SAVED');
    // Hold the actual Web Crypto write after the snapshot; the user must not
    // be able to dismiss the pause menu and move while it is in flight.
    await page.evaluate(()=>{window.encryptOriginal=SubtleCrypto.prototype.encrypt;window.delayEncryption=true;
      SubtleCrypto.prototype.encrypt=async function(...args){if(window.delayEncryption){window.encryptionWaiting=true;await new Promise(resolve=>window.releaseEncryption=resolve);}return window.encryptOriginal.apply(this,args);};});
    await page.keyboard.press('Escape');await page.locator('[data-action=return-title]').click();
    await page.waitForFunction(()=>window.encryptionWaiting===true);
    assert.equal(await page.locator('#session-status').isVisible(),true);
    assert.equal(await page.locator('#overlay').getAttribute('aria-busy'),'true');
    assert.equal(await page.locator('#overlay').evaluate(el=>el.inert),true);
    const before=await page.evaluate(()=>({paused:window.__ETERNITY_DEV__().engine.paused,z:window.__ETERNITY_DEV__().state.player.z}));
    await page.keyboard.press('Escape');await page.keyboard.down('KeyS');await page.waitForTimeout(500);await page.keyboard.up('KeyS');
    const after=await page.evaluate(()=>({paused:window.__ETERNITY_DEV__().engine.paused,z:window.__ETERNITY_DEV__().state.player.z}));
    assert.deepEqual(after,before);assert.equal(after.paused,true);
    await page.evaluate(()=>{window.delayEncryption=false;window.releaseEncryption();});
    await page.waitForFunction(()=>!window.__ETERNITY_DEV__().engine);
    const savedZ=await page.evaluate(async()=>{const {decryptSave}=await import('/src/core/save.js');return (await decryptSave(JSON.parse(localStorage.getItem('eternity.vale.v1.slot.0')))).player.z;});
    assert.equal(savedZ,before.z);
    assert.equal(await page.locator('#overlay').getAttribute('aria-busy'),'false');

    // Failed save-and-exit leaves the in-memory game paused, usable and not
    // falsely marked as saved. Once storage recovers the operation can retry.
    await page.locator('[data-action=begin]').click();await page.waitForFunction(()=>window.__ETERNITY_DEV__?.().engine);
    await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='SAVED');
    const original=await page.evaluate(key=>localStorage.getItem(key),slot);
    await page.evaluate(()=>{window.setOriginal=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){
      if(key==='eternity.vale.v1.slot.0') throw new DOMException('Simulated quota failure','QuotaExceededError');
      return window.setOriginal.call(this,key,value);};
      const {engine:e,state:s}=window.__ETERNITY_DEV__();s.player.coins=4371;e.queueSave();});
    await page.keyboard.press('Escape');await page.locator('[data-action=return-title]').click();
    await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='SAVE FAILED');
    await page.waitForFunction(()=>!document.querySelector('#app').classList.contains('session-busy'));
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().engine.paused),true);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),slot),original);
    assert.match(await page.locator('#pause-save-status').innerText(),/save failed/i);
    await page.locator('[data-action=resume]').click();assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().engine.paused),false);
    await page.keyboard.press('Escape');await page.evaluate(()=>{Storage.prototype.setItem=window.setOriginal;});
    await page.locator('[data-action=save-now]').click();await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent==='SAVED');
    let coins=await page.evaluate(async()=>{const {decryptSave}=await import('/src/core/save.js');return (await decryptSave(JSON.parse(localStorage.getItem('eternity.vale.v1.slot.0')))).player.coins;});
    assert.equal(coins,4371);

    // Replacing the active slot first saves the live state. If the second
    // write fails, the old engine and that durable snapshot must survive.
    const replacement=newGame('Imported');replacement.player.coins=8123;
    const envelope=await encryptSave(replacement);
    await page.locator('.pause-modal [data-action=slots]').click();await page.locator('#import-file').setInputFiles(file('active.eternity',envelope));
    await page.locator('[data-action=import-slot][data-slot="0"]').click();
    await page.evaluate(()=>{window.oldEngine=window.__ETERNITY_DEV__().engine;window.writeCount=0;window.setOriginal=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key==='eternity.vale.v1.slot.0' && ++window.writeCount===2)
        throw new DOMException('Replacement write failed','QuotaExceededError');return window.setOriginal.call(this,key,value);};});
    await page.locator('[data-action=import-confirm]').click();await page.waitForSelector('.inline-feedback');
    assert.match(await page.locator('.inline-feedback').innerText(),/Replacement write failed/i);
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().engine===window.oldEngine && window.oldEngine.paused),true);
    coins=await page.evaluate(async()=>{const {decryptSave}=await import('/src/core/save.js');return (await decryptSave(JSON.parse(localStorage.getItem('eternity.vale.v1.slot.0')))).player.coins;});
    assert.equal(coins,4371);
    await page.evaluate(()=>{Storage.prototype.setItem=window.setOriginal;});
    // Saving the live snapshot changed the slot token; explicitly reselect it
    // before retrying, rather than silently accepting a changed destination.
    await page.locator('[data-action=back-import]').click();await page.locator('[data-action=import-slot][data-slot="0"]').click();
    await page.locator('[data-action=import-confirm]').click();await page.waitForSelector('.slots-modal');
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().engine),null);
    coins=await page.evaluate(async()=>{const {decryptSave}=await import('/src/core/save.js');return (await decryptSave(JSON.parse(localStorage.getItem('eternity.vale.v1.slot.0')))).player.coins;});
    assert.equal(coins,8123);assert.deepEqual(errors,[]);
    console.log('V6 save transition lock / failure retains session / active-import rollback and retry: PASS');
  } finally {await browser.close();}
}

async function storageAndImport() {
  const browser=await launch();
  try {
    const page=await browser.newPage({viewport:{width:1100,height:700}}),errors=[];
    page.on('pageerror',e=>errors.push(e.stack));
    await page.addInitScript(()=>{window.getOriginal=Storage.prototype.getItem;window.readBlocked=true;
      Storage.prototype.getItem=function(key){if(window.readBlocked && key==='eternity.vale.v1.slot.0') throw new DOMException('read blocked','SecurityError');return window.getOriginal.call(this,key);};});
    await page.goto(base);
    assert.equal(await page.locator('#begin-label').innerText(),'CHECK SAVE SLOTS');
    await page.locator('[data-action=begin]').click();
    assert.equal(await page.locator('.slot-card.unavailable').count(),1);
    assert.equal(await page.locator('[data-action=slot-start][data-slot="0"]').count(),0);
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().engine),null);
    await page.locator('#import-file').setInputFiles(file('candidate.eternity',{format:'test'}));
    assert.equal(await page.locator('[data-action=import-slot][data-slot="0"]').isDisabled(),true);
    await page.locator('[data-action=back-slots]').click();
    await page.evaluate(()=>{window.readBlocked=false;});await page.locator('[data-action=refresh-slots]').click();
    assert.equal(await page.locator('.slot-card.unavailable').count(),0);
    // An empty string is a damaged occupied value, not an empty slot.
    await page.evaluate(()=>localStorage.setItem('eternity.vale.v1.slot.0',''));
    await page.locator('[data-action=refresh-slots]').count().then(async count=>{if(count) await page.locator('[data-action=refresh-slots]').click();else {await page.locator('.slots-modal [data-action=close]').click();await page.locator('#title-screen [data-action=slots]').click();}});
    assert.match(await page.locator('.slot-card').first().innerText(),/Save needs attention/i);
    assert.equal(await page.locator('[data-action=slot-start][data-slot="0"]').innerText().then(x=>/TRY OPEN/.test(x)),true);
    await page.locator('[data-action=slot-start][data-slot="0"]').click();await page.waitForSelector('.inline-feedback');
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),slot),'');
    assert.equal(await page.evaluate(()=>window.__ETERNITY_DEV__().engine),null);

    const old=newGame('Existing');old.player.coins=123;
    const replacement=newGame('Replacement');replacement.player.coins=987;
    const existing=await encryptSave(old),incoming=await encryptSave(replacement,'secret lantern');
    await page.evaluate(envelope=>localStorage.setItem('eternity.vale.v1.slot.0',JSON.stringify(envelope)),existing);
    await page.locator('.slots-modal [data-action=close]').click();await page.locator('#title-screen [data-action=slots]').click();
    const before=await page.evaluate(key=>localStorage.getItem(key),slot);
    await page.locator('#import-file').setInputFiles(file('replacement.eternity',incoming));
    await page.locator('#import-password').fill('wrong');await page.locator('[data-action=import-slot][data-slot="0"]').click();
    assert.match(await page.locator('.modal-header h2').innerText(),/Replace this journey/);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),slot),before);
    await page.locator('[data-action=back-import]').click();
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),slot),before);
    await page.locator('#import-password').fill('secret lantern');await page.locator('[data-action=import-slot][data-slot="0"]').click();
    await page.evaluate(key=>localStorage.setItem(key,'another tab changed this slot'),slot);
    await page.locator('[data-action=import-confirm]').click();await page.waitForSelector('.inline-feedback');
    assert.match(await page.locator('.inline-feedback').innerText(),/slot changed/i);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),slot),'another tab changed this slot');
    await page.evaluate(({key,before})=>localStorage.setItem(key,before),{key:slot,before});
    await page.locator('[data-action=back-import]').click();
    await page.locator('#import-password').fill('wrong');await page.locator('[data-action=import-slot][data-slot="0"]').click();
    await page.locator('[data-action=import-confirm]').click();await page.waitForSelector('.inline-feedback');
    assert.match(await page.locator('.inline-feedback').innerText(),/wrong|changed|could not/i);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),slot),before);
    assert.equal(await page.locator('#overlay').getAttribute('aria-busy'),'false');
    await page.locator('#confirm-import-password').fill('secret lantern');await page.locator('[data-action=import-confirm]').click();
    await page.waitForSelector('.slots-modal');
    const coins=await page.evaluate(async()=>{const {decryptSave}=await import('/src/core/save.js');return (await decryptSave(JSON.parse(localStorage.getItem('eternity.vale.v1.slot.0')))).player.coins;});
    assert.equal(coins,987);
    const importedRaw=await page.evaluate(key=>localStorage.getItem(key),slot);

    // A previously occupied destination also has to remain the one confirmed,
    // including during the asynchronous re-encryption step.
    await page.locator('#import-file').setInputFiles(file('replacement.eternity',incoming));
    await page.locator('#import-password').fill('secret lantern');await page.locator('[data-action=import-slot][data-slot="0"]').click();
    await page.evaluate(()=>{window.encOriginal=SubtleCrypto.prototype.encrypt;window.holdEnc=true;window.waitingEnc=false;
      SubtleCrypto.prototype.encrypt=async function(...args){if(window.holdEnc){window.waitingEnc=true;await new Promise(resolve=>window.releaseEnc=resolve);}return window.encOriginal.apply(this,args);};});
    await page.locator('[data-action=import-confirm]').click({timeout:2000,noWaitAfter:true});await page.waitForFunction(()=>window.waitingEnc);
    await page.evaluate(key=>{localStorage.setItem(key,'newer occupied payload');window.holdEnc=false;window.releaseEnc();},slot);
    await page.waitForSelector('.inline-feedback');assert.match(await page.locator('.inline-feedback').innerText(),/slot changed/i);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),slot),'newer occupied payload');
    await page.evaluate(({key,importedRaw})=>{Storage.prototype.setItem.call(localStorage,key,importedRaw);SubtleCrypto.prototype.encrypt=window.encOriginal;},{key:slot,importedRaw});
    await page.locator('[data-action=back-import]').click();await page.locator('[data-action=back-slots]').click();

    // Occupancy/readability are rechecked *after* encrypting, not just at the
    // click: another tab or storage failure cannot silently clobber an empty slot.
    await page.locator('#import-file').setInputFiles(file('replacement.eternity',incoming));
    await page.locator('#import-password').fill('secret lantern');
    await page.evaluate(()=>{window.encOriginal=SubtleCrypto.prototype.encrypt;window.holdEnc=true;window.waitingEnc=false;
      SubtleCrypto.prototype.encrypt=async function(...args){if(window.holdEnc){window.waitingEnc=true;await new Promise(resolve=>window.releaseEnc=resolve);}return window.encOriginal.apply(this,args);};});
    await page.locator('[data-action=import-slot][data-slot="1"]').click({timeout:2000,noWaitAfter:true});
    await page.waitForFunction(()=>window.waitingEnc);
    await page.evaluate(()=>{localStorage.setItem('eternity.vale.v1.slot.1','data from another tab');window.holdEnc=false;window.releaseEnc();});
    await page.waitForSelector('.inline-feedback');assert.match(await page.locator('.inline-feedback').innerText(),/no longer empty/i);
    assert.equal(await page.evaluate(()=>localStorage.getItem('eternity.vale.v1.slot.1')),'data from another tab');
    await page.evaluate(()=>{window.holdEnc=true;window.waitingEnc=false;});
    await page.locator('[data-action=import-slot][data-slot="2"]').click({timeout:2000,noWaitAfter:true});
    await page.waitForFunction(()=>window.waitingEnc);
    await page.evaluate(()=>{window.priorGet=Storage.prototype.getItem;Storage.prototype.getItem=function(key){
      if(key==='eternity.vale.v1.slot.2') throw new DOMException('temporarily blocked','SecurityError');
      return window.priorGet.call(this,key);};window.holdEnc=false;window.releaseEnc();});
    await page.waitForFunction(()=>document.querySelector('.inline-feedback')?.textContent.includes('could not be read'));
    assert.equal(await page.evaluate(()=>window.priorGet.call(localStorage,'eternity.vale.v1.slot.2')),null);
    await page.evaluate(()=>{Storage.prototype.getItem=window.priorGet;SubtleCrypto.prototype.encrypt=window.encOriginal});
    assert.deepEqual(errors,[]);console.log('V6 unavailable/corrupt slots / confirmed imports / wrong pass / changed-slot races: PASS');
  } finally {await browser.close();}
}

async function fileReadRace() {
  const browser=await launch();
  try {
    const page=await browser.newPage({viewport:{width:1100,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
    await page.goto(base);await page.locator('#title-screen [data-action=slots]').click();
    const chosen=newGame('Chosen');chosen.player.coins=2468;const valid=await encryptSave(chosen,'newest');
    await page.evaluate(()=>{window.originalText=Blob.prototype.text;Blob.prototype.text=function(){
      if(this.name==='slow.eternity') return new Promise(resolve=>window.releaseSlow=()=>resolve('{"protected":false}'));
      return window.originalText.call(this);
    };});
    await page.locator('#import-file').setInputFiles(file('slow.eternity',{bad:true}));await page.waitForFunction(()=>!!window.releaseSlow);
    await page.locator('#import-file').setInputFiles(file('newest.eternity',valid));await page.waitForSelector('#import-password');
    await page.evaluate(()=>window.releaseSlow());await page.waitForTimeout(100);
    assert.equal(await page.locator('#import-password').count(),1);
    await page.locator('#import-password').fill('newest');await page.locator('[data-action=import-slot][data-slot="0"]').click();await page.waitForSelector('.slots-modal');
    const coins=await page.evaluate(async()=>{const {decryptSave}=await import('/src/core/save.js');return (await decryptSave(JSON.parse(localStorage.getItem('eternity.vale.v1.slot.0')))).player.coins;});
    assert.equal(coins,2468);
    await page.evaluate(()=>{window.releaseSlow=null});
    await page.locator('#import-file').setInputFiles(file('slow.eternity',{bad:true}));await page.waitForFunction(()=>!!window.releaseSlow);
    await page.locator('.slots-modal [data-action=close]').click();await page.evaluate(()=>window.releaseSlow());await page.waitForTimeout(100);
    assert.equal(await page.locator('#overlay').evaluate(el=>el.classList.contains('hidden')),true);
    assert.deepEqual(errors,[]);console.log('V6 concurrent file selection / abandoned file read: PASS');
  } finally {await browser.close();}
}
await sessionLifecycle();await storageAndImport();await fileReadRace();
