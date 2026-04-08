# STDN Explorer Video Walkthrough Script

**Total runtime target: ~3 minutes**
**Format: Screen recording with voiceover narration**
**Scenario: Assessing the impact of a 40% reduction in Qatar's Helium production**

---

## INTRO (0:00 - 0:20)

**[Screen: Dashboard loads, showing the Technology Network tab with the domain set to "All Domains"]**

> Suppose you need to assess the impact of a 40% reduction in Helium production from Qatar. Where do you start? How many technologies are affected, how concentrated is the market, and what does the US import picture actually look like?
>
> STDN Explorer is a supply chain analysis dashboard that maps 180 technologies across microelectronics, biotechnology, and pharmaceuticals down to the raw materials and countries they depend on. Let's walk through how you'd use it to build a picture of this scenario.

---

## SCENE 1: Material Network - Scope (0:20 - 0:50)

**[Action: Click "Material Network" tab. Select "Helium" from the material dropdown. Graph renders showing 152 technologies across 3 domains.]**

> We start with the Material Network. This view works in the opposite direction from the rest of the dashboard. Instead of picking a technology and looking at what it needs, we pick a material and see everything that depends on it.
>
> Selecting Helium, we immediately see 152 technologies across all three domains. Three rings of subdomains and technologies fan out from the center. This is not a niche material. It touches nearly everything in the dataset.

**[Action: Click on the Microelectronics domain node to focus the view, pause briefly, then click background to reset.]**

> Clicking a domain lets you drill into one sector at a time. But the important takeaway is the number: 152 out of 180 technologies.

---

## SCENE 2: Technology Network - Mechanism (0:50 - 1:15)

**[Action: Click "Technology Network" tab. Select "Smartphone" from the technology dropdown. Graph renders.]**

> Now let's look at one of those technologies up close. Selecting Smartphone loads the four-layer dependency graph. The technology is at the center, surrounded by its components, the materials those components need, and the countries that produce them.

**[Action: Click the Helium node (purple, process consumable). Detail panel opens on the right showing Qatar at 38.8%.]**

> Clicking the Helium node, we see it's a process consumable, shown in purple with a dashed edge. It's used during manufacturing for leak testing but is not in the final product. The detail panel shows Qatar holding 38.8% of global production. Notice the navigation buttons here. These let us jump directly to the Concentration or Overlap views with Helium already selected.

---

## SCENE 3: Concentration - Market structure (1:15 - 1:40)

**[Action: Click "Concentration" tab. Heatmap loads. Scroll or sort to show Helium row.]**

> The Concentration view shows a heatmap of HHI scores, a standard measure of market concentration. Materials are rows, technologies are columns. Red and orange cells mean production is controlled by a small number of countries.

**[Action: Click on a Helium cell. Detail panel shows HHI of ~4,814, top producers: US 56.7%, Qatar 38.8%, Algeria 7.3%.]**

> Helium's HHI is 4,814, solidly in the high concentration range. Only six countries produce it at any scale, and the top two, the United States and Qatar, account for over 95% of global output. A 40% cut to Qatar's production removes roughly 15.5% of world supply. In a market this concentrated, there is no spare capacity to absorb that.

---

## SCENE 4: Dominance - Qatar's position (1:40 - 1:55)

**[Action: Click "Dominance" tab. Table loads sorted by dominated materials. Scroll to find Qatar.]**

> The Dominance view ranks countries by how many materials they lead in. China and the United States dominate hundreds of materials. Qatar appears further down with a Low classification. It leads in just one material.

**[Action: Click Qatar's row. Detail panel opens.]**

> But look at the reach: 173 technologies affected, with an average share of 36.2%. Qatar's risk profile is narrow but deep. One material, nearly every technology.

---

## SCENE 5: Overlap - Systemic scope (1:55 - 2:15)

**[Action: Click "Overlap" tab. Shared Materials sub-tab is shown.]**

> The Overlap view answers a direct question: if Qatar's Helium output drops, how many technologies feel it at once? Helium is the third most widely shared material in the dataset, appearing in 152 technologies with an HHI of 4,814.

**[Action: Click "Shared Countries" sub-tab. Scroll to Qatar.]**

> Switching to Shared Countries, Qatar shows up touching 173 technologies but through only 10 materials. Compare that to China at the top, which touches 180 technologies through 920 materials. Qatar's exposure is concentrated in a single commodity.

---

## SCENE 6: Supply Disruption - Direct impact (2:15 - 2:30)

**[Action: Click "Supply Disruption" tab. Select "Qatar" from the country dropdown. Results load.]**

> The Supply Disruption simulator models what happens if a country stops producing entirely. Selecting Qatar: 0 Critical, 152 High severity technologies, 173 total affected. Every Helium-dependent technology gets a High rating because Qatar holds 38.8% of production.

**[Action: Click to expand the Smartphone row, showing Helium at 38.8%, process consumable.]**

> Expanding any row shows the specific materials and components at risk.

---

## SCENE 7: Trade Disruption - Import reality (2:30 - 2:50)

**[Action: Click "Trade Disruption" tab. Heatmap loads. Find the Helium column.]**

> The Trade Disruption view uses a different data source: actual US import values from UN Comtrade. Here the story diverges from the production share picture. Click the Helium column.

**[Action: Click Helium column. Year-by-year detail appears showing Qatar dominant through 2021, then Canada taking over from 2022-2025.]**

> Qatar was the top US Helium import source through 2021. But starting in 2022, Canada replaced it. By 2025, Canada accounts for nearly all US Helium imports. A Qatar production cut still tightens global supply and prices, but the direct US import exposure has shifted.

**[Action: Click "Substitutability" sub-tab. Find Helium row.]**

> The Substitutability tab confirms Helium's lock-in: only 2 distinct countries have held the top supplier position across 9 years.

---

## SCENE 8: Analyst - Synthesis (2:50 - 3:15)

**[Action: Click "Analyst" tab. Select "Disruption impact of a material" template. Choose Helium. Click Analyze.]**

> Finally, the Analyst section pulls everything together. Selecting the "Disruption impact of a material" template for Helium generates a structured report: material overview, top producers, affected technologies, systemic risk assessment, and recommendations.

**[Action: Scroll through the report briefly. Then type in the Gemini chat: "What is the potential trade disruption impact on the United States of a 40% reduction in Helium production by Qatar?" Send and show the response.]**

> The Ask Gemini sidebar lets you ask follow-up questions using the full dataset as context. Asking specifically about the 40% Qatar reduction, Gemini calculates a 15.5% global supply reduction and flags the systemic risk across all 152 dependent technologies.

---

## CLOSING (3:15 - 3:25)

**[Screen: Pull back to show the full dashboard with the Analyst report visible]**

> In three minutes, we've gone from "Qatar produces Helium" to a quantified, multi-dimensional picture: 152 technologies at risk, an HHI of 4,814, a shifting US import landscape, and a structured policy report. The dashboard gives you the numbers. What you do with them is your call.

---

## PRODUCTION NOTES

- All interactions use the "All Domains" setting with process consumables enabled
- Playwright recordings should capture at 1440x900 viewport, 30fps
- Pause briefly (1-2 seconds) after each major UI state change to let the viewer read
- Narration pacing: roughly 150 words per minute (broadcast standard)
- Total narration word count: ~730 words at ~150 wpm = ~4:50 of narration; tighten pauses and overlap narration with transitions to hit the 3:15-3:25 target
- Consider adding subtle zoom/highlight effects on key numbers (152 technologies, 38.8%, HHI 4,814) during post-production
