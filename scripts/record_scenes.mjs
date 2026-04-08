/**
 * Record a single continuous browser walkthrough for the STDN Explorer video.
 * One session, one video file. Navigates tab-to-tab without reloading.
 * Timed to match full-length narration audio (~6 min).
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const videoDir = path.join(__dirname, '..', 'docs', 'video_recordings');
fs.mkdirSync(videoDir, { recursive: true });

const BASE = 'https://dads2busy.github.io/stdn-explorer/';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function selectSearchable(page, triggerIndex, text) {
  const triggers = await page.locator('.searchable-select-trigger').all();
  await triggers[triggerIndex].click();
  await sleep(400);
  const inputs = await page.locator('.searchable-select input[type="text"]').all();
  const lastInput = inputs[inputs.length - 1];
  await lastInput.fill(text);
  await sleep(500);
  const options = await page.locator('.searchable-select-option').all();
  for (const opt of options) {
    const optText = await opt.textContent();
    if (optText.trim().startsWith(text)) {
      await opt.click();
      return;
    }
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

  // ============================================================
  // SCENE 00: INTRO (audio: 31.7s)
  // Show dashboard loading, select All Domains
  // ============================================================
  console.log('Scene 00: Intro');
  await page.goto(BASE);
  await sleep(3000);
  await page.selectOption('#domain-select', 'all');
  await sleep(3000);
  // Let the default Technology Network view show with a technology
  await selectSearchable(page, 0, 'Smartphone');
  await sleep(5000);
  // Linger on the graph so viewer sees the full 4-layer structure
  await sleep(25000);

  // ============================================================
  // SCENE 01: MATERIAL NETWORK (audio: 38.2s)
  // Switch to Material Network, select Helium
  // ============================================================
  console.log('Scene 01: Material Network');
  await page.click('text=Material Network');
  await sleep(2500);
  // Select Helium from the material dropdown
  const matTrigger = page.locator('.searchable-select-trigger').first();
  await matTrigger.click();
  await sleep(400);
  const matInput = page.locator('.searchable-select input[type="text"]').first();
  await matInput.fill('Helium');
  await sleep(500);
  // Click the first option: "Helium (152)"
  const matOptions = await page.locator('.searchable-select-option').all();
  if (matOptions.length > 0) await matOptions[0].click();
  await sleep(6000);
  // Let graph settle and viewer absorb the 152 tech count
  await sleep(10000);
  // Click somewhere on the graph to show domain drill-down (click a domain node area)
  const cyContainer = page.locator('[class*=cytoscape], canvas, .graph-container').first();
  if (await cyContainer.count() > 0) {
    await cyContainer.click({ position: { x: 500, y: 300 } });
    await sleep(4000);
    // Click background to reset
    await cyContainer.click({ position: { x: 720, y: 600 } });
    await sleep(3000);
  } else {
    await sleep(7000);
  }
  await sleep(10000);

  // ============================================================
  // SCENE 02: TECHNOLOGY NETWORK (audio: 38.1s)
  // Switch to Technology Network, select Smartphone, click Helium node
  // ============================================================
  console.log('Scene 02: Technology Network');
  await page.click('text=Technology Network');
  await sleep(2000);
  // Smartphone should still be selected from the intro, but re-select to be safe
  await selectSearchable(page, 0, 'Smartphone');
  await sleep(6000);
  // Let graph render fully
  await sleep(10000);
  // Click on a node in the material ring (purple/process consumable area)
  // The graph has concentric rings; materials are in the 3rd ring out
  if (await cyContainer.count() > 0) {
    // Try clicking in the material ring area
    await cyContainer.click({ position: { x: 280, y: 350 } });
    await sleep(5000);
    // Try another spot if detail panel didn't open
    await cyContainer.click({ position: { x: 600, y: 200 } });
    await sleep(5000);
  }
  await sleep(14000);

  // ============================================================
  // SCENE 03: CONCENTRATION (audio: 37.1s)
  // Show HHI heatmap, find Helium
  // ============================================================
  console.log('Scene 03: Concentration');
  await page.click('text=Concentration');
  await sleep(4000);
  // Let heatmap load and viewer see the full grid
  await sleep(6000);
  // Try to scroll down to Helium rows
  const scrollable = page.locator('.heatmap-scroll').first();
  if (await scrollable.count() > 0) {
    await scrollable.evaluate(el => el.scrollTop = 250);
    await sleep(3000);
  }
  // Click on a Helium cell to show detail panel
  const heliumCell = page.locator('td:has-text("Helium gas")').first();
  if (await heliumCell.count() > 0) {
    await heliumCell.click();
    await sleep(6000);
  } else {
    const heliumAlt = page.locator('td:has-text("Helium")').first();
    if (await heliumAlt.count() > 0) {
      await heliumAlt.click();
      await sleep(6000);
    }
  }
  await sleep(14000);

  // ============================================================
  // SCENE 04: DOMINANCE (audio: 24.3s)
  // Show country table, find Qatar
  // ============================================================
  console.log('Scene 04: Dominance');
  await page.click('text=Dominance');
  await sleep(3000);
  // Let table load
  await sleep(4000);
  // Scroll down to find Qatar row
  const qatarCell = page.locator('td:has-text("Qatar")').first();
  if (await qatarCell.count() > 0) {
    await qatarCell.scrollIntoViewIfNeeded();
    await sleep(1500);
    await qatarCell.click();
    await sleep(6000);
  }
  await sleep(8000);

  // ============================================================
  // SCENE 05: OVERLAP (audio: 33.2s)
  // Show Shared Materials, then Shared Countries
  // ============================================================
  console.log('Scene 05: Overlap');
  await page.click('text=Overlap');
  await sleep(3000);
  // Shared Materials is default - show Helium near top
  await sleep(6000);
  // Click on Helium row in shared materials
  const heliumOverlap = page.locator('td:has-text("Helium")').first();
  if (await heliumOverlap.count() > 0) {
    await heliumOverlap.click();
    await sleep(4000);
  }
  // Switch to Shared Countries
  await page.click('text=Shared Countries');
  await sleep(3000);
  // Show Qatar in shared countries
  const qatarOverlap = page.locator('td:has-text("Qatar")').first();
  if (await qatarOverlap.count() > 0) {
    await qatarOverlap.scrollIntoViewIfNeeded();
    await sleep(1500);
    await qatarOverlap.click();
    await sleep(4000);
  }
  await sleep(9000);

  // ============================================================
  // SCENE 06: SUPPLY DISRUPTION (audio: 22.8s)
  // Select Qatar, show results, expand a row
  // ============================================================
  console.log('Scene 06: Supply Disruption');
  await page.click('text=Supply Disruption');
  await sleep(2500);
  // Select Qatar from the country dropdown
  await selectSearchable(page, 0, 'Qatar');
  await sleep(5000);
  // Let results load and viewer see summary bar
  await sleep(4000);
  // Expand Smartphone row to show Helium detail
  const smartphoneRow = page.locator('tr:has-text("Smartphone")').first();
  if (await smartphoneRow.count() > 0) {
    await smartphoneRow.click();
    await sleep(5000);
  }
  await sleep(4000);

  // ============================================================
  // SCENE 07: TRADE DISRUPTION (audio: 49.2s)
  // Show heatmap, click Helium column, switch to Substitutability
  // ============================================================
  console.log('Scene 07: Trade Disruption');
  await page.click('text=Trade Disruption');
  await sleep(4000);
  // Let heatmap load
  await sleep(5000);
  // Click on Helium column header
  const heliumCol = page.locator('th:has-text("Helium")').first();
  if (await heliumCol.count() > 0) {
    await heliumCol.click();
    await sleep(8000);
  }
  // Let viewer read the year-by-year detail panel
  await sleep(8000);
  // Switch to Substitutability
  await page.click('text=Substitutability');
  await sleep(3000);
  // Scroll to find Helium row and click it
  const heliumSubRow = page.locator('td:has-text("Helium")').first();
  if (await heliumSubRow.count() > 0) {
    await heliumSubRow.scrollIntoViewIfNeeded();
    await sleep(1000);
    await heliumSubRow.click();
    await sleep(6000);
  }
  await sleep(10000);

  // ============================================================
  // SCENE 08: ANALYST - Report (audio: 32.2s)
  // Generate Helium disruption report
  // ============================================================
  console.log('Scene 08: Analyst');
  await page.click('text=Analyst');
  await sleep(2500);
  // Select template
  await page.click('text=Disruption impact of a material');
  await sleep(1000);
  // Select Helium
  await page.locator('select').nth(1).selectOption({ label: 'Helium' });
  await sleep(500);
  // Click Analyze
  await page.locator('button:has-text("Analyze")').first().click();
  await sleep(5000);
  // Scroll through the report slowly
  await page.evaluate(() => {
    const chatArea = document.querySelector('.analyst-chat-area');
    if (chatArea) chatArea.scrollTop = chatArea.scrollHeight / 3;
  });
  await sleep(4000);
  await page.evaluate(() => {
    const chatArea = document.querySelector('.analyst-chat-area');
    if (chatArea) chatArea.scrollTop = chatArea.scrollHeight * 2 / 3;
  });
  await sleep(4000);
  await page.evaluate(() => {
    const chatArea = document.querySelector('.analyst-chat-area');
    if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
  });
  await sleep(5000);
  // Linger on recommendations
  await sleep(12000);

  // ============================================================
  // SCENE 09: GEMINI CHAT (audio: 27.6s)
  // Ask follow-up question, WAIT for response
  // ============================================================
  console.log('Scene 09: Gemini chat');
  const chatInput = page.locator('input[placeholder*="Ask about"]');
  if (await chatInput.count() > 0) {
    await chatInput.fill('What is the potential trade disruption impact on the United States of a 40% reduction in Helium production by Qatar?');
    await sleep(1000);
    await page.locator('button:has-text("Send")').click();
    console.log('  Waiting for Gemini response...');
    // Wait up to 60 seconds for the response
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const loading = await page.locator('.gemini-loading').count();
      if (loading === 0 && i > 2) {
        console.log(`  Response received after ${(i + 1) * 2}s`);
        break;
      }
    }
    // Scroll the Gemini panel to show the full response
    await page.evaluate(() => {
      const panels = document.querySelectorAll('.gemini-messages, [class*=gemini]');
      panels.forEach(p => { if (p.scrollHeight > p.clientHeight) p.scrollTop = p.scrollHeight; });
    });
    await sleep(8000);
  } else {
    await sleep(25000);
  }

  // ============================================================
  // SCENE 10: CLOSING (audio: 18.8s)
  // Linger on the full dashboard with report + Gemini visible
  // ============================================================
  console.log('Scene 10: Closing');
  await sleep(30000);

  // Done - close and save
  console.log('\nClosing browser...');
  await page.close();
  const video = page.video();
  if (video) {
    const dest = path.join(videoDir, 'full_walkthrough.webm');
    await video.saveAs(dest);
    const stat = fs.statSync(dest);
    console.log(`\nSaved: ${dest} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
  }
  await context.close();
  await browser.close();
  console.log('Done!');
})();
