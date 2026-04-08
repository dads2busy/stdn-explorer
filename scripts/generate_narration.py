"""Generate narration audio for the STDN Explorer video walkthrough.

Uses OpenAI TTS (tts-1-hd, onyx voice) to produce one MP3 per scene.
Full-length version (~5 min).
"""

import os
from pathlib import Path
from openai import OpenAI

# Load API key from dpi_stdn_agentic .env
env_path = Path.home() / "git" / "dpi_stdn_agentic" / ".env"
for line in env_path.read_text().splitlines():
    if line.startswith("OPENAI_API_KEY="):
        os.environ["OPENAI_API_KEY"] = line.split("=", 1)[1].strip()
        break

client = OpenAI()
output_dir = Path(__file__).parent.parent / "docs" / "video_audio"
output_dir.mkdir(exist_ok=True)

VOICE = "onyx"
MODEL = "tts-1-hd"

scenes = {
    "00_intro": (
        "Suppose you need to assess the impact of a 40% reduction in Helium production from Qatar. "
        "Where do you start? How many technologies are affected, how concentrated is the market, "
        "and what does the US import picture actually look like? "
        "STDN Explorer is a supply chain analysis dashboard that maps 180 technologies across "
        "microelectronics, biotechnology, and pharmaceuticals down to the raw materials and "
        "countries they depend on. Let's walk through how you'd use it to build a picture of this scenario."
    ),
    "01_material_network": (
        "We start with the Material Network. This view works in the opposite direction from the "
        "rest of the dashboard. Instead of picking a technology and looking at what it needs, "
        "we pick a material and see everything that depends on it. "
        "Selecting Helium, we immediately see 152 technologies across all three domains. "
        "Three rings of subdomains and technologies fan out from the center. "
        "This is not a niche material. It touches nearly everything in the dataset. "
        "Clicking a domain lets you drill into one sector at a time. "
        "But the important takeaway is the number: 152 out of 180 technologies."
    ),
    "02_technology_network": (
        "Now let's look at one of those technologies up close. "
        "Selecting Smartphone loads the four-layer dependency graph. "
        "The technology is at the center, surrounded by its components, the materials those "
        "components need, and the countries that produce them. "
        "Clicking the Helium node, we see it's a process consumable, shown in purple with a dashed edge. "
        "It's used during manufacturing for leak testing but is not in the final product. "
        "The detail panel shows Qatar holding 38.8% of global production. "
        "Notice the navigation buttons here. These let us jump directly to the Concentration or "
        "Overlap views with Helium already selected."
    ),
    "03_concentration": (
        "The Concentration view shows a heatmap of HHI scores, a standard measure of market "
        "concentration. Materials are rows, technologies are columns. Red and orange cells mean "
        "production is controlled by a small number of countries. "
        "Helium's HHI is 4,814, solidly in the high concentration range. "
        "Only six countries produce it at any scale, and the top two, the United States and Qatar, "
        "account for over 95% of global output. "
        "A 40% cut to Qatar's production removes roughly 15.5% of world supply. "
        "In a market this concentrated, there is no spare capacity to absorb that."
    ),
    "04_dominance": (
        "The Dominance view ranks countries by how many materials they lead in. "
        "China and the United States dominate hundreds of materials. "
        "Qatar appears further down with a Low classification. It leads in just one material. "
        "But look at the reach: 173 technologies affected, with an average share of 36.2%. "
        "Qatar's risk profile is narrow but deep. One material, nearly every technology."
    ),
    "05_overlap": (
        "The Overlap view answers a direct question: if Qatar's Helium output drops, "
        "how many technologies feel it at once? "
        "Helium is the third most widely shared material in the dataset, appearing in "
        "152 technologies with an HHI of 4,814. "
        "Switching to Shared Countries, Qatar shows up touching 173 technologies but through "
        "only 10 materials. Compare that to China at the top, which touches 180 technologies "
        "through 920 materials. Qatar's exposure is concentrated in a single commodity."
    ),
    "06_supply_disruption": (
        "The Supply Disruption simulator models what happens if a country stops producing entirely. "
        "Selecting Qatar: zero Critical, 152 High severity technologies, 173 total affected. "
        "Every Helium-dependent technology gets a High rating because Qatar holds 38.8% of production. "
        "Expanding any row shows the specific materials and components at risk."
    ),
    "07_trade_disruption": (
        "The Trade Disruption view uses a different data source: actual US import values from "
        "UN Comtrade. Here the story diverges from the production share picture. "
        "Click the Helium column, and the detail panel shows year-by-year data. "
        "Qatar was the single most disruptive country to remove from 2017 through 2021, "
        "with disruption scores ranging from 29 to 48 percent. "
        "But starting in 2022, Canada replaced Qatar as the top disruption source, "
        "with scores climbing to 100% by 2025. "
        "A Qatar production cut still tightens global supply and prices, but the direct US import "
        "exposure has shifted. "
        "The Substitutability tab confirms Helium's lock-in: only 2 distinct countries have held "
        "the top supplier position across 9 years."
    ),
    "08_analyst": (
        "Finally, the Analyst section pulls everything together. "
        "Selecting the Disruption impact of a material template for Helium generates a structured "
        "report: material overview, top producers, affected technologies, systemic risk assessment, "
        "and recommendations. "
        "Scrolling through, the report flags Helium as a systemic dependency shared across 152 "
        "technologies, and recommends diversifying sourcing, reducing single-country dependency, "
        "and coordinating procurement across the technologies that share this material."
    ),
    "09_gemini": (
        "The Ask Gemini sidebar lets you ask follow-up questions using the full dataset as context. "
        "Asking specifically about the 40% Qatar reduction, Gemini calculates a 15.5% global supply "
        "reduction and flags the systemic risk across all 152 dependent technologies. "
        "It notes that while the United States is the top producer, "
        "the global supply shock would still disrupt the US market through increased prices and scarcity."
    ),
    "10_closing": (
        "In about five minutes, we've gone from 'Qatar produces Helium' to a quantified, "
        "multi-dimensional picture: 152 technologies at risk, an HHI of 4,814, "
        "a shifting US import landscape, and a structured policy report. "
        "The dashboard gives you the numbers. What you do with them is your call."
    ),
}

for name, text in scenes.items():
    out_path = output_dir / f"{name}.mp3"
    print(f"Generating {name} ({len(text.split())} words)...")
    with client.audio.speech.with_streaming_response.create(
        model=MODEL,
        voice=VOICE,
        input=text,
    ) as response:
        response.stream_to_file(str(out_path))
    print(f"  -> {out_path} ({out_path.stat().st_size / 1024:.0f} KB)")

print("\nDone! All audio files in", output_dir)
