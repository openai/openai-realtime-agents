import {test,expect} from '@playwright/test';
test('mobile setup state and layout',async({page})=>{
 await page.route('**/api/health',r=>r.fulfill({json:{ready:false}}));
 await page.goto('/');await expect(page.getByRole('heading',{name:'Let’s talk.'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Start conversation'})).toBeDisabled();
 await expect(page.getByText('One small setup step')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
test('microphone denial returns to retryable state',async({page})=>{
 await page.route('**/api/health',r=>r.fulfill({json:{ready:true}}));
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
 await page.goto('/');await page.getByRole('button',{name:'Start conversation'}).click();
 await expect(page.locator('.notice.error')).toContainText('Microphone permission was denied');await expect(page.getByRole('button',{name:'Start conversation'})).toBeEnabled();
});
test('cancelling a pending microphone request releases late stream',async({page})=>{
 await page.route('**/api/health',r=>r.fulfill({json:{ready:true}}));
 await page.addInitScript(()=>{
  const w=window as unknown as {resolveMic:()=>void;stopped:boolean};w.stopped=false;
  navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{w.resolveMic=()=>resolve({getTracks:()=>[{stop:()=>{w.stopped=true;}}]} as unknown as MediaStream);});
 });
 await page.goto('/');await page.getByRole('button',{name:'Start conversation'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>(window as unknown as {resolveMic:()=>void}).resolveMic());
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {stopped:boolean}).stopped)).toBe(true);
 await expect(page.getByRole('button',{name:'Start conversation'})).toBeEnabled();
});

test('brain selector persists for the next call',async({page})=>{
 await page.route('**/api/health',r=>r.fulfill({json:{ready:true}}));await page.goto('/');
 await page.getByRole('button',{name:'Astra Highest capability'}).click();await page.reload();
 await expect(page.getByRole('button',{name:'Astra Highest capability'})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('Mode: Astra',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/brain-modes.png',fullPage:true});
});
test('selected starting mode is sent to the session endpoint',async({page})=>{
 await page.route('**/api/health',r=>r.fulfill({json:{ready:true}}));
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop:()=>{}}],getAudioTracks:()=>[{addEventListener:()=>{}}]} as unknown as MediaStream);});
 let selected='';
 await page.route('**/api/session',r=>{selected=r.request().postDataJSON().brain;return r.fulfill({status:503,json:{error:'Test session stopped before OpenAI connection.'}});});
 await page.goto('/');await page.getByRole('button',{name:'Terra Lower cost'}).click();await page.getByRole('button',{name:'Start conversation'}).click();
 await expect(page.locator('.notice.error')).toContainText('Test session stopped');expect(selected).toBe('terra');
});
