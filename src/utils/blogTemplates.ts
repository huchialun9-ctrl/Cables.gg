import type { BlogDigest, CableEntry, SourceSector } from "../types/cables";

export function getEntrySector(entry: Pick<CableEntry, "sourceSector" | "sourceName" | "url">): SourceSector {
  if (entry.sourceSector === "official" || entry.sourceSector === "community") {
    return entry.sourceSector;
  }
  const hay = `${entry.sourceName} ${entry.url}`.toLowerCase();
  if (
    /(\.gov\b|\.gov\.|twcert\.org\.tw|ncdr\.nat\.gov\.tw|cisa\.gov|nist\.gov|sec\.gov|ncsc\.gov\.uk|cert\.europa\.eu|jpcert\.or\.jp|europa\.eu)/.test(
      hay
    )
  ) {
    return "official";
  }
  return "community";
}

export function getCondensedDigest(entry: CableEntry): BlogDigest {
  if (entry.blogDigest) {
    return entry.blogDigest;
  }
  const sector = getEntrySector(entry);
  const sectorLabel = sector === "official" ? "官方機構" : "民間社群";
  const riskLabel =
    entry.riskLevel === "high" ? "頭條焦點" : entry.riskLevel === "medium" ? "重點報導" : "一般快訊";
  const markers = Array.from(
    new Set([sectorLabel, entry.countryName, entry.category, riskLabel, ...entry.tags.slice(0, 3)])
  ).slice(0, 6);
  const keyPoints =
    entry.keyChanges && entry.keyChanges.length > 0 ? entry.keyChanges.slice(0, 4) : [entry.aiSummary];
  const takeAway =
    entry.migrationSteps && entry.migrationSteps.length > 0
      ? entry.migrationSteps[0]
      : `建議追蹤 ${entry.sourceName} 報導與相關跨國動態。`;

  const markdown = [
    `---`,
    `title: "${entry.title.replace(/"/g, '\\"')}"`,
    `date: "${entry.publishedAt}"`,
    `country: "${entry.countryName} (${entry.countryCode})"`,
    `sector: "${sectorLabel}"`,
    `category: "${entry.category}"`,
    `priority: "${riskLabel}"`,
    `markers: [${markers.map((m) => `"${m}"`).join(", ")}]`,
    `source_url: "${entry.url}"`,
    `---`,
    ``,
    `# ${entry.title}`,
    ``,
    `> **標記摘要**：${markers.map((m) => `\`${m}\``).join(" · ")}`,
    ``,
    `## 核心重點整理（非全文轉載）`,
    ``,
    entry.aiSummary,
    ``,
    `## 關鍵標記條列`,
    ...keyPoints.map((pt, idx) => `${idx + 1}. ${pt}`),
    ``,
    `## 影響範圍與建議行動`,
    `- **受影響對象**：${entry.impactScope}`,
    `- **建議下一步**：${takeAway}`,
    ``,
    `[檢視原始公開來源 (${entry.sourceName})](${entry.url})`,
  ].join("\n");

  return {
    headline: entry.title,
    lead: entry.aiSummary,
    keyPoints,
    markers,
    takeAway,
    markdown,
    generatedAt: entry.publishedAt,
  };
}

export function formatHtmlEmbedCard(entry: CableEntry, origin: string): string {
  const digest = getCondensedDigest(entry);
  const sector = getEntrySector(entry) === "official" ? "官方機構" : "民間社群";
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<article style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;border:1px solid #E9E9E7;border-radius:6px;padding:20px;background:#FFFFFF;color:#37352F;">
  <div style="font-size:12px;color:#787774;margin-bottom:8px;">${esc(entry.countryName)} · ${esc(sector)} · ${esc(entry.category)} · ${esc(digest.markers.join(" / "))}</div>
  <h2 style="font-size:20px;line-height:1.35;margin:0 0 10px 0;">${esc(digest.headline)}</h2>
  <p style="font-size:14px;line-height:1.6;color:#5A5852;margin:0 0 14px 0;">${esc(digest.lead)}</p>
  <ul style="margin:0 0 14px 0;padding-left:18px;font-size:13px;line-height:1.6;">
    ${digest.keyPoints.map((pt) => `<li>${esc(pt)}</li>`).join("\n    ")}
  </ul>
  <div style="font-size:12px;padding:10px 12px;background:#F7F6F3;border-radius:4px;margin-bottom:12px;">
    <strong>行動建議：</strong>${esc(digest.takeAway)}
  </div>
  <div style="font-size:12px;color:#787774;">
    <a href="${esc(origin)}/blog/${esc(entry.id)}" style="color:#37352F;font-weight:600;text-decoration:none;">閱讀 Blog 重點版</a> ·
    <a href="${esc(entry.url)}" style="color:#787774;text-decoration:underline;">前往原始來源 (${esc(entry.sourceName)})</a>
  </div>
</article>`;
}

export function formatN8nWebhookJson(entry: CableEntry, origin: string): string {
  const digest = getCondensedDigest(entry);
  const sector = getEntrySector(entry);
  return JSON.stringify(
    {
      source: "Cables.gg",
      event: "cables.intelligence.dispatch",
      templateFormat: "blog_markdown",
      rssBlogFeedUrl: `${origin}/rss/blog.xml`,
      item: {
        id: entry.id,
        title: digest.headline,
        countryCode: entry.countryCode,
        countryName: entry.countryName,
        sourceSector: sector,
        category: entry.category,
        riskLevel: entry.riskLevel,
        sourceName: entry.sourceName,
        sourceUrl: entry.url,
        blogUrl: `${origin}/blog/${entry.id}`,
        markers: digest.markers,
        lead: digest.lead,
        keyPoints: digest.keyPoints,
        takeAway: digest.takeAway,
        markdown: digest.markdown,
      },
    },
    null,
    2
  );
}

export function formatNewsletterSnippet(entry: CableEntry, origin: string): string {
  const digest = getCondensedDigest(entry);
  const sector = getEntrySector(entry) === "official" ? "官方機構" : "民間社群";
  return [
    `【${entry.countryName} · ${sector} · ${entry.category}】${digest.headline}`,
    `標記：${digest.markers.join(" / ")}`,
    ``,
    digest.lead,
    ``,
    `後端重點整理：`,
    ...digest.keyPoints.map((pt, i) => `${i + 1}. ${pt}`),
    ``,
    `建議行動：${digest.takeAway}`,
    `Blog 專頁：${origin}/blog/${entry.id}`,
    `原始出處：${entry.url}`,
  ].join("\n");
}
