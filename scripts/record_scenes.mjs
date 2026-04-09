/**
 * Record a single continuous browser walkthrough, timed by measured audio durations.
 *
 * Strategy (Option A):
 * 1. Record one continuous video
 * 2. At each action cue, perform the browser action then sleep for
 *    exactly the corresponding audio segment's duration + 1.5s gap
 * 3. In post-production, the audio segments are concatenated with
 *    matching 1.5s silence gaps, so video and audio are in sync.
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const videoDir = path.join(__dirname, '..', 'docs', 'video_recordings');
fs.mkdirSync(videoDir, { recursive: true });

const BASE = 'https://dads2busy.github.io/stdn-explorer/';
const GAP = 1500; // 1.5s silence gap between segments

// Load measured audio durations
const durations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'docs', 'video_audio', 'segment_durations.json'), 'utf-8')
);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Convert segment duration (seconds) to ms, add gap
function segMs(segId) {
  const dur = durations[segId];
  if (!dur) throw new Error(`Unknown segment: ${segId}`);
  return Math.round(dur * 1000) + GAP;
}

// Click a Cytoscape node by label via _cyreg
async function clickCyNode(page, labelSubstring) {
  const pos = await page.evaluate((label) => {
    for (const el of document.querySelectorAll('div')) {
      if (el._cyreg && el._cyreg.cy) {
        const cy = el._cyreg.cy;
        const rect = el.getBoundingClientRect();
        const node = cy.nodes().filter(n => n.data('label')?.includes(label))[0];
        if (node) {
          const rp = node.renderedPosition();
          return { x: Math.round(rect.left + rp.x), y: Math.round(rect.top + rp.y), found: true, label: node.data('label') };
        }
      }
    }
    return { found: false };
  }, labelSubstring);
  if (pos.found) {
    console.log(`    click "${pos.label}" at (${pos.x}, ${pos.y})`);
    await page.mouse.click(pos.x, pos.y);
    return true;
  }
  console.log(`    node "${labelSubstring}" not found`);
  return false;
}

async function dblClickCyNode(page, labelSubstring) {
  const pos = await page.evaluate((label) => {
    for (const el of document.querySelectorAll('div')) {
      if (el._cyreg && el._cyreg.cy) {
        const cy = el._cyreg.cy;
        const rect = el.getBoundingClientRect();
        const node = cy.nodes().filter(n => n.data('label')?.includes(label))[0];
        if (node) {
          const rp = node.renderedPosition();
          return { x: Math.round(rect.left + rp.x), y: Math.round(rect.top + rp.y), found: true, label: node.data('label') };
        }
      }
    }
    return { found: false };
  }, labelSubstring);
  if (pos.found) {
    console.log(`    dblclick "${pos.label}" at (${pos.x}, ${pos.y})`);
    await page.mouse.dblclick(pos.x, pos.y);
    return true;
  }
  console.log(`    node "${labelSubstring}" not found for dblclick`);
  return false;
}

async function selectSearchable(page, triggerIndex, text) {
  const triggers = await page.locator('.searchable-select-trigger').all();
  await triggers[triggerIndex].click();
  await sleep(400);
  const inputs = await page.locator('.searchable-select input[type="text"]').all();
  await inputs[inputs.length - 1].fill(text);
  await sleep(500);
  const options = await page.locator('.searchable-select-option').all();
  for (const opt of options) {
    if ((await opt.textContent()).trim().startsWith(text)) { await opt.click(); return; }
  }
  if (options.length > 0) await options[0].click();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  let elapsed = 0;
  const mark = (id) => {
    const dur = durations[id] || 0;
    elapsed += dur + GAP/1000;
    console.log(`  [${Math.round(elapsed)}s] ${id} (${dur}s audio)`);
  };

  // === intro_hook: Dashboard loads ===
  console.log('=== INTRO ===');
  await page.goto(BASE);
  await sleep(2000);
  await page.selectOption('#domain-select', 'all');
  await sleep(2000);
  mark('intro_hook');
  await sleep(segMs('intro_hook') - 4000); // subtract the 4s already spent loading

  // === intro_context: Linger on dashboard ===
  mark('intro_context');
  await sleep(segMs('intro_context'));

  // === mat_intro: Click Material Network tab ===
  console.log('=== MATERIAL NETWORK ===');
  await page.click('text=Material Network');
  await sleep(2000);
  mark('mat_intro');
  await sleep(segMs('mat_intro') - 2000);

  // === mat_helium: Select Helium ===
  const matTrigger = page.locator('.searchable-select-trigger').first();
  await matTrigger.click();
  await sleep(400);
  await page.locator('.searchable-select input[type="text"]').first().fill('Helium');
  await sleep(500);
  const matOpts = await page.locator('.searchable-select-option').all();
  if (matOpts.length > 0) await matOpts[0].click();
  await sleep(2000);
  mark('mat_helium');
  await sleep(segMs('mat_helium') - 3000);

  // === mat_domain: Click Microelectronics ===
  await clickCyNode(page, 'Microelectronics');
  mark('mat_domain');
  await sleep(segMs('mat_domain'));

  // === mat_subdomain: Click Consumer Electronics ===
  await clickCyNode(page, 'Consumer Electronics');
  mark('mat_subdomain');
  await sleep(segMs('mat_subdomain'));

  // === mat_smartphone: Double-click Smartphone ===
  const navWorked = await dblClickCyNode(page, 'Smartphone');
  await sleep(3000); // wait for navigation
  if (!navWorked) {
    await page.click('text=Technology Network');
    await sleep(1500);
    await selectSearchable(page, 0, 'Smartphone');
    await sleep(2000);
  }
  mark('mat_smartphone');
  await sleep(segMs('mat_smartphone') - 3000);

  // === tech_overview: Let graph render ===
  console.log('=== TECHNOLOGY NETWORK ===');
  await sleep(3000); // let graph render
  mark('tech_overview');
  await sleep(segMs('tech_overview') - 3000);

  // === tech_component: Click a component ===
  let clicked = await clickCyNode(page, 'Processor');
  if (!clicked) clicked = await clickCyNode(page, 'Battery');
  if (!clicked) clicked = await clickCyNode(page, 'Display');
  mark('tech_component');
  await sleep(segMs('tech_component'));

  // === tech_helium: Click Helium node ===
  await clickCyNode(page, 'Helium');
  mark('tech_helium');
  await sleep(segMs('tech_helium'));

  // === tech_qatar: Click Qatar node, then re-click Helium to show nav buttons,
  //     then click "See Technology/Material Country Concentration" to navigate
  await clickCyNode(page, 'Qatar');
  await sleep(5000);
  // "Notice the navigation buttons" — re-click Helium to show its detail panel with nav buttons
  await clickCyNode(page, 'Helium');
  await sleep(5000); // extra pause to let viewer see the nav buttons
  // Click the concentration navigation button in the detail panel
  const concNavBtn = page.locator('button:has-text("See Technology/Material Country Concentration")');
  if (await concNavBtn.count() > 0) {
    console.log('    clicking concentration nav button');
    await concNavBtn.click();
    await sleep(3000);
    // Ensure the highlighted column/row scroll completes (smooth scroll can be slow)
    await page.evaluate(() => {
      // Find the focused column header and scroll it into view immediately
      const focusedCol = document.querySelector('.heatmap-tech-header.focused');
      if (focusedCol) focusedCol.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
      const focusedRow = document.querySelector('.heatmap-material-label.focused, tr.focused');
      if (focusedRow) focusedRow.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await sleep(1000);
  } else {
    console.log('    nav button not found, falling back to tab click');
    await page.click('text=Concentration');
    await sleep(3000);
  }
  mark('tech_qatar');
  await sleep(segMs('tech_qatar') - 13000);

  // === conc_intro: Concentration view already loaded via nav button,
  //     with Smartphone/Helium cell pre-selected and scrolled into view
  console.log('=== CONCENTRATION ===');
  await sleep(2000);
  mark('conc_intro');
  await sleep(segMs('conc_intro') - 2000);

  // === conc_helium: Cell should already be highlighted; just linger ===
  await sleep(1500);
  mark('conc_helium');
  await sleep(segMs('conc_helium') - 3000);

  // === dom_intro: Click Dominance tab, scroll to Qatar ===
  console.log('=== DOMINANCE ===');
  await page.click('text=Dominance');
  await sleep(2500);
  const qDom = page.locator('td:has-text("Qatar")').first();
  if (await qDom.count() > 0) {
    await qDom.scrollIntoViewIfNeeded();
    await sleep(500);
  }
  mark('dom_intro');
  await sleep(segMs('dom_intro') - 3000);

  // === dom_qatar: Click Qatar row ===
  if (await qDom.count() > 0) await qDom.click();
  await sleep(1000);
  mark('dom_qatar');
  await sleep(segMs('dom_qatar') - 1000);

  // === overlap_materials: Select All Domains, then Click Overlap tab ===
  console.log('=== OVERLAP ===');
  await page.selectOption('#domain-select', 'all');
  await sleep(1500);
  await page.click('text=Overlap');
  await sleep(2500);
  const hOverlap = page.locator('td:has-text("Helium")').first();
  if (await hOverlap.count() > 0) await hOverlap.click();
  await sleep(1000);
  mark('overlap_materials');
  await sleep(segMs('overlap_materials') - 3500);

  // === overlap_countries: Click Shared Countries ===
  await page.click('text=Shared Countries');
  await sleep(2000);
  const qOverlap = page.locator('td:has-text("Qatar")').first();
  if (await qOverlap.count() > 0) {
    await qOverlap.scrollIntoViewIfNeeded();
    await sleep(500);
    await qOverlap.click();
  }
  await sleep(1000);
  mark('overlap_countries');
  await sleep(segMs('overlap_countries') - 3500);

  // === disrupt_intro: Click Supply Disruption, select Qatar ===
  console.log('=== SUPPLY DISRUPTION ===');
  await page.click('text=Supply Disruption');
  await sleep(2000);
  await selectSearchable(page, 0, 'Qatar');
  await sleep(3000);
  mark('disrupt_intro');
  await sleep(segMs('disrupt_intro') - 5000);

  // === disrupt_expand: Expand Smartphone row ===
  const lpRow = page.locator('tr:has-text("Laptop PC")').first();
  if (await lpRow.count() > 0) await lpRow.click();
  await sleep(1000);
  mark('disrupt_expand');
  await sleep(segMs('disrupt_expand') - 1000);

  // === trade_intro: Click Trade Disruption tab ===
  console.log('=== TRADE DISRUPTION ===');
  await page.click('text=Trade Disruption');
  await sleep(3000);
  mark('trade_intro');
  await sleep(segMs('trade_intro') - 3000);

  // === trade_helium: Click Helium column ===
  const hCol = page.locator('th:has-text("Helium")').first();
  if (await hCol.count() > 0) await hCol.click();
  await sleep(2000);
  mark('trade_helium');
  await sleep(segMs('trade_helium') - 2000);

  // === trade_subst: Click Substitutability, click Helium ===
  await page.click('text=Substitutability');
  await sleep(2000);
  const hSubRow = page.locator('td:has-text("Helium")').first();
  if (await hSubRow.count() > 0) {
    await hSubRow.scrollIntoViewIfNeeded();
    await sleep(500);
    await hSubRow.click();
  }
  await sleep(1000);
  mark('trade_subst');
  await sleep(segMs('trade_subst') - 3500);

  // === analyst_report: Generate Helium report ===
  console.log('=== ANALYST ===');
  await page.click('text=Analyst');
  await sleep(2000);
  await page.click('text=Disruption impact of a material');
  await sleep(800);
  await page.locator('select').nth(1).selectOption({ label: 'Helium' });
  await sleep(400);
  await page.locator('button:has-text("Analyze")').first().click();
  await sleep(4000);
  // Scroll through report
  await page.evaluate(() => {
    const c = document.querySelector('.analyst-chat-area');
    if (c) c.scrollTop = c.scrollHeight / 3;
  });
  await sleep(3000);
  await page.evaluate(() => {
    const c = document.querySelector('.analyst-chat-area');
    if (c) c.scrollTop = c.scrollHeight * 2 / 3;
  });
  await sleep(3000);
  await page.evaluate(() => {
    const c = document.querySelector('.analyst-chat-area');
    if (c) c.scrollTop = c.scrollHeight;
  });
  await sleep(2000);
  mark('analyst_report');
  await sleep(segMs('analyst_report') - 15200);

  // === gemini_query: Send Gemini question, wait for response ===
  console.log('=== GEMINI ===');
  const chatInput = page.locator('input[placeholder*="Ask about"]');
  if (await chatInput.count() > 0) {
    await chatInput.fill('What is the potential trade disruption impact on the United States of a 40% reduction in Helium production by Qatar?');
    await sleep(800);
    await page.locator('button:has-text("Send")').click();
    console.log('  Waiting for Gemini response...');
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const loading = await page.locator('.gemini-loading').count();
      if (loading === 0 && i > 2) {
        console.log(`  Response received after ${(i+1)*2}s`);
        break;
      }
    }
    await page.evaluate(() => {
      document.querySelectorAll('.gemini-messages, [class*=gemini]').forEach(p => {
        if (p.scrollHeight > p.clientHeight) p.scrollTop = p.scrollHeight;
      });
    });
  }
  mark('gemini_query');
  // Remaining time after Gemini response (may be short or zero)
  const geminiRemaining = segMs('gemini_query') - 2000;
  if (geminiRemaining > 0) await sleep(geminiRemaining);

  // === transition ===
  mark('transition');
  await sleep(segMs('transition'));

  // === data_origin: Show pipeline diagram ===
  console.log('=== DATA ORIGIN ===');
  await page.goto('file:///Users/ads7fg/git/stdn-explorer/docs/video_assets/pipeline_diagram.svg');
  await sleep(2000);
  mark('data_origin');
  await sleep(segMs('data_origin') - 2000);

  // === closing: Return to dashboard ===
  console.log('=== CLOSING ===');
  await page.goto(BASE);
  await sleep(2000);
  await page.selectOption('#domain-select', 'all');
  await sleep(1500);
  await page.click('text=Analyst');
  await sleep(1500);
  mark('closing');
  await sleep(segMs('closing') - 5000);

  // Done
  console.log(`\nTotal elapsed: ~${Math.round(elapsed)}s`);
  await page.close();
  const video = page.video();
  if (video) {
    const dest = path.join(videoDir, 'full_walkthrough.webm');
    await video.saveAs(dest);
    const stat = fs.statSync(dest);
    console.log(`Saved: ${dest} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
  }
  await context.close();
  await browser.close();
  console.log('Done!');
})();
