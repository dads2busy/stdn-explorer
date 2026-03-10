import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "docs", "screenshots");
const BASE = "http://localhost:5173";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1. Explore tab (auto-selects first technology)
  console.log("Capturing Explore...");
  await page.goto(BASE);
  await page.waitForSelector(".graph-canvas", { timeout: 10000 });
  await page.waitForTimeout(2000); // let cytoscape render
  await page.screenshot({ path: path.join(OUT, "explore.png") });

  // 2. Concentration tab
  console.log("Capturing Concentration...");
  await page.click('button.tab:has-text("Concentration")');
  await page.waitForSelector(".heatmap-table", { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "concentration.png") });

  // 3. Dominance tab
  console.log("Capturing Dominance...");
  await page.click('button.tab:has-text("Dominance")');
  await page.waitForSelector(".exposure-table", { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "dominance.png") });

  // 4. Overlap tab
  console.log("Capturing Overlap...");
  await page.click('button.tab:has-text("Overlap")');
  await page.waitForSelector(".exposure-table", { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "overlap.png") });

  // 5. Disruption tab (auto-selects first country)
  console.log("Capturing Disruption...");
  await page.click('button.tab:has-text("Disruption")');
  await page.waitForSelector(".exposure-table", { timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "disruption.png") });

  await browser.close();
  console.log(`Done. Screenshots saved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
