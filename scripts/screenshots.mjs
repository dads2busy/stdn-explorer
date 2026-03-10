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

  // 6. Analyst tab — click "Highest concentration risks" (no param, auto-submits)
  console.log("Capturing Analyst...");
  await page.click('button.tab:has-text("Analyst")');
  await page.waitForSelector(".analyst-container", { timeout: 10000 });
  // Click the 3rd template chip ("Highest concentration risks") which has paramType: "none"
  await page.click(".analyst-template-chip:nth-child(3)");
  await page.waitForSelector(".analyst-msg-analyst", { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "analyst.png") });

  // 7. Navigation buttons — go back to Explore, click a material node
  console.log("Capturing Navigation...");
  await page.click('button.tab:has-text("Network")');
  await page.waitForSelector(".graph-canvas", { timeout: 10000 });
  await page.waitForTimeout(2500);
  // Click on the graph canvas to try to hit a material node
  // Material nodes are at radius 270 in the concentric layout, so try clicking
  // at several positions around that ring relative to the canvas center
  const canvas = await page.$(".graph-canvas");
  if (canvas) {
    const box = await canvas.boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      // Try clicking at top of material ring (12 o'clock position)
      // The graph is fit to viewport, so scale factor varies. Try a few positions.
      const offsets = [
        { x: 0, y: -200 },   // top
        { x: 200, y: 0 },    // right
        { x: -200, y: 0 },   // left
        { x: 0, y: 200 },    // bottom
        { x: 140, y: -140 }, // top-right
      ];
      for (const off of offsets) {
        await page.mouse.click(cx + off.x, cy + off.y);
        await page.waitForTimeout(500);
        const navBtns = await page.$(".node-nav-buttons");
        if (navBtns) break;
      }
    }
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "navigation.png") });

  await browser.close();
  console.log(`Done. Screenshots saved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
