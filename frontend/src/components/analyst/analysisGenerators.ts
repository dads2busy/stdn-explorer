import type {
  AnalysisResponse,
  AnalysisSection,
  ConcentrationEntry,
  CountryExposureEntry,
  DisruptionResult,
  OverlapData,
  QueryType,
} from "./types";

function hhiLabel(hhi: number): string {
  if (hhi >= 5000) return "Extreme";
  if (hhi >= 2500) return "High";
  if (hhi >= 1500) return "Medium";
  return "Low";
}

function hhiLevel(hhi: number) {
  if (hhi >= 5000) return "critical" as const;
  if (hhi >= 2500) return "high" as const;
  if (hhi >= 1500) return "moderate" as const;
  return "low" as const;
}

function severityLevel(s: string) {
  if (s === "Critical") return "critical" as const;
  if (s === "High") return "high" as const;
  if (s === "Moderate") return "moderate" as const;
  return "low" as const;
}

// ─── 1. Technology Risk Analysis ────────────────────────────────────────────

function generateTechRisk(
  technology: string,
  concentrationData: { concentration: ConcentrationEntry[] },
): AnalysisResponse {
  const techConc = concentrationData.concentration
    .filter((c) => c.technology === technology)
    .sort((a, b) => b.hhi - a.hhi);

  const extreme = techConc.filter((c) => c.hhi >= 5000);
  const high = techConc.filter((c) => c.hhi >= 2500 && c.hhi < 5000);
  const avgHhi =
    techConc.length > 0
      ? Math.round(techConc.reduce((s, c) => s + c.hhi, 0) / techConc.length)
      : 0;

  const sections: AnalysisSection[] = [];

  // Risk Assessment
  sections.push({
    title: "Risk Assessment",
    level: extreme.length > 0 ? "critical" : high.length > 0 ? "high" : "moderate",
    content: [
      { type: "stat", label: "Total Materials", value: techConc.length },
      { type: "stat", label: "Extreme Concentration", value: extreme.length },
      { type: "stat", label: "High Concentration", value: high.length },
      { type: "stat", label: "Average HHI", value: avgHhi },
      {
        type: "table",
        headers: ["Material", "HHI", "Level", "Top Producer", "Share"],
        rows: techConc.slice(0, 10).map((c) => [
          c.material,
          Math.round(c.hhi),
          hhiLabel(c.hhi),
          c.top_producers[0]?.country ?? "N/A",
          `${(c.top_producers[0]?.share ?? 0).toFixed(1)}%`,
        ]),
      },
    ],
  });

  // Vulnerability Analysis
  const singleSource = techConc.filter((c) => c.num_countries <= 2);
  const highShare = techConc.filter(
    (c) => c.top_producers[0]?.share >= 50,
  );
  sections.push({
    title: "Vulnerability Analysis",
    level:
      singleSource.length > 3
        ? "critical"
        : singleSource.length > 0
          ? "high"
          : "low",
    content: [
      {
        type: "text",
        value: `${singleSource.length} material(s) have 2 or fewer producing countries. ${highShare.length} material(s) have a single country controlling 50%+ of supply.`,
      },
      ...(singleSource.length > 0
        ? [
            {
              type: "bullet" as const,
              items: singleSource.map(
                (c) =>
                  `${c.material}: ${c.num_countries} countries (top: ${c.top_producers[0]?.country} at ${(c.top_producers[0]?.share ?? 0).toFixed(1)}%)`,
              ),
            },
          ]
        : []),
    ],
  });

  // Policy Implications
  const dominantCountries = new Map<string, string[]>();
  techConc.forEach((c) => {
    if (c.top_producers[0]?.share >= 40) {
      const country = c.top_producers[0].country;
      const existing = dominantCountries.get(country) || [];
      existing.push(c.material);
      dominantCountries.set(country, existing);
    }
  });
  sections.push({
    title: "Policy Implications",
    level: "info",
    content: [
      {
        type: "text",
        value:
          "Countries with dominant positions across multiple materials create coupled supply chain risks — a single geopolitical event could affect multiple inputs simultaneously.",
      },
      ...(dominantCountries.size > 0
        ? [
            {
              type: "table" as const,
              headers: ["Country", "# Dominated Materials", "Materials"],
              rows: [...dominantCountries.entries()]
                .sort((a, b) => b[1].length - a[1].length)
                .map(([country, materials]) => [
                  country,
                  materials.length,
                  materials.join(", "),
                ]),
            },
          ]
        : [
            {
              type: "text" as const,
              value: "No single country dominates (>40% share) multiple materials for this technology.",
            },
          ]),
    ],
  });

  // Mitigation Strategies
  sections.push({
    title: "Mitigation Strategies",
    level: "info",
    content: [
      {
        type: "bullet",
        items: [
          extreme.length > 0
            ? `${extreme.length} material(s) at Extreme concentration require immediate diversification attention: ${extreme.map((c) => c.material).join(", ")}.`
            : "No materials at Extreme concentration level.",
          highShare.length > 0
            ? `Consider strategic reserves for materials with single-country dominance: ${highShare.map((c) => c.material).join(", ")}.`
            : "No materials with single-country dominance above 50%.",
          dominantCountries.size > 0
            ? `Monitor geopolitical risks in: ${[...dominantCountries.keys()].join(", ")}.`
            : "No single country dominates multiple material supplies.",
          `${techConc.filter((c) => c.num_countries >= 5).length} material(s) have diversified supply bases (5+ countries), representing lower risk.`,
        ],
      },
    ],
  });

  return {
    title: `Supply Chain Risk Analysis: ${technology}`,
    summary: `${technology} depends on ${techConc.length} materials. ${extreme.length} have extreme concentration risk (HHI \u2265 5000) and ${high.length} have high concentration risk (HHI \u2265 2500). Average HHI: ${avgHhi}.`,
    sections,
  };
}

// ─── 2. Country Disruption Analysis ─────────────────────────────────────────

function generateDisruption(
  country: string,
  disruption: DisruptionResult,
  exposureData: { exposures: CountryExposureEntry[] },
): AnalysisResponse {
  const { affected_technologies: techs, summary } = disruption;
  const exposure = exposureData.exposures.find((e) => e.country === country);

  const sections: AnalysisSection[] = [];

  // Risk Assessment
  sections.push({
    title: "Risk Assessment",
    level: summary.critical_count > 0 ? "critical" : summary.high_count > 0 ? "high" : "moderate",
    content: [
      { type: "stat", label: "Technologies Affected", value: summary.total_technologies_affected },
      { type: "stat", label: "Materials Affected", value: summary.total_materials_affected },
      { type: "stat", label: "Critical Impact", value: summary.critical_count },
      { type: "stat", label: "High Impact", value: summary.high_count },
      ...(exposure
        ? [
            { type: "stat" as const, label: "Materials Dominated", value: exposure.num_dominated },
            { type: "stat" as const, label: "Max Market Share", value: `${exposure.max_share.toFixed(1)}%` },
          ]
        : []),
    ],
  });

  // Vulnerability Analysis
  const critical = techs.filter((t) => t.severity === "Critical");
  const highImpact = techs.filter((t) => t.severity === "High");
  sections.push({
    title: "Vulnerability Analysis",
    level: critical.length > 0 ? "critical" : highImpact.length > 0 ? "high" : "moderate",
    content: [
      {
        type: "table",
        headers: ["Technology", "Severity", "Materials Affected", "Max Share Lost"],
        rows: techs
          .sort((a, b) => {
            const ord = { Critical: 0, High: 1, Moderate: 2, Low: 3 };
            return (ord[a.severity as keyof typeof ord] ?? 4) - (ord[b.severity as keyof typeof ord] ?? 4);
          })
          .map((t) => [
            t.technology,
            t.severity,
            t.num_materials_affected,
            `${t.max_share_lost.toFixed(1)}%`,
          ]),
      },
      ...(critical.length > 0
        ? [
            {
              type: "text" as const,
              value: `Critical technologies: ${critical.map((t) => t.technology).join(", ")}. These would face severe supply disruption due to high dependency on ${country}.`,
            },
          ]
        : []),
    ],
  });

  // Policy Implications
  const topProducerMaterials = techs.flatMap((t) =>
    t.materials.filter((m) => m.is_top_producer).map((m) => m.material),
  );
  const uniqueTopMaterials = [...new Set(topProducerMaterials)];
  sections.push({
    title: "Policy Implications",
    level: "info",
    content: [
      {
        type: "text",
        value: `${country} is the top global producer of ${uniqueTopMaterials.length} material(s) used across the analyzed technologies.`,
      },
      ...(uniqueTopMaterials.length > 0
        ? [{ type: "bullet" as const, items: uniqueTopMaterials.map((m) => `${m} — ${country} is the top global producer`) }]
        : []),
      ...(exposure && exposure.dominated_materials.length > 0
        ? [
            {
              type: "text" as const,
              value: `Dominated materials (${country} is #1 producer): ${exposure.dominated_materials.map((m) => m.material).join(", ")}.`,
            },
          ]
        : []),
    ],
  });

  // Mitigation Strategies
  sections.push({
    title: "Mitigation Strategies",
    level: "info",
    content: [
      {
        type: "bullet",
        items: [
          critical.length > 0
            ? `Prioritize supply diversification for technologies with Critical severity: ${critical.map((t) => t.technology).join(", ")}.`
            : "No technologies at Critical severity level.",
          uniqueTopMaterials.length > 0
            ? `Develop alternative sources or substitutes for ${country}-dominated materials: ${uniqueTopMaterials.join(", ")}.`
            : `${country} is not the top producer of any affected materials.`,
          `Consider strategic stockpiling for materials where ${country} controls >50% of global supply.`,
          `Assess bilateral trade agreements and export restriction risks with ${country}.`,
        ],
      },
    ],
  });

  return {
    title: `Disruption Impact Analysis: ${country}`,
    summary: `A supply disruption from ${country} would affect ${summary.total_technologies_affected} technologies and ${summary.total_materials_affected} materials. ${summary.critical_count} critical and ${summary.high_count} high-severity impacts identified.`,
    sections,
  };
}

// ─── 3. Concentration Risk Analysis ─────────────────────────────────────────

function generateConcentrationRisk(
  concentrationData: { concentration: ConcentrationEntry[] },
  overlapData: OverlapData,
): AnalysisResponse {
  const conc = [...concentrationData.concentration].sort((a, b) => b.hhi - a.hhi);
  const extreme = conc.filter((c) => c.hhi >= 5000);
  const high = conc.filter((c) => c.hhi >= 2500 && c.hhi < 5000);

  // Unique materials at extreme/high
  const extremeMaterials = [...new Set(extreme.map((c) => c.material))];
  const highMaterials = [...new Set(high.map((c) => c.material))];

  const sections: AnalysisSection[] = [];

  // Risk Assessment
  sections.push({
    title: "Risk Assessment",
    level: extreme.length > 0 ? "critical" : "high",
    content: [
      { type: "stat", label: "Total Tech-Material Pairs", value: conc.length },
      { type: "stat", label: "Extreme (HHI \u2265 5000)", value: extreme.length },
      { type: "stat", label: "High (HHI \u2265 2500)", value: high.length },
      { type: "stat", label: "Unique Extreme Materials", value: extremeMaterials.length },
      {
        type: "table",
        headers: ["Material", "Technology", "HHI", "Top Producer", "Share"],
        rows: conc.slice(0, 15).map((c) => [
          c.material,
          c.technology,
          Math.round(c.hhi),
          c.top_producers[0]?.country ?? "N/A",
          `${(c.top_producers[0]?.share ?? 0).toFixed(1)}%`,
        ]),
      },
    ],
  });

  // Vulnerability Analysis — systemic materials (shared across techs)
  const systemicMaterials = overlapData.material_overlap
    .filter((m) => m.hhi >= 2500)
    .sort((a, b) => b.num_technologies - a.num_technologies);
  sections.push({
    title: "Vulnerability Analysis — Systemic Chokepoints",
    level: systemicMaterials.length > 3 ? "critical" : systemicMaterials.length > 0 ? "high" : "moderate",
    content: [
      {
        type: "text",
        value: `${systemicMaterials.length} material(s) are both highly concentrated (HHI \u2265 2500) and shared across multiple technologies, making them systemic chokepoints.`,
      },
      ...(systemicMaterials.length > 0
        ? [
            {
              type: "table" as const,
              headers: ["Material", "# Technologies", "HHI", "Top Producer", "Technologies"],
              rows: systemicMaterials.slice(0, 10).map((m) => [
                m.material,
                m.num_technologies,
                Math.round(m.hhi),
                m.top_producers[0]?.country ?? "N/A",
                m.technologies.join(", "),
              ]),
            },
          ]
        : []),
    ],
  });

  // Policy Implications
  const countryRisk = new Map<string, number>();
  extreme.forEach((c) => {
    const country = c.top_producers[0]?.country;
    if (country) countryRisk.set(country, (countryRisk.get(country) || 0) + 1);
  });
  sections.push({
    title: "Policy Implications",
    level: "info",
    content: [
      {
        type: "text",
        value: "Countries controlling extreme-concentration materials represent the highest geopolitical supply chain risk.",
      },
      ...(countryRisk.size > 0
        ? [
            {
              type: "table" as const,
              headers: ["Country", "# Extreme-Concentration Entries"],
              rows: [...countryRisk.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([c, n]) => [c, n]),
            },
          ]
        : []),
    ],
  });

  // Mitigation
  sections.push({
    title: "Mitigation Strategies",
    level: "info",
    content: [
      {
        type: "bullet",
        items: [
          `${extremeMaterials.length} unique materials at Extreme concentration: ${extremeMaterials.slice(0, 5).join(", ")}${extremeMaterials.length > 5 ? "..." : ""}.`,
          systemicMaterials.length > 0
            ? `Systemic chokepoint materials (high concentration + multi-tech) need highest priority: ${systemicMaterials.slice(0, 3).map((m) => m.material).join(", ")}.`
            : "No systemic chokepoint materials identified.",
          `${highMaterials.length} unique materials at High concentration level warrant monitoring.`,
          "Strategic reserves and substitution R&D should target materials with both extreme HHI and limited producing countries.",
        ],
      },
    ],
  });

  return {
    title: "Cross-Technology Concentration Risk Analysis",
    summary: `Across all technologies, ${extreme.length} tech-material pairs show extreme concentration (HHI \u2265 5000) and ${high.length} show high concentration. ${systemicMaterials.length} material(s) are systemic chokepoints.`,
    sections,
  };
}

// ─── 4. Country Dominance Analysis ──────────────────────────────────────────

function generateCountryDominance(
  country: string,
  exposureData: { exposures: CountryExposureEntry[] },
  disruption: DisruptionResult,
): AnalysisResponse {
  const exposure = exposureData.exposures.find((e) => e.country === country);
  const { affected_technologies: techs, summary } = disruption;

  const sections: AnalysisSection[] = [];

  const numDominated = exposure?.num_dominated ?? 0;
  const dominanceLevel =
    numDominated >= 10 ? "critical" : numDominated >= 5 ? "high" : numDominated >= 2 ? "moderate" : "low";

  // Risk Assessment
  sections.push({
    title: "Risk Assessment",
    level: dominanceLevel,
    content: [
      { type: "stat", label: "Materials Dominated (#1 Producer)", value: numDominated },
      { type: "stat", label: "Technologies Supplied", value: exposure?.num_technologies ?? 0 },
      { type: "stat", label: "Total Materials Supplied", value: exposure?.num_materials ?? 0 },
      { type: "stat", label: "Average Market Share", value: `${(exposure?.avg_share ?? 0).toFixed(1)}%` },
      { type: "stat", label: "Max Market Share", value: `${(exposure?.max_share ?? 0).toFixed(1)}%` },
      ...(exposure && exposure.top_materials.length > 0
        ? [
            {
              type: "table" as const,
              headers: ["Material", "Market Share"],
              rows: exposure.top_materials
                .sort((a, b) => b.share - a.share)
                .slice(0, 10)
                .map((m) => [m.material, `${m.share.toFixed(1)}%`]),
            },
          ]
        : []),
    ],
  });

  // Vulnerability Analysis — which technologies depend on this country
  sections.push({
    title: "Vulnerability Analysis",
    level: summary.critical_count > 0 ? "critical" : summary.high_count > 0 ? "high" : "moderate",
    content: [
      {
        type: "text",
        value: `If ${country}'s supply were disrupted, ${summary.total_technologies_affected} technologies would be affected.`,
      },
      {
        type: "table",
        headers: ["Technology", "Severity", "Materials Affected", "Max Share Lost"],
        rows: techs
          .sort((a, b) => b.max_share_lost - a.max_share_lost)
          .map((t) => [
            t.technology,
            t.severity,
            t.num_materials_affected,
            `${t.max_share_lost.toFixed(1)}%`,
          ]),
      },
    ],
  });

  // Policy Implications
  sections.push({
    title: "Policy Implications",
    level: "info",
    content: [
      {
        type: "text",
        value:
          numDominated > 5
            ? `${country} holds dominant positions across ${numDominated} materials, creating systemic concentration risk. Any trade restrictions, export controls, or geopolitical disruptions could cascade across multiple technology supply chains.`
            : numDominated > 0
              ? `${country} dominates ${numDominated} material(s). While less systemic than countries with broader dominance, targeted materials may be critical.`
              : `${country} does not dominate (as #1 producer) any materials, but contributes to supply chains for ${exposure?.num_materials ?? 0} materials.`,
      },
      ...(exposure && exposure.dominated_materials.length > 0
        ? [
            {
              type: "bullet" as const,
              items: exposure.dominated_materials.map((m) => `${m.material} — #1 global producer`),
            },
          ]
        : []),
    ],
  });

  // Mitigation
  sections.push({
    title: "Mitigation Strategies",
    level: "info",
    content: [
      {
        type: "bullet",
        items: [
          numDominated > 5
            ? `High priority: diversify supply for ${numDominated} dominated materials.`
            : "Monitor for changes in market share that could increase dominance.",
          summary.critical_count > 0
            ? `${summary.critical_count} technology(ies) face Critical disruption severity — requires strategic stockpiling and alternative sourcing.`
            : "No technologies face Critical-level disruption risk from this country.",
          `Track export policies and trade agreements with ${country}.`,
          `Invest in substitution research for materials where ${country} controls >50% of supply.`,
        ],
      },
    ],
  });

  return {
    title: `Country Dominance Assessment: ${country}`,
    summary: `${country} is the #1 global producer of ${numDominated} material(s), supplies ${exposure?.num_materials ?? 0} materials across ${exposure?.num_technologies ?? 0} technologies, with an average market share of ${(exposure?.avg_share ?? 0).toFixed(1)}%.`,
    sections,
  };
}

// ─── 5. Shared Materials Analysis ───────────────────────────────────────────

function generateSharedMaterials(
  overlapData: OverlapData,
  concentrationData: { concentration: ConcentrationEntry[] },
): AnalysisResponse {
  const { material_overlap, country_overlap } = overlapData;
  const sorted = [...material_overlap].sort(
    (a, b) => b.num_technologies - a.num_technologies,
  );

  const sections: AnalysisSection[] = [];

  // Risk Assessment — shared materials
  const highRiskShared = sorted.filter((m) => m.hhi >= 2500);
  sections.push({
    title: "Risk Assessment — Shared Materials",
    level: highRiskShared.length > 3 ? "critical" : highRiskShared.length > 0 ? "high" : "moderate",
    content: [
      { type: "stat", label: "Materials Shared (2+ techs)", value: sorted.length },
      { type: "stat", label: "High/Extreme Concentration", value: highRiskShared.length },
      {
        type: "table",
        headers: ["Material", "# Technologies", "HHI", "Level", "Top Producer"],
        rows: sorted.slice(0, 12).map((m) => [
          m.material,
          m.num_technologies,
          Math.round(m.hhi),
          hhiLabel(m.hhi),
          m.top_producers[0]?.country ?? "N/A",
        ]),
      },
    ],
  });

  // Vulnerability Analysis — shared countries
  const topCountries = [...country_overlap]
    .sort((a, b) => b.num_technologies - a.num_technologies)
    .slice(0, 10);
  sections.push({
    title: "Vulnerability Analysis — Shared Country Dependencies",
    level: "info",
    content: [
      {
        type: "text",
        value: `${country_overlap.length} countries supply materials to multiple technologies. Countries appearing across many technologies amplify disruption risk.`,
      },
      {
        type: "table",
        headers: ["Country", "# Technologies", "# Materials", "Avg Share"],
        rows: topCountries.map((c) => [
          c.country,
          c.num_technologies,
          c.num_materials,
          `${c.avg_share.toFixed(1)}%`,
        ]),
      },
    ],
  });

  // Policy Implications
  const systemicRisk = sorted.filter(
    (m) => m.num_technologies >= 3 && m.hhi >= 2500,
  );
  sections.push({
    title: "Policy Implications",
    level: "info",
    content: [
      {
        type: "text",
        value:
          systemicRisk.length > 0
            ? `${systemicRisk.length} material(s) are shared across 3+ technologies AND have high concentration — these represent the highest systemic risk.`
            : "No materials combine high cross-technology sharing with high concentration.",
      },
      ...(systemicRisk.length > 0
        ? [
            {
              type: "bullet" as const,
              items: systemicRisk.map(
                (m) =>
                  `${m.material}: shared by ${m.num_technologies} technologies, HHI ${Math.round(m.hhi)} (${hhiLabel(m.hhi)}), top producer: ${m.top_producers[0]?.country ?? "N/A"} (${(m.top_producers[0]?.share ?? 0).toFixed(1)}%)`,
              ),
            },
          ]
        : []),
    ],
  });

  // Mitigation
  sections.push({
    title: "Mitigation Strategies",
    level: "info",
    content: [
      {
        type: "bullet",
        items: [
          systemicRisk.length > 0
            ? `Highest priority: diversify supply for systemic materials: ${systemicRisk.map((m) => m.material).join(", ")}.`
            : "No materials require urgent systemic-risk mitigation.",
          `${sorted.filter((m) => m.num_technologies >= 4).length} material(s) are shared across 4+ technologies — substitution research has high leverage here.`,
          topCountries.length > 0
            ? `Countries with broadest supply chain footprint: ${topCountries.slice(0, 3).map((c) => c.country).join(", ")} — monitor for geopolitical risks.`
            : "",
          "Cross-technology coordination on material sourcing can reduce duplicated procurement risk.",
        ].filter(Boolean),
      },
    ],
  });

  return {
    title: "Cross-Technology Shared Materials Analysis",
    summary: `${sorted.length} materials are shared across 2 or more technologies. ${highRiskShared.length} of these also have high concentration risk (HHI \u2265 2500), creating systemic chokepoints.`,
    sections,
  };
}

// ─── Router ─────────────────────────────────────────────────────────────────

export function routeToGenerator(
  queryType: QueryType,
  params: { technology?: string; country?: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responses: any[],
): AnalysisResponse {
  switch (queryType) {
    case "tech-risk":
      return generateTechRisk(params.technology!, responses[0]);
    case "country-disruption":
      return generateDisruption(params.country!, responses[0], responses[1]);
    case "concentration-risk":
      return generateConcentrationRisk(responses[0], responses[1]);
    case "country-dominance":
      return generateCountryDominance(params.country!, responses[0], responses[1]);
    case "shared-materials":
      return generateSharedMaterials(responses[0], responses[1]);
  }
}
