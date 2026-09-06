import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const outputDir = resolve(root, 'docs/visual-checks');
await mkdir(outputDir, { recursive: true });
const report = { date: new Date().toISOString(), baseURL: process.env.PRISM_TEST_URL || 'http://127.0.0.1:5173', checks: [], screenshots: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
const check = (name, passed, detail = {}) => {
  const item = { name, passed: Boolean(passed), ...detail };
  report.checks.push(item);
  if (!passed) console.error('FAIL', name, JSON.stringify(detail));
};
const delay = ms => page.waitForTimeout(ms);
const attr = (selector, name) => page.locator(selector).getAttribute(name);
const screenshot = async label => {
  const path = resolve(outputDir, `qa-${label}.png`);
  await page.screenshot({ path });
  report.screenshots.push(path);
};
const canvasHash = async () => createHash('sha256').update(await page.locator('#particle-canvas').screenshot()).digest('hex');
async function geometry(label) {
  const result = await page.evaluate(() => {
    const rect = el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const canvas = rect(document.querySelector('#particle-canvas'));
    const selectors = ['.info-rail', '.source-chip', '.controls-rail'];
    const regions = selectors.map(selector => ({ selector, ...rect(document.querySelector(selector)) }));
    const intersections = regions.filter(r => Math.min(canvas.right, r.right) - Math.max(canvas.x, r.x) > 1 && Math.min(canvas.bottom, r.bottom) - Math.max(canvas.y, r.y) > 1);
    const outside = regions.filter(r => r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1);
    const controls = [...document.querySelectorAll('button')].map(el => ({ id: el.id || el.dataset.mode, ...rect(el) }));
    return { viewport: { width: innerWidth, height: innerHeight }, canvas, regions, intersections, outside, overflow: { horizontal: document.documentElement.scrollWidth - innerWidth, vertical: document.documentElement.scrollHeight - innerHeight }, controls };
  });
  check(`${label}: no page overflow`, result.overflow.horizontal <= 1 && result.overflow.vertical <= 1, result);
  check(`${label}: canvas and side UI do not intersect`, result.intersections.length === 0, { intersections: result.intersections });
  check(`${label}: UI regions stay inside viewport`, result.outside.length === 0, { outside: result.outside });
  check(`${label}: usable canvas`, result.canvas.width >= 100 && result.canvas.height >= 100, { canvas: result.canvas });
  return result;
}

async function fixture(width, height, name) {
  const base64 = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#e4a88c'); gradient.addColorStop(.5, '#89b7b0'); gradient.addColorStop(1, '#e6d395');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#f9f5e9'; ctx.beginPath(); ctx.arc(width * .5, height * .5, Math.min(width, height) * .26, 0, Math.PI * 2); ctx.fill();
    return canvas.toDataURL('image/png').split(',')[1];
  }, { width, height });
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

try {
  await page.goto(report.baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#source-meta')?.textContent.includes('个粒子'));
  await delay(1900);
  check('requested copy removed', !(await page.locator('body').innerText()).includes('仅在本地处理') && await page.locator('[data-lucide="arrow-up-right"]').count() === 0);
  check('closed parameters are inert', await page.locator('#parameter-panel').evaluate(el => el.inert && el.getAttribute('aria-hidden') === 'true'));
  await page.locator('#tune-button').focus();
  await page.keyboard.press('Tab');
  check('Tab skips closed parameter inputs', await page.evaluate(() => document.activeElement.id === 'scatter-button'));

  for (const [width, height] of [[1440,900], [1280,720], [390,844], [320,568], [844,390]]) {
    const label = `${width}x${height}`;
    await page.setViewportSize({ width, height });
    await delay(600);
    await geometry(`${label} closed`);
    await screenshot(`${label}-default`);
    await page.locator('#tune-button').click();
    await delay(450);
    check(`${label}: parameters open`, await attr('#tune-button', 'aria-expanded') === 'true' && await page.locator('#parameter-panel').evaluate(el => !el.inert));
    await geometry(`${label} open`);
    for (const id of ['depth', 'motion', 'size']) {
      const slider = page.locator(`#${id}-range`);
      await slider.focus();
      const before = Number(await slider.inputValue());
      await page.keyboard.press('ArrowRight');
      const after = Number(await slider.inputValue());
      check(`${label}: ${id} range keyboard works`, after > before && Number(await page.locator(`#${id}-output`).innerText()) === after, { before, after });
    }
    await screenshot(`${label}-parameters`);
    await page.keyboard.press('Escape');
    check(`${label}: Escape closes parameters and restores focus`, await attr('#tune-button', 'aria-expanded') === 'false' && await page.evaluate(() => document.activeElement.id === 'tune-button') && await page.locator('#parameter-panel').evaluate(el => el.inert));
    for (const mode of ['wave', 'dust', 'relief']) {
      await page.locator(`[data-mode="${mode}"]`).click();
      check(`${label}: ${mode} mode`, await attr(`[data-mode="${mode}"]`, 'aria-pressed') === 'true' && await page.locator('.mode-button[aria-pressed="true"]').count() === 1);
    }
    await page.locator('#scatter-button').click();
    check(`${label}: scatter`, await attr('#scatter-button', 'aria-pressed') === 'true' && (await page.locator('#scatter-button').textContent()).includes('聚合'));
    await page.locator('#scatter-button').click();
    check(`${label}: gather`, await attr('#scatter-button', 'aria-pressed') === 'false');
    await page.locator('#pause-button').click();
    check(`${label}: pause`, await attr('#pause-button', 'aria-pressed') === 'true');
    await page.locator('#pause-button').click();
    check(`${label}: resume`, await attr('#pause-button', 'aria-pressed') === 'false');
    await page.locator('#reset-button').click();
    check(`${label}: reset feedback`, (await page.locator('#toast').innerText()).includes('视角已复位'));
    console.log(`Completed ${label}`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await delay(500);
  await page.locator('[data-mode="wave"]').focus();
  await page.keyboard.press('Space');
  check('native Space activates focused mode without pausing', await attr('[data-mode="wave"]', 'aria-pressed') === 'true' && await attr('#pause-button', 'aria-pressed') === 'false');
  await page.locator('#tune-button').focus();
  await page.keyboard.press('Space');
  check('native Space activates parameter toggle without pausing', await attr('#tune-button', 'aria-expanded') === 'true' && await attr('#pause-button', 'aria-pressed') === 'false');
  await page.locator('#depth-range').focus();
  await page.keyboard.press('Escape');
  await page.locator('#pause-button').focus();
  await page.keyboard.press('Space');
  check('native Space pauses exactly once on pause button', await attr('#pause-button', 'aria-pressed') === 'true');
  await page.keyboard.press('Space');
  check('native Space resumes exactly once on pause button', await attr('#pause-button', 'aria-pressed') === 'false');
  await page.locator('#particle-canvas').focus();
  await page.keyboard.press('Space');
  check('canvas Space shortcut pauses', await attr('#pause-button', 'aria-pressed') === 'true');
  await delay(1700);
  const paused1 = await canvasHash(); await delay(350); const paused2 = await canvasHash();
  check('paused canvas stops animating', paused1 === paused2);
  await page.keyboard.press('ArrowRight'); await delay(800);
  const rotated = await canvasHash();
  check('canvas keyboard rotation changes render while paused', paused2 !== rotated);
  await page.keyboard.press('Escape'); await delay(900);
  const reset = await canvasHash();
  check('Escape reset changes rotated render', reset !== rotated);
  await page.locator('[data-mode="dust"]').click(); await delay(1000);
  check('mode change changes actual canvas render', reset !== await canvasHash());
  await page.locator('#preset-select').selectOption('tide');
  check('built-in mood applies mode and all parameters', await attr('[data-mode="wave"]', 'aria-pressed') === 'true' && Number(await page.locator('#depth-range').inputValue()) === 1.05 && Number(await page.locator('#motion-range').inputValue()) === .52 && Number(await page.locator('#size-range').inputValue()) === 1);
  await page.locator('#depth-range').evaluate(el => { el.value = '1.33'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  check('manual adjustment marks mood as current tweak', await page.locator('#preset-select').inputValue() === 'manual');
  await page.locator('#save-preset').click();
  await page.locator('#preset-name').fill('测试气质');
  await page.locator('#preset-form button[type="submit"]').click();
  check('custom mood saves and becomes selected', (await page.locator('#preset-select option').allTextContents()).includes('测试气质') && !(await page.locator('#delete-preset').isDisabled()));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#source-meta')?.textContent.includes('个粒子'));
  check('custom mood persists after reload', (await page.locator('#preset-select option').allTextContents()).includes('测试气质') && await page.locator('#preset-select').inputValue() !== 'manual');
  await page.locator('#delete-preset').click();
  check('custom mood deletes and returns to reveal', !(await page.locator('#preset-select option').allTextContents()).includes('测试气质') && await page.locator('#preset-select').inputValue() === 'reveal');
  const scatteredBefore = await canvasHash();
  await page.locator('#scatter-button').click(); await delay(1300);
  check('scatter changes actual canvas render', scatteredBefore !== await canvasHash());
  await page.locator('#scatter-button').click();
  if (await attr('#pause-button', 'aria-pressed') === 'true') await page.locator('#pause-button').click();

  await page.locator('#capture-button').click();
  await delay(700);
  check('capture mode hides side UI and exposes capture actions', await page.locator('#app').evaluate(el => el.classList.contains('capture-mode')) && await page.locator('#capture-actions').evaluate(el => !el.inert && el.getAttribute('aria-hidden') === 'false'));
  const captureGeometry = await page.evaluate(() => {
    const stage = document.querySelector('.stage').getBoundingClientRect();
    return { x: stage.x, y: stage.y, right: stage.right, bottom: stage.bottom, width: stage.width, height: stage.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  check('capture mode gives artwork the viewport', captureGeometry.x <= 1 && captureGeometry.y <= 1 && captureGeometry.right >= captureGeometry.viewportWidth - 1 && captureGeometry.bottom >= captureGeometry.viewportHeight - 1, captureGeometry);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-button').click();
  const download = await downloadPromise;
  check('2x PNG export downloads descriptive filename', /^prism-.+\.png$/.test(download.suggestedFilename()), { filename: download.suggestedFilename() });
  await page.waitForFunction(() => !document.querySelector('#export-button').disabled);
  check('2x PNG export reports dimensions', /\d+ × \d+/.test(await page.locator('#toast').innerText()));
  await page.keyboard.press('Escape');
  await delay(350);
  check('Escape exits capture mode and restores focus', await page.locator('#app').evaluate(el => !el.classList.contains('capture-mode')) && await page.evaluate(() => document.activeElement.id === 'capture-button'));

  const portrait = await fixture(240, 480, 'portrait-check.png');
  const landscape = await fixture(640, 240, 'landscape-check.png');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#choose-button').focus();
  await page.keyboard.press('Space');
  const chooser = await chooserPromise;
  await chooser.setFiles(portrait);
  await page.waitForFunction(() => document.querySelector('#source-name').textContent === 'portrait-check');
  await delay(1900);
  check('native Space on choose opens file chooser and uploads', await attr('#pause-button', 'aria-pressed') === 'false' && await page.locator('#app').evaluate(el => el.classList.contains('has-custom')));
  await geometry('portrait uploaded desktop'); await screenshot('portrait-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await delay(700);
  await geometry('portrait uploaded mobile'); await screenshot('portrait-mobile');
  await page.locator('#file-input').setInputFiles(landscape);
  await page.waitForFunction(() => document.querySelector('#source-name').textContent === 'landscape-check');
  await delay(1900);
  await geometry('landscape uploaded mobile'); await screenshot('landscape-mobile');
  await page.setViewportSize({ width: 1440, height: 900 }); await delay(700);
  await geometry('landscape uploaded desktop'); await screenshot('landscape-desktop');

  await page.locator('#file-input').setInputFiles({ name: 'unsupported.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  check('unsupported file displays error and preserves artwork', (await page.locator('#toast').innerText()).includes('请选择 JPG') && (await page.locator('#source-name').innerText()) === 'landscape-check');
  await page.locator('#file-input').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a png') });
  await delay(350);
  check('corrupt file displays error and preserves artwork', !['图像已经进入空间', '视角已复位'].includes(await page.locator('#toast').innerText()) && (await page.locator('#source-name').innerText()) === 'landscape-check' && await page.locator('#processing').evaluate(el => !el.classList.contains('visible')));
  await page.locator('#file-input').setInputFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.alloc(30 * 1024 * 1024 + 1) });
  check('oversized file displays limit', (await page.locator('#toast').innerText()).includes('30 MB'));
  await page.evaluate(({ base64 }) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'drop-check.png', { type: 'image/png' }));
    window.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }));
  }, { base64: portrait.buffer.toString('base64') });
  check('file drag shows overlay', await page.locator('#app').evaluate(el => el.classList.contains('drag-active')));
  await page.evaluate(({ base64 }) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'drop-check.png', { type: 'image/png' }));
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  }, { base64: portrait.buffer.toString('base64') });
  await page.waitForFunction(() => document.querySelector('#source-name').textContent === 'drop-check');
  check('drop imports and clears overlay', await page.locator('#app').evaluate(el => !el.classList.contains('drag-active')));
  check('no uncaught browser exceptions', report.errors.length === 0, { errors: report.errors });
} catch (error) {
  check('test run completed', false, { error: error.stack });
} finally {
  report.summary = { total: report.checks.length, passed: report.checks.filter(item => item.passed).length, failed: report.checks.filter(item => !item.passed).length };
  await writeFile(resolve(outputDir, 'layout-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.summary));
  await browser.close();
  if (report.summary.failed) process.exitCode = 1;
}
