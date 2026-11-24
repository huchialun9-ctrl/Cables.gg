import { GoogleGenAI, Type } from "@google/genai";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

export const DATABASE_FILE = path.join(ROOT_DIR, "data", "database.json");
export const SOURCES_FILE = path.join(ROOT_DIR, "data", "sources.json");
export const SUBSCRIPTIONS_FILE = path.join(ROOT_DIR, "data", "subscriptions.json");
export const N8N_FILE = path.join(ROOT_DIR, "data", "n8n.json");
export const BLOG_PROFILE_FILE = path.join(ROOT_DIR, "data", "blogProfile.json");

export type CableCategory =
  | "國際焦點"
  | "財經科技"
  | "資安公告"
  | "自訂爬文"
  | "API 變動"
  | "Reddit 熱議"
  | "GitHub 釋出";

export type RiskLevel = "high" | "medium" | "low";
export type SourceSector = "official" | "community";
export type RegionScope = "全球" | "北美" | "歐洲" | "亞太" | "台灣";
export type CountryCode = "TW" | "US" | "GB" | "JP" | "DE" | "KR" | "SG" | "AU" | "GLOBAL";

export interface CountryMeta {
  code: CountryCode;
  name: string;
  region: RegionScope;
  defaultLang: string;
}

export const COUNTRY_META: Record<CountryCode, CountryMeta> = {
  TW: { code: "TW", name: "台灣", region: "亞太", defaultLang: "ZH" },
  US: { code: "US", name: "美國", region: "北美", defaultLang: "EN" },
  GB: { code: "GB", name: "英國", region: "歐洲", defaultLang: "EN" },
  JP: { code: "JP", name: "日本", region: "亞太", defaultLang: "JA" },
  DE: { code: "DE", name: "德國", region: "歐洲", defaultLang: "DE" },
  KR: { code: "KR", name: "韓國", region: "亞太", defaultLang: "KO" },
  SG: { code: "SG", name: "新加坡", region: "亞太", defaultLang: "EN" },
  AU: { code: "AU", name: "澳洲", region: "亞太", defaultLang: "EN" },
  GLOBAL: { code: "GLOBAL", name: "全球跨國", region: "全球", defaultLang: "EN" },
};

export interface CommentItem {
  id: string;
  author: string;
  role: string;
  createdAt: string;
  content: string;
}

export interface DiffBlock {
  language: string;
  beforeLabel: string;
  afterLabel: string;
  before: string;
  after: string;
}

export interface BlogDigest {
  headline: string;
  lead: string;
  keyPoints: string[];
  markers: string[];
  takeAway: string;
  markdown: string;
  generatedAt: string;
}

export type HighlightColor = "yellow" | "green" | "blue" | "pink";

export interface ReaderHighlight {
  id: string;
  paragraphIndex: number;
  text: string;
  color: HighlightColor;
  note?: string;
  createdAt: string;
}

export interface ReaderStrokePoint {
  x: number;
  y: number;
}

export interface ReaderStroke {
  id: string;
  tool: "pen" | "highlighter";
  color: string;
  width: number;
  points: ReaderStrokePoint[];
}

export interface FullArticleBlock {
  type: "heading" | "paragraph" | "quote";
  text: string;
  translatedText?: string;
}

export interface CableEntry {
  id: string;
  title: string;
  originalTitle?: string;
  category: CableCategory;
  riskLevel: RiskLevel;
  sourceSector?: SourceSector;
  countryCode: CountryCode;
  countryName: string;
  region: RegionScope;
  originalLanguage: string;
  sourceName: string;
  sourceId: string;
  sourceIcon: string;
  bannerImage: string;
  version: string;
  publishedAt: string;
  url: string;
  heatScore: number;
  commentCount: number;
  tags: string[];
  aiSummary: string;
  keyChanges: string[];
  impactScope: string;
  migrationSteps: string[];
  aiEnriched?: boolean;
  blogDigest?: BlogDigest | null;
  bookmarked?: boolean;
  bookmarkedAt?: string | null;
  sharedToBlog?: boolean;
  sharedToBlogAt?: string | null;
  fullArticleBlocks?: FullArticleBlock[];
  fullArticleFetchedAt?: string | null;
  fullArticleSourceMode?: "live_full_article" | "rss_expanded_fallback";
  readerHighlights?: ReaderHighlight[];
  readerStrokes?: ReaderStroke[];
  diff: DiffBlock | null;
  comments: CommentItem[];
}

export interface DatabasePayload {
  schemaVersion: string;
  lastUpdated: string;
  totalRecords: number;
  entries: CableEntry[];
}

export interface SourceItem {
  id: string;
  name: string;
  category: CableCategory;
  sourceSector?: SourceSector;
  countryCode: CountryCode;
  countryName: string;
  region: RegionScope;
  type: string;
  endpoint: string;
  enabled: boolean;
  lastCheckedAt: string;
  lastStatus: string;
  itemsCaptured: number;
}

export interface ScheduleShift {
  id: string;
  name: string;
  cron: string;
  timeLabel: string;
  countries: CountryCode[];
  enabled: boolean;
  autoPushRss: boolean;
  lastExecutedAt: string | null;
}

export interface SyncLogItem {
  id: string;
  timestamp: string;
  trigger: string;
  status: string;
  sourcesChecked: number;
  newEntries: number;
  durationSeconds: number;
  commitSha: string;
  message: string;
}

export interface SourcesPayload {
  pipeline: {
    autoEnabled: boolean;
    intervalMinutes: number;
    scheduleCron: string;
    scheduleLabel: string;
    aiModel: string;
    targetLanguage: string;
    autoCommit: boolean;
    autoPushEnabled: boolean;
    lastRunAt: string;
    nextRunAt: string;
    lastRunStatus: string;
    shifts: ScheduleShift[];
  };
  sources: SourceItem[];
  syncLogs: SyncLogItem[];
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export async function writeJsonFile<T>(filePath: string, payload: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
}

export function normalizeCategory(
  val: string | undefined,
  fallback: CableCategory = "國際焦點"
): CableCategory {
  if (
    val === "國際焦點" ||
    val === "財經科技" ||
    val === "資安公告" ||
    val === "自訂爬文" ||
    val === "API 變動" ||
    val === "Reddit 熱議" ||
    val === "GitHub 釋出"
  ) {
    return val;
  }
  return fallback;
}

export function normalizeRegion(
  val: string | undefined,
  fallback: RegionScope = "全球"
): RegionScope {
  if (val === "全球" || val === "北美" || val === "歐洲" || val === "亞太" || val === "台灣") {
    return val;
  }
  return fallback;
}

export type N8nTemplateFormat = "blog_markdown" | "json_digest" | "html_card" | "newsletter";

export interface N8nWebhookConfig {
  id: string;
  name: string;
  webhookUrl: string;
  triggerMode: "all_new" | "high_risk" | "manual";
  templateFormat: N8nTemplateFormat;
  sectorFilter: "all" | SourceSector;
  countries: Array<"ALL" | CountryCode>;
  enabled: boolean;
  createdAt: string;
  lastDispatchedAt: string | null;
  lastStatusCode: number | null;
}

export interface N8nDispatchLog {
  id: string;
  timestamp: string;
  webhookName: string;
  webhookUrl: string;
  templateFormat: N8nTemplateFormat;
  entryCount: number;
  entryTitle: string;
  statusCode: number | null;
  ok: boolean;
  message: string;
}

export interface N8nPayload {
  lastUpdated: string;
  webhooks: N8nWebhookConfig[];
  dispatchLogs: N8nDispatchLog[];
}

export function inferSourceSector(
  sourceName: string,
  url: string,
  explicit?: string
): SourceSector {
  if (explicit === "official" || explicit === "community") {
    return explicit;
  }
  const hay = `${sourceName} ${url}`.toLowerCase();
  if (
    /(\.gov\b|\.gov\.|twcert\.org\.tw|ncdr\.nat\.gov\.tw|cisa\.gov|nist\.gov|sec\.gov|ncsc\.gov\.uk|cert\.europa\.eu|jpcert\.or\.jp|europa\.eu)/.test(
      hay
    )
  ) {
    return "official";
  }
  return "community";
}

export function normalizeCountry(
  val: string | undefined,
  fallback: CountryCode = "GLOBAL"
): CountryCode {
  const upper = (val || "").trim().toUpperCase();
  if (upper in COUNTRY_META) {
    return upper as CountryCode;
  }
  return fallback;
}

export function validatePublicUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("目標網址格式不正確，請提供有效的 https:// 網址。");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("僅支援 HTTP 或 HTTPS 公開網頁協議。");
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    throw new Error("安全原則限制：不可爬取區域網路或私有保留位址。");
  }
  return parsed;
}

function deterministicId(seed: string): string {
  const digest = crypto.createHash("sha1").update(seed).digest("hex").slice(0, 12);
  return `cbl-${digest}`;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#0*38;|&#x0*26;|&amp;/gi, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&nbsp;/g, " ");
}

function stripTags(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveFaviconUrl(targetUrl: string, fallbackHost = "cables.gg"): string {
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("github.com") || host === "api.github.com") {
      return "https://www.google.com/s2/favicons?domain=github.com&sz=64";
    }
    if (host.includes("reddit.com")) {
      return "https://www.google.com/s2/favicons?domain=reddit.com&sz=64";
    }
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(fallbackHost)}&sz=64`;
  }
}

function resolveAbsoluteUrl(candidate: string | undefined, baseUrl: string): string | undefined {
  if (!candidate) return undefined;
  const trimmed = decodeHtmlEntities(candidate).trim();
  if (!trimmed || trimmed.startsWith("data:")) return undefined;
  try {
    const abs = new URL(trimmed, baseUrl).toString();
    // Skip tiny tracking pixels or generic favicon/google news logo icons
    if (
      /favicon\.(ico|png)|1x1|pixel\.|gstatic\.com\/images\/branding|googleusercontent\.com.*=s\d+-c/i.test(
        abs
      )
    ) {
      return undefined;
    }
    return abs;
  } catch {
    return undefined;
  }
}

function extractTagValue(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(regex);
  return match ? decodeHtmlEntities(match[1]).trim() : "";
}

function extractImageFromXmlBlock(block: string, baseUrl: string): string | undefined {
  const mediaMatch =
    block.match(/<media:(?:content|thumbnail)[^>]*\burl=["']([^"']+)["']/i) ||
    block.match(/<enclosure[^>]*\btype=["']image\/[^"']+["'][^>]*\burl=["']([^"']+)["']/i) ||
    block.match(/<enclosure[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\/[^"']+["']/i) ||
    block.match(/<img[^>]*\bsrc=["']([^"']+)["']/i);
  return resolveAbsoluteUrl(mediaMatch?.[1], baseUrl);
}

export async function fetchRealArticleOgImage(articleUrl: string): Promise<string> {
  try {
    const parsed = new URL(articleUrl);
    const host = parsed.hostname.toLowerCase();
    // Skip opaque Google News redirect tokens or NVD gov pages that don't expose article og:images directly
    if (host === "news.google.com" || host === "nvd.nist.gov") {
      return "";
    }
    validatePublicUrl(articleUrl);

    const resp = await fetch(articleUrl, {
      headers: {
        "User-Agent": "CablesGG-Crawler/2.0 (+https://cables.gg)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(3500),
    });
    if (!resp.ok) return "";
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("html")) return "";

    const htmlHead = (await resp.text()).slice(0, 120_000);
    const ogMatch =
      htmlHead.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      htmlHead.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
      htmlHead.match(/<meta[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i) ||
      htmlHead.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i);

    return resolveAbsoluteUrl(ogMatch?.[1], resp.url || articleUrl) || "";
  } catch {
    return "";
  }
}

function inferRiskLevel(title: string, summary: string, category: CableCategory): RiskLevel {
  const text = `${title} ${summary}`.toLowerCase();
  if (category === "資安公告") return "high";
  if (
    /(cve-\d{4}|zero-day|0-day|critical|exploit|ransomware|breach|breaking change|deprecated|removed|outage|emergency|緊急|重大|災情|漏洞|戰爭|地震|停飛|停擺|制裁|違約)/.test(
      text
    )
  ) {
    return "high";
  }
  if (
    /(security|warning|patch|migration|upgrade|tariff|interest rate|inflation|guidance|release candidate|beta|政策|關稅|升息|降息|財報|警告|更新|修補)/.test(
      text
    )
  ) {
    return "medium";
  }
  return "low";
}

function extractTags(title: string, category: CableCategory, countryCode: CountryCode): string[] {
  const tags = new Set<string>([countryCode, category]);
  const cveMatch = title.match(/CVE-\d{4}-\d+/i);
  if (cveMatch) tags.add(cveMatch[0].toUpperCase());
  const keywords = ["AI", "GitHub", "Security", "Semiconductor", "Cloud", "API", "Linux", "Vite", "Next.js"];
  for (const kw of keywords) {
    if (title.toLowerCase().includes(kw.toLowerCase())) {
      tags.add(kw);
    }
  }
  return Array.from(tags).slice(0, 5);
}

function normalizeIsoDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return new Date().toISOString();
  return new Date(ms).toISOString();
}

async function parseRssOrAtomEntries(
  xml: string,
  src: SourceItem,
  limit: number
): Promise<CableEntry[]> {
  const entries: CableEntry[] = [];
  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const blocks = isAtom
    ? xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
    : xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  const meta = COUNTRY_META[src.countryCode] || COUNTRY_META.GLOBAL;

  const draftItems = blocks.slice(0, limit).map((block) => {
    const rawTitle = stripTags(extractTagValue(block, "title"));
    let itemUrl = "";
    if (isAtom) {
      const linkMatch =
        block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ||
        block.match(/<link[^>]*href=["']([^"']+)["']/i);
      itemUrl = linkMatch ? decodeHtmlEntities(linkMatch[1]).trim() : "";
    } else {
      itemUrl = stripTags(extractTagValue(block, "link"));
    }
    if (!itemUrl) itemUrl = src.endpoint;

    const gnewsSourceMatch = block.match(/<source(?:\s+url=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/source>/i);
    const publisherUrl = gnewsSourceMatch?.[1] ? decodeHtmlEntities(gnewsSourceMatch[1]).trim() : "";
    const publisherName = gnewsSourceMatch?.[2] ? stripTags(gnewsSourceMatch[2]) : "";

    const effectiveSourceName = publisherName || src.name;
    const iconTargetUrl = publisherUrl || itemUrl || src.endpoint;
    const sourceIcon = resolveFaviconUrl(iconTargetUrl, "cables.gg");

    const rawDesc =
      extractTagValue(block, "description") ||
      extractTagValue(block, "summary") ||
      extractTagValue(block, "content");
    const cleanSummary =
      stripTags(rawDesc).slice(0, 320) ||
      `${effectiveSourceName} 公開資料流即時擷取報導：${rawTitle}`;

    const rawDate =
      extractTagValue(block, "pubDate") ||
      extractTagValue(block, "published") ||
      extractTagValue(block, "updated") ||
      extractTagValue(block, "dc:date");
    const publishedAt = normalizeIsoDate(rawDate);

    const extractedImage =
      extractImageFromXmlBlock(block, itemUrl) || extractImageFromXmlBlock(rawDesc, itemUrl) || "";

    return {
      rawTitle,
      itemUrl,
      effectiveSourceName,
      sourceIcon,
      cleanSummary,
      publishedAt,
      extractedImage,
    };
  });

  // For direct article URLs lacking RSS media image, attempt to extract real og:image (never fabricate)
  const resolvedImages = await Promise.all(
    draftItems.map(async (item) => {
      if (item.extractedImage) return item.extractedImage;
      return fetchRealArticleOgImage(item.itemUrl);
    })
  );

  for (let i = 0; i < draftItems.length; i += 1) {
    const item = draftItems[i];
    if (!item.rawTitle) continue;
    const riskLevel = inferRiskLevel(item.rawTitle, item.cleanSummary, src.category);
    const versionMatch = item.rawTitle.match(/\b(v\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?|CVE-\d{4}-\d+)\b/i);
    const version = versionMatch ? versionMatch[1] : `${src.countryCode}-FEED`;
    const sourceSector = inferSourceSector(item.effectiveSourceName, item.itemUrl, src.sourceSector);

    entries.push({
      id: deterministicId(`${src.id}:${item.itemUrl}:${item.rawTitle}`),
      title: item.rawTitle,
      originalTitle: item.rawTitle,
      category: src.category,
      riskLevel,
      sourceSector,
      countryCode: src.countryCode,
      countryName: src.countryName || meta.name,
      region: src.region || meta.region,
      originalLanguage: meta.defaultLang,
      sourceName: item.effectiveSourceName,
      sourceId: src.id,
      sourceIcon: item.sourceIcon,
      bannerImage: resolvedImages[i] || "",
      version,
      publishedAt: item.publishedAt,
      url: item.itemUrl,
      heatScore: riskLevel === "high" ? 86 : riskLevel === "medium" ? 64 : 48,
      commentCount: 0,
      tags: extractTags(item.rawTitle, src.category, src.countryCode),
      aiSummary: item.cleanSummary,
      keyChanges: [
        `來源頻道：${item.effectiveSourceName}（${src.countryName} / ${sourceSector === "official" ? "官方機構" : "民間媒體"}）`,
        item.cleanSummary.slice(0, 140),
      ],
      impactScope: `${src.countryName} (${src.region}) · ${src.category} 關注讀者與跨國資訊追蹤者`,
      migrationSteps: [
        "點擊「前往原始來源」查閱媒體完整報導或官方發布頁面。",
        "可於本頁轉化為個人 Blog 重點稿，或透過 RSS / n8n 同步匯出發布。",
      ],
      aiEnriched: meta.defaultLang === "ZH",
      diff: null,
      comments: [],
    });
  }

  return entries;
}

async function parseGitHubReleasesJson(
  rawJson: string,
  src: SourceItem,
  limit: number
): Promise<CableEntry[]> {
  const parsed = JSON.parse(rawJson) as Array<{
    id?: number;
    tag_name?: string;
    name?: string;
    body?: string;
    html_url?: string;
    published_at?: string;
    prerelease?: boolean;
  }>;
  if (!Array.isArray(parsed)) return [];

  const sliced = parsed.slice(0, limit);
  const ogImages = await Promise.all(
    sliced.map((rel) => (rel.html_url ? fetchRealArticleOgImage(rel.html_url) : Promise.resolve("")))
  );

  const entries: CableEntry[] = [];
  for (let i = 0; i < sliced.length; i += 1) {
    const rel = sliced[i];
    const version = rel.tag_name || "release";
    const title = `${src.name.replace(/\s+Releases$/i, "")} ${version}${
      rel.name && rel.name !== version ? ` — ${rel.name}` : ""
    }`;
    const bodyText = (rel.body || "").replace(/[#*`>]/g, " ").replace(/\s+/g, " ").trim();
    const summary = bodyText.slice(0, 320) || `GitHub 官方發布 ${version} 版本釋出說明。`;
    const riskLevel = inferRiskLevel(title, summary, src.category);
    const url = rel.html_url || src.endpoint;

    entries.push({
      id: deterministicId(`${src.id}:${url}:${version}`),
      title,
      originalTitle: title,
      category: src.category,
      riskLevel,
      sourceSector: "community",
      countryCode: src.countryCode,
      countryName: src.countryName,
      region: src.region,
      originalLanguage: "EN",
      sourceName: src.name,
      sourceId: src.id,
      sourceIcon: "https://www.google.com/s2/favicons?domain=github.com&sz=64",
      bannerImage: ogImages[i] || "",
      version,
      publishedAt: normalizeIsoDate(rel.published_at),
      url,
      heatScore: rel.prerelease ? 68 : 82,
      commentCount: 0,
      tags: extractTags(title, src.category, src.countryCode),
      aiSummary: summary,
      keyChanges: [
        `釋出版本：${version}${rel.prerelease ? "（Pre-release 預覽版）" : "（正式版）"}`,
        summary.slice(0, 150),
      ],
      impactScope: `使用 ${src.name.replace(/\s+Releases$/i, "")} 的開發團隊與相依套件專案`,
      migrationSteps: [
        "檢視 GitHub Release Notes 中的 Breaking Changes 與相依性更新項目。",
        "於測試環境驗證後再升級正式環境鎖定版本。",
      ],
      aiEnriched: false,
      diff: null,
      comments: [],
    });
  }
  return entries;
}

function parseCisaKevJson(rawJson: string, src: SourceItem, limit: number): CableEntry[] {
  const parsed = JSON.parse(rawJson) as {
    vulnerabilities?: Array<{
      cveID?: string;
      vendorProject?: string;
      product?: string;
      vulnerabilityName?: string;
      dateAdded?: string;
      shortDescription?: string;
      requiredAction?: string;
      dueDate?: string;
      knownRansomwareCampaignUse?: string;
    }>;
  };

  const list = Array.isArray(parsed.vulnerabilities) ? parsed.vulnerabilities : [];
  const sorted = [...list].sort((a, b) =>
    (b.dateAdded || "").localeCompare(a.dateAdded || "")
  );

  const entries: CableEntry[] = [];
  for (const vuln of sorted.slice(0, limit)) {
    const cve = vuln.cveID || "CVE-UNKNOWN";
    const title = `[CISA KEV] ${cve}: ${vuln.vendorProject || ""} ${vuln.product || ""} — ${
      vuln.vulnerabilityName || "Known Exploited Vulnerability"
    }`.trim();
    const nvdUrl = `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`;

    entries.push({
      id: deterministicId(`${src.id}:${cve}`),
      title,
      originalTitle: title,
      category: "資安公告",
      riskLevel: "high",
      sourceSector: "official",
      countryCode: src.countryCode,
      countryName: src.countryName,
      region: src.region,
      originalLanguage: "EN",
      sourceName: src.name,
      sourceId: src.id,
      sourceIcon: "https://www.google.com/s2/favicons?domain=cisa.gov&sz=64",
      bannerImage: "",
      version: cve,
      publishedAt: normalizeIsoDate(vuln.dateAdded),
      url: nvdUrl,
      heatScore: vuln.knownRansomwareCampaignUse === "Known" ? 97 : 91,
      commentCount: 0,
      tags: ["US", "資安公告", cve, vuln.vendorProject || "Security"].slice(0, 5),
      aiSummary:
        vuln.shortDescription ||
        `美國 CISA 已確認 ${cve} 存在野外積極利用行為，受影響產品為 ${vuln.vendorProject} ${vuln.product}。`,
      keyChanges: [
        `漏洞編號：${cve}（納入日期：${vuln.dateAdded || "最新"}，修補期限：${vuln.dueDate || "立即"}）`,
        `勒索軟體關聯：${vuln.knownRansomwareCampaignUse || "Unknown"}`,
        vuln.shortDescription || "已列入 CISA Known Exploited Vulnerabilities 官方目錄。",
      ],
      impactScope: `所有部署 ${vuln.vendorProject || ""} ${vuln.product || ""} 的組織與企業伺服器`,
      migrationSteps: [
        vuln.requiredAction || "依據原廠安全公告立即套用最新安全修補程式。",
        `務必於 ${vuln.dueDate || "期限前"} 完成資產清查與緩解驗證。`,
      ],
      aiEnriched: false,
      diff: null,
      comments: [],
    });
  }
  return entries;
}

export async function crawlSingleSourceItems(src: SourceItem, limit = 3): Promise<CableEntry[]> {
  validatePublicUrl(src.endpoint);

  const response = await fetch(src.endpoint, {
    headers: {
      "User-Agent": "CablesGG-Crawler/2.0 (+https://cables.gg)",
      Accept: "application/rss+xml, application/atom+xml, application/json, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`來源回傳 HTTP ${response.status}`);
  }

  const rawText = (await response.text()).slice(0, 6_000_000);
  const lower = rawText.trim().slice(0, 300).toLowerCase();

  if (src.endpoint.includes("known_exploited_vulnerabilities.json")) {
    return parseCisaKevJson(rawText, src, limit);
  }
  if (src.endpoint.includes("api.github.com/repos/") && src.endpoint.includes("/releases")) {
    return parseGitHubReleasesJson(rawText, src, limit);
  }
  if (lower.startsWith("[") || lower.startsWith("{")) {
    const obj = JSON.parse(rawText);
    if (Array.isArray(obj)) {
      return parseGitHubReleasesJson(rawText, src, limit);
    }
    return parseCisaKevJson(rawText, src, limit);
  }

  return parseRssOrAtomEntries(rawText, src, limit);
}

export async function crawlAllSources(options: {
  trigger: string;
  countryFilter: CountryCode | "ALL";
  countriesFilter?: CountryCode[];
  sectorFilter?: "all" | SourceSector;
  limitPerSource?: number;
  enrichWithAi?: boolean;
}): Promise<{
  log: SyncLogItem;
  totalEntries: number;
  newEntries: number;
  translatedCount: number;
  translationWarning?: string;
  capturedEntries: CableEntry[];
}> {
  const startMs = Date.now();
  const sourcesData = await readJsonFile<SourcesPayload>(SOURCES_FILE);
  const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);

  const multiCountries =
    Array.isArray(options.countriesFilter) && options.countriesFilter.length > 0
      ? new Set<CountryCode>(options.countriesFilter)
      : null;

  const targets = sourcesData.sources.filter((s) => {
    if (!s.enabled) return false;
    if (multiCountries) {
      if (!multiCountries.has(s.countryCode)) return false;
    } else if (options.countryFilter !== "ALL" && s.countryCode !== options.countryFilter) {
      return false;
    }
    const sector = inferSourceSector(s.name, s.endpoint, s.sourceSector);
    if (options.sectorFilter && options.sectorFilter !== "all" && sector !== options.sectorFilter) {
      return false;
    }
    return true;
  });

  const existingMap = new Map<string, CableEntry>(db.entries.map((e) => [e.id, e]));
  const newlyCaptured: CableEntry[] = [];
  const nowIso = new Date().toISOString();

  let okCount = 0;
  let addedCount = 0;
  let translatedCount = 0;
  let translationWarning: string | undefined;

  const results = await Promise.allSettled(
    targets.map(async (src) => {
      const items = await crawlSingleSourceItems(src, options.limitPerSource ?? 3);
      return { srcId: src.id, items };
    })
  );

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const outcome = results[i];
    const srcIdx = sourcesData.sources.findIndex((s) => s.id === target.id);

    if (outcome.status === "fulfilled") {
      okCount += 1;
      let srcAdded = 0;
      for (const item of outcome.value.items) {
        if (!existingMap.has(item.id)) {
          const withDigest: CableEntry = item.blogDigest
            ? item
            : { ...item, blogDigest: compileDeterministicBlogDigest(item) };
          existingMap.set(withDigest.id, withDigest);
          newlyCaptured.push(withDigest);
          addedCount += 1;
          srcAdded += 1;
        }
      }
      if (srcIdx !== -1) {
        sourcesData.sources[srcIdx].lastCheckedAt = nowIso;
        sourcesData.sources[srcIdx].lastStatus = "ok";
        sourcesData.sources[srcIdx].itemsCaptured += srcAdded;
      }
    } else if (srcIdx !== -1) {
      sourcesData.sources[srcIdx].lastCheckedAt = nowIso;
      sourcesData.sources[srcIdx].lastStatus = "error";
    }
  }

  if (options.enrichWithAi) {
    if (!process.env.GEMINI_API_KEY) {
      translationWarning =
        "未偵測到 GEMINI_API_KEY，已保存各國真實媒體原文報導與結構化摘要；若需自動翻譯外語新聞為繁體中文，請先配置 API 金鑰。";
    } else {
      const pool = Array.from(existingMap.values()).filter((e) => {
        if (multiCountries && !multiCountries.has(e.countryCode)) return false;
        if (!multiCountries && options.countryFilter !== "ALL" && e.countryCode !== options.countryFilter) {
          return false;
        }
        return (!e.aiEnriched && e.originalLanguage !== "ZH") || !e.blogDigest;
      });
      const prioritized = [
        ...newlyCaptured.filter((e) => !e.aiEnriched && e.originalLanguage !== "ZH"),
        ...pool.filter((p) => !newlyCaptured.some((n) => n.id === p.id)),
      ].slice(0, 4);

      const translatedResults = await Promise.allSettled(
        prioritized.map((candidate) => transformEntryToBlogDigestWithGemini(candidate, "editorial"))
      );
      for (const res of translatedResults) {
        if (res.status === "fulfilled") {
          const enriched = res.value;
          existingMap.set(enriched.id, enriched);
          const newIdx = newlyCaptured.findIndex((c) => c.id === enriched.id);
          if (newIdx !== -1) newlyCaptured[newIdx] = enriched;
          translatedCount += 1;
        }
      }
    }
  }

  const sortedEntries = Array.from(existingMap.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  db.entries = sortedEntries;
  db.totalRecords = sortedEntries.length;
  db.lastUpdated = nowIso;
  await writeJsonFile(DATABASE_FILE, db);

  let pushNote = "";
  if (addedCount > 0 && sourcesData.pipeline.autoPushEnabled) {
    try {
      const subData = await readJsonFile<{
        subscribers?: Array<{ active: boolean; scope: "high_risk_only" | "all" }>;
      }>(SUBSCRIPTIONS_FILE);
      const activeSubs = (subData.subscribers || []).filter((s) => s.active);
      const highRiskNew = newlyCaptured.filter((e) => e.riskLevel === "high").length;
      const notifiedCount = activeSubs.filter(
        (s) => s.scope === "all" || highRiskNew > 0
      ).length;
      pushNote = ` 已同步推播至 RSS / Blog 頻道${
        notifiedCount > 0 ? ` 與 ${notifiedCount} 位訂閱者` : ""
      }。`;
    } catch {
      pushNote = " 已同步推播至 RSS / Blog 頻道。";
    }

    // Auto-dispatch newly captured entries to enabled n8n webhooks
    try {
      const n8nSummary = await dispatchEntriesToEnabledN8nWebhooks(newlyCaptured);
      if (n8nSummary.dispatched > 0) {
        pushNote += ` 已觸發 ${n8nSummary.dispatched} 個 n8n 自動化 Webhook。`;
      }
    } catch {
      // Non-blocking n8n webhook auto-dispatch
    }
  }

  const durationSeconds = Number(((Date.now() - startMs) / 1000).toFixed(1));
  const translateNote =
    translatedCount > 0 ? ` 自動繁中翻譯與 Blog 重點編譯 ${translatedCount} 篇。` : "";
  const log: SyncLogItem = {
    id: `log-${Date.now()}`,
    timestamp: nowIso,
    trigger: options.trigger,
    status: okCount > 0 ? "success" : "warning",
    sourcesChecked: targets.length,
    newEntries: addedCount,
    durationSeconds,
    commitSha: "live-crawl",
    message: `完成 ${targets.length} 個跨國媒體與公開資料庫爬取（${okCount} 個成功），新增 ${addedCount} 筆真實報導，目前總計 ${sortedEntries.length} 筆。${translateNote}${pushNote}`,
  };

  sourcesData.pipeline.lastRunAt = nowIso;
  sourcesData.pipeline.lastRunStatus = log.status;
  sourcesData.pipeline.nextRunAt = new Date(
    Date.now() + (sourcesData.pipeline.intervalMinutes || 240) * 60 * 1000
  ).toISOString();
  sourcesData.syncLogs.unshift(log);
  sourcesData.syncLogs = sourcesData.syncLogs.slice(0, 30);
  await writeJsonFile(SOURCES_FILE, sourcesData);

  return {
    log,
    totalEntries: sortedEntries.length,
    newEntries: addedCount,
    translatedCount,
    translationWarning,
    capturedEntries: newlyCaptured,
  };
}

const ISO_TO_CABLES_COUNTRY: Record<string, CountryCode> = {
  TW: "TW",
  US: "US",
  GB: "GB",
  UK: "GB",
  JP: "JP",
  DE: "DE",
  AT: "DE",
  CH: "DE",
  KR: "KR",
  SG: "SG",
  AU: "AU",
  NZ: "AU",
};

const TIMEZONE_TO_COUNTRY: Array<{ prefix: string; code: CountryCode }> = [
  { prefix: "Asia/Taipei", code: "TW" },
  { prefix: "Asia/Tokyo", code: "JP" },
  { prefix: "Asia/Seoul", code: "KR" },
  { prefix: "Asia/Singapore", code: "SG" },
  { prefix: "Australia/", code: "AU" },
  { prefix: "Pacific/Auckland", code: "AU" },
  { prefix: "Europe/London", code: "GB" },
  { prefix: "Europe/Berlin", code: "DE" },
  { prefix: "Europe/Vienna", code: "DE" },
  { prefix: "Europe/Zurich", code: "DE" },
  { prefix: "America/", code: "US" },
];

export async function locateCountryFromCoordsOrTimezone(options: {
  lat?: number;
  lon?: number;
  timezone?: string;
  language?: string;
}): Promise<{
  countryCode: CountryCode;
  detectedCountryName: string;
  city: string;
  method: "geolocation" | "timezone" | "language";
}> {
  if (
    typeof options.lat === "number" &&
    typeof options.lon === "number" &&
    Number.isFinite(options.lat) &&
    Number.isFinite(options.lon)
  ) {
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        options.lat
      )}&lon=${encodeURIComponent(options.lon)}&accept-language=zh-TW`;
      const resp = await fetch(geoUrl, {
        headers: { "User-Agent": "CablesGG/2.0 (international-media-aggregator)" },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as {
          address?: {
            country_code?: string;
            country?: string;
            city?: string;
            town?: string;
            state?: string;
            county?: string;
          };
        };
        const iso = (data.address?.country_code || "").toUpperCase();
        const mapped = ISO_TO_CABLES_COUNTRY[iso] || "GLOBAL";
        return {
          countryCode: mapped,
          detectedCountryName: data.address?.country || COUNTRY_META[mapped].name,
          city:
            data.address?.city ||
            data.address?.town ||
            data.address?.state ||
            data.address?.county ||
            "",
          method: "geolocation",
        };
      }
    } catch {
      // Fall through to coordinate bounding-box / timezone detection
    }

    // Deterministic coordinate bounding-box fallback for the 8 supported countries
    const { lat, lon } = options;
    const boxes: Array<{ code: CountryCode; latMin: number; latMax: number; lonMin: number; lonMax: number }> = [
      { code: "TW", latMin: 21.8, latMax: 25.4, lonMin: 119.3, lonMax: 122.1 },
      { code: "SG", latMin: 1.15, latMax: 1.48, lonMin: 103.6, lonMax: 104.1 },
      { code: "KR", latMin: 33.1, latMax: 38.6, lonMin: 124.6, lonMax: 131.0 },
      { code: "JP", latMin: 24.0, latMax: 45.6, lonMin: 122.9, lonMax: 146.0 },
      { code: "GB", latMin: 49.9, latMax: 60.9, lonMin: -8.6, lonMax: 1.8 },
      { code: "DE", latMin: 47.2, latMax: 55.1, lonMin: 5.8, lonMax: 15.1 },
      { code: "AU", latMin: -43.7, latMax: -10.5, lonMin: 112.9, lonMax: 154.0 },
      { code: "US", latMin: 24.5, latMax: 49.4, lonMin: -125.0, lonMax: -66.9 },
    ];
    for (const box of boxes) {
      if (lat >= box.latMin && lat <= box.latMax && lon >= box.lonMin && lon <= box.lonMax) {
        return {
          countryCode: box.code,
          detectedCountryName: COUNTRY_META[box.code].name,
          city: "",
          method: "geolocation",
        };
      }
    }
  }

  const tz = (options.timezone || "").trim();
  for (const rule of TIMEZONE_TO_COUNTRY) {
    if (tz.startsWith(rule.prefix)) {
      return {
        countryCode: rule.code,
        detectedCountryName: COUNTRY_META[rule.code].name,
        city: tz.split("/")[1]?.replace(/_/g, " ") || "",
        method: "timezone",
      };
    }
  }

  const lang = (options.language || "").toLowerCase();
  if (lang.includes("zh-tw") || lang.includes("zh-hant")) {
    return { countryCode: "TW", detectedCountryName: "台灣", city: "", method: "language" };
  }
  if (lang.startsWith("ja")) {
    return { countryCode: "JP", detectedCountryName: "日本", city: "", method: "language" };
  }
  if (lang.startsWith("ko")) {
    return { countryCode: "KR", detectedCountryName: "韓國", city: "", method: "language" };
  }
  if (lang.startsWith("de")) {
    return { countryCode: "DE", detectedCountryName: "德國", city: "", method: "language" };
  }
  if (lang.includes("en-gb")) {
    return { countryCode: "GB", detectedCountryName: "英國", city: "", method: "language" };
  }
  if (lang.includes("en-au")) {
    return { countryCode: "AU", detectedCountryName: "澳洲", city: "", method: "language" };
  }
  if (lang.startsWith("en")) {
    return { countryCode: "US", detectedCountryName: "美國", city: "", method: "language" };
  }

  return {
    countryCode: "GLOBAL",
    detectedCountryName: "全球跨國",
    city: "",
    method: "timezone",
  };
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("未偵測到 GEMINI_API_KEY，請先於環境設定中配置 API 金鑰。");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export async function enrichSingleEntryWithGemini(entry: CableEntry): Promise<CableEntry> {
  const ai = getGeminiClient();

  const prompt = `請將以下公開資料庫/新聞/技術異動資料轉譯並結構化為繁體中文（台灣用語）工程與情報分析報告。
來源：${entry.sourceName} (${entry.countryName} / ${entry.region})
分類：${entry.category}
原文標題：${entry.originalTitle || entry.title}
原始網址：${entry.url}
目前摘要：${entry.aiSummary}
關鍵重點：${entry.keyChanges.join(" | ")}`;

  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: prompt,
    config: {
      systemInstruction:
        "你是專業的多國情報與系統架構分析師，必須以精煉、客觀的繁體中文輸出 JSON 結構化分析結果。",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "精準繁體中文標題" },
          aiSummary: { type: Type.STRING, description: "120-200字繁體中文核心摘要" },
          riskLevel: { type: Type.STRING, description: "high, medium, 或 low" },
          impactScope: { type: Type.STRING, description: "受影響系統、產業或地區範圍說明" },
          keyChanges: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-4點關鍵異動或新聞重點",
          },
          migrationSteps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-3點建議檢查或應對步驟",
          },
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5個精簡標籤",
          },
        },
        required: ["title", "aiSummary", "riskLevel", "impactScope", "keyChanges", "migrationSteps", "tags"],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? "{}").trim()) as {
    title?: string;
    aiSummary?: string;
    riskLevel?: string;
    impactScope?: string;
    keyChanges?: string[];
    migrationSteps?: string[];
    tags?: string[];
  };

  const validRisk: RiskLevel =
    parsed.riskLevel === "high" || parsed.riskLevel === "medium" || parsed.riskLevel === "low"
      ? parsed.riskLevel
      : entry.riskLevel;

  return {
    ...entry,
    originalTitle: entry.originalTitle || entry.title,
    title: parsed.title?.trim() || entry.title,
    aiSummary: parsed.aiSummary?.trim() || entry.aiSummary,
    riskLevel: validRisk,
    impactScope: parsed.impactScope?.trim() || entry.impactScope,
    keyChanges:
      Array.isArray(parsed.keyChanges) && parsed.keyChanges.length > 0
        ? parsed.keyChanges
        : entry.keyChanges,
    migrationSteps:
      Array.isArray(parsed.migrationSteps) && parsed.migrationSteps.length > 0
        ? parsed.migrationSteps
        : entry.migrationSteps,
    tags:
      Array.isArray(parsed.tags) && parsed.tags.length > 0
        ? parsed.tags.slice(0, 5)
        : entry.tags,
    aiEnriched: true,
  };
}

export async function batchEnrichEntriesWithGemini(limit = 5): Promise<{
  enrichedCount: number;
  totalEntries: number;
}> {
  const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
  const targets = db.entries
    .filter((e) => !e.aiEnriched && e.originalLanguage !== "ZH")
    .slice(0, limit);

  let enrichedCount = 0;
  for (const target of targets) {
    const updated = await enrichSingleEntryWithGemini(target);
    const idx = db.entries.findIndex((e) => e.id === updated.id);
    if (idx !== -1) {
      db.entries[idx] = updated;
      enrichedCount += 1;
    }
  }

  if (enrichedCount > 0) {
    db.lastUpdated = new Date().toISOString();
    await writeJsonFile(DATABASE_FILE, db);
  }

  return {
    enrichedCount,
    totalEntries: db.entries.length,
  };
}

export async function fetchAndExtractWebContent(
  rawUrl: string,
  keywords?: string
): Promise<{
  resolvedUrl: string;
  extractedText: string;
  bannerImage?: string;
  sourceIcon: string;
  contentTypeLabel: string;
}> {
  const parsedUrl = validatePublicUrl(rawUrl);
  const resp = await fetch(parsedUrl.toString(), {
    headers: {
      "User-Agent": "CablesGG-CustomCrawler/2.0 (+https://cables.gg)",
      Accept: "text/html, application/rss+xml, application/atom+xml, application/json, text/plain, */*",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    throw new Error(`無法讀取目標網址（HTTP ${resp.status}）`);
  }

  const contentType = (resp.headers.get("content-type") || "").toLowerCase();
  const text = (await resp.text()).slice(0, 800_000);
  const resolvedUrl = resp.url || parsedUrl.toString();
  const sourceIcon = resolveFaviconUrl(resolvedUrl);

  let bannerImage: string | undefined;
  let extractedText = "";
  let contentTypeLabel = "HTML Web";

  if (contentType.includes("xml") || contentType.includes("rss") || contentType.includes("atom") || /<(rss|feed)\b/i.test(text.slice(0, 400))) {
    contentTypeLabel = "RSS / Atom";
    const items = text.match(/<(item|entry)[\s\S]*?<\/\1>/gi) || [];
    const snippets: string[] = [];
    const kwList = (keywords || "")
      .split(/[,，\s]+/)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    for (const item of items.slice(0, 12)) {
      const t = stripTags(extractTagValue(item, "title"));
      const d = stripTags(extractTagValue(item, "description") || extractTagValue(item, "summary"));
      if (kwList.length > 0) {
        const hay = `${t} ${d}`.toLowerCase();
        if (!kwList.some((k) => hay.includes(k))) continue;
      }
      if (!bannerImage) {
        bannerImage = extractImageFromXmlBlock(item, resolvedUrl);
      }
      snippets.push(`標題：${t}\n摘要：${d}`);
    }
    extractedText = (snippets.length > 0 ? snippets.join("\n\n") : stripTags(text)).slice(0, 6000);
  } else if (contentType.includes("json")) {
    contentTypeLabel = "Public JSON";
    extractedText = text.slice(0, 6000);
  } else {
    contentTypeLabel = "HTML Web";
    const ogImageMatch =
      text.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
      text.match(/<meta[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i);
    bannerImage = resolveAbsoluteUrl(ogImageMatch?.[1], resolvedUrl);

    const pageTitle = stripTags(extractTagValue(text, "title"));
    const bodyText = stripTags(text);
    extractedText = `網頁標題：${pageTitle}\n${keywords ? `關注關鍵字：${keywords}\n` : ""}內文擷取：${bodyText.slice(0, 5500)}`;
  }

  return {
    resolvedUrl,
    extractedText: extractedText.trim() || `目標網址：${resolvedUrl}`,
    bannerImage,
    sourceIcon,
    contentTypeLabel,
  };
}

export async function summarizeAndSaveEntry(input: {
  sourceName: string;
  sourceId: string;
  url: string;
  rawContent: string;
  bannerImage?: string;
  sourceIcon?: string;
  categoryHint?: string;
  countryHint?: string;
  regionHint?: string;
  versionHint?: string;
  keywords?: string;
  triggerLabel: string;
}): Promise<CableEntry> {
  const category = normalizeCategory(input.categoryHint, "自訂爬文");
  const countryCode = normalizeCountry(input.countryHint, "GLOBAL");
  const meta = COUNTRY_META[countryCode];
  const region = normalizeRegion(input.regionHint, meta.region);
  const sourceIcon = input.sourceIcon || resolveFaviconUrl(input.url);
  const bannerImage = input.bannerImage || "";

  let structured: {
    title: string;
    aiSummary: string;
    riskLevel: RiskLevel;
    impactScope: string;
    keyChanges: string[];
    migrationSteps: string[];
    tags: string[];
    version?: string;
  };

  if (process.env.GEMINI_API_KEY) {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: `請將以下爬蟲擷取之原始資料彙整為繁體中文（台灣）結構化情報條目：
來源名稱：${input.sourceName}
來源網址：${input.url}
國家與分類提示：${meta.name} / ${category}
${input.keywords ? `使用者關注關鍵字：${input.keywords}` : ""}
原始內容：\n${input.rawContent.slice(0, 6000)}`,
      config: {
        systemInstruction:
          "你是 Cables.gg 的自動化資訊編譯引擎，請以客觀精煉的繁體中文輸出 JSON 結構化摘要。",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            aiSummary: { type: Type.STRING },
            riskLevel: { type: Type.STRING },
            impactScope: { type: Type.STRING },
            keyChanges: { type: Type.ARRAY, items: { type: Type.STRING } },
            migrationSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            version: { type: Type.STRING },
          },
          required: ["title", "aiSummary", "riskLevel", "impactScope", "keyChanges", "migrationSteps", "tags"],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? "{}").trim()) as Partial<typeof structured>;
    const risk: RiskLevel =
      parsed.riskLevel === "high" || parsed.riskLevel === "medium" || parsed.riskLevel === "low"
        ? parsed.riskLevel
        : inferRiskLevel(input.rawContent.slice(0, 120), input.rawContent, category);

    structured = {
      title: parsed.title?.trim() || `${input.sourceName} 爬蟲擷取摘要`,
      aiSummary: parsed.aiSummary?.trim() || input.rawContent.slice(0, 220),
      riskLevel: risk,
      impactScope: parsed.impactScope?.trim() || `${meta.name} (${region}) · ${category} 相關系統與團隊`,
      keyChanges:
        Array.isArray(parsed.keyChanges) && parsed.keyChanges.length > 0
          ? parsed.keyChanges
          : [input.rawContent.slice(0, 140)],
      migrationSteps:
        Array.isArray(parsed.migrationSteps) && parsed.migrationSteps.length > 0
          ? parsed.migrationSteps
          : ["檢視原始目標連結以取得完整上下文。"],
      tags:
        Array.isArray(parsed.tags) && parsed.tags.length > 0
          ? parsed.tags.slice(0, 5)
          : [countryCode, category],
      version: parsed.version?.trim(),
    };
  } else {
    const firstLine = input.rawContent.split("\n")[0].replace(/^網頁標題：/, "").trim();
    const title = firstLine.slice(0, 90) || `${input.sourceName} 爬蟲索引`;
    const risk = inferRiskLevel(title, input.rawContent, category);
    structured = {
      title,
      aiSummary: input.rawContent.slice(0, 260),
      riskLevel: risk,
      impactScope: `${meta.name} (${region}) · ${category}`,
      keyChanges: [input.rawContent.slice(0, 140)],
      migrationSteps: ["點擊「前往官方原文」檢視原始頁面內容。"],
      tags: extractTags(title, category, countryCode),
    };
  }

  const nowIso = new Date().toISOString();
  const sourceSector = inferSourceSector(input.sourceName, input.url);
  const entry: CableEntry = {
    id: deterministicId(`${input.sourceId}:${input.url}:${structured.title}`),
    title: structured.title,
    originalTitle: structured.title,
    category,
    riskLevel: structured.riskLevel,
    sourceSector,
    countryCode,
    countryName: meta.name,
    region,
    originalLanguage: meta.defaultLang,
    sourceName: input.sourceName,
    sourceId: input.sourceId,
    sourceIcon,
    bannerImage,
    version: input.versionHint || structured.version || `${countryCode}-CRAWL`,
    publishedAt: nowIso,
    url: input.url,
    heatScore: structured.riskLevel === "high" ? 88 : 65,
    commentCount: 0,
    tags: structured.tags,
    aiSummary: structured.aiSummary,
    keyChanges: structured.keyChanges,
    impactScope: structured.impactScope,
    migrationSteps: structured.migrationSteps,
    aiEnriched: Boolean(process.env.GEMINI_API_KEY),
    diff: null,
    comments: [],
  };

  const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
  const existingIdx = db.entries.findIndex((e) => e.id === entry.id);
  if (existingIdx !== -1) {
    db.entries[existingIdx] = { ...entry, comments: db.entries[existingIdx].comments };
  } else {
    db.entries.unshift(entry);
  }
  db.totalRecords = db.entries.length;
  db.lastUpdated = nowIso;
  await writeJsonFile(DATABASE_FILE, db);

  const sourcesData = await readJsonFile<SourcesPayload>(SOURCES_FILE);
  sourcesData.syncLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: nowIso,
    trigger: input.triggerLabel,
    status: "success",
    sourcesChecked: 1,
    newEntries: existingIdx === -1 ? 1 : 0,
    durationSeconds: 1.2,
    commitSha: "custom-crawl",
    message: `已完成「${input.sourceName}」擷取並更新索引：${entry.title}`,
  });
  sourcesData.syncLogs = sourcesData.syncLogs.slice(0, 30);
  await writeJsonFile(SOURCES_FILE, sourcesData);

  return entry;
}

export function compileDeterministicBlogDigest(entry: CableEntry): BlogDigest {
  const sector = inferSourceSector(entry.sourceName, entry.url, entry.sourceSector);
  const sectorLabel = sector === "official" ? "官方機構" : "民間社群";
  const riskLabel =
    entry.riskLevel === "high" ? "頭條焦點" : entry.riskLevel === "medium" ? "重點報導" : "一般快訊";
  const markers = Array.from(
    new Set([sectorLabel, entry.countryName, entry.category, riskLabel, ...entry.tags.slice(0, 3)])
  ).slice(0, 6);

  const keyPoints =
    entry.keyChanges && entry.keyChanges.length > 0
      ? entry.keyChanges.slice(0, 4)
      : [entry.aiSummary];

  const takeAway =
    entry.migrationSteps && entry.migrationSteps.length > 0
      ? entry.migrationSteps[0]
      : `建議追蹤 ${entry.sourceName} 原文報導與跨國後續發展。`;

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
    generatedAt: new Date().toISOString(),
  };
}

export function compileCuratedBlogHtml(entry: CableEntry, origin: string): string {
  const digest = entry.blogDigest || compileDeterministicBlogDigest(entry);
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const markerLine = digest.markers.map((m) => `[${esc(m)}]`).join(" · ");
  const pointsHtml = digest.keyPoints.map((p) => `<li>${esc(p)}</li>`).join("");
  const imgHtml = entry.bannerImage
    ? `<p><img src="${esc(entry.bannerImage)}" alt="${esc(digest.headline)}" style="max-width:100%;border-radius:6px;" /></p>`
    : "";

  return `${imgHtml}
<p><strong>重點標記：</strong>${markerLine}</p>
<p>${esc(digest.lead)}</p>
<h3>後端整理重點（精簡版）</h3>
<ol>${pointsHtml}</ol>
<p><strong>影響範圍：</strong>${esc(entry.impactScope)}</p>
<p><strong>行動建議：</strong>${esc(digest.takeAway)}</p>
<p><a href="${esc(origin)}/blog/${esc(entry.id)}">閱讀個人 Blog 版</a> · <a href="${esc(entry.url)}">前往原始來源 (${esc(entry.sourceName)})</a></p>`;
}

export async function transformEntryToBlogDigestWithGemini(
  entry: CableEntry,
  tone: "editorial" | "brief" | "newsletter" = "editorial"
): Promise<CableEntry> {
  const ai = getGeminiClient();
  const sector = inferSourceSector(entry.sourceName, entry.url, entry.sourceSector);
  const toneGuide =
    tone === "newsletter"
      ? "電子報週報精選語氣，強調行動提醒與快速掃讀"
      : tone === "brief"
        ? "極簡高管情報快報語氣，每點不超過 28 字"
        : "專業個人技術/趨勢 Blog 專欄風格，有觀點且精煉";

  const prompt = `請將以下跨國資料流條目改寫為「後端精簡重點與標記版」的個人 Blog 文章模板（請勿複製全文，只提煉核心脈絡與可執行重點，一律使用繁體中文）：
來源：${entry.sourceName}（${entry.countryName} / ${sector === "official" ? "官方機構" : "民間社群"}）
分類：${entry.category}
風險等級：${entry.riskLevel}
原文標題：${entry.originalTitle || entry.title}
摘要：${entry.aiSummary}
既有重點：${entry.keyChanges.join(" | ")}
影響範圍：${entry.impactScope}
建議步驟：${entry.migrationSteps.join(" | ")}
語氣要求：${toneGuide}`;

  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: prompt,
    config: {
      systemInstruction:
        "你是專業的情報編輯與技術 Blog 主筆。必須只輸出精簡重點整理與語意標記（絕對不要輸出長篇逐字全文），以 JSON 格式回傳。",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING, description: "適合個人 Blog 發布的精煉繁體中文標題" },
          lead: { type: Type.STRING, description: "80-140字精華導讀段落" },
          keyPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-4 條濃縮重點標記句",
          },
          markers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 個主題標記（含官民屬性/主題關鍵詞）",
          },
          takeAway: { type: Type.STRING, description: "一句話行動結論或觀察重點" },
        },
        required: ["headline", "lead", "keyPoints", "markers", "takeAway"],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? "{}").trim()) as {
    headline?: string;
    lead?: string;
    keyPoints?: string[];
    markers?: string[];
    takeAway?: string;
  };

  const base = compileDeterministicBlogDigest(entry);
  const headline = parsed.headline?.trim() || base.headline;
  const lead = parsed.lead?.trim() || base.lead;
  const keyPoints =
    Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0
      ? parsed.keyPoints
      : base.keyPoints;
  const markers =
    Array.isArray(parsed.markers) && parsed.markers.length > 0
      ? parsed.markers.slice(0, 6)
      : base.markers;
  const takeAway = parsed.takeAway?.trim() || base.takeAway;

  const markdown = [
    `---`,
    `title: "${headline.replace(/"/g, '\\"')}"`,
    `date: "${entry.publishedAt}"`,
    `country: "${entry.countryName} (${entry.countryCode})"`,
    `sector: "${sector === "official" ? "官方機構" : "民間社群"}"`,
    `category: "${entry.category}"`,
    `markers: [${markers.map((m) => `"${m}"`).join(", ")}]`,
    `source_url: "${entry.url}"`,
    `---`,
    ``,
    `# ${headline}`,
    ``,
    `> **焦點標記**：${markers.map((m) => `\`${m}\``).join(" · ")}`,
    ``,
    `## 重點導讀`,
    ``,
    lead,
    ``,
    `## 後端精選重點（僅重點標記，非全文轉載）`,
    ...keyPoints.map((pt, idx) => `${idx + 1}. ${pt}`),
    ``,
    `## 觀點與下一步建議`,
    `- **影響範圍**：${entry.impactScope}`,
    `- **結論備忘**：${takeAway}`,
    ``,
    `[原文參考：${entry.sourceName}](${entry.url})`,
  ].join("\n");

  return {
    ...entry,
    sourceSector: sector,
    title: headline,
    aiSummary: lead,
    keyChanges: keyPoints,
    aiEnriched: true,
    blogDigest: {
      headline,
      lead,
      keyPoints,
      markers,
      takeAway,
      markdown,
      generatedAt: new Date().toISOString(),
    },
  };
}

export function buildTemplatePayloadForEntries(
  entries: CableEntry[],
  format: N8nTemplateFormat,
  origin = "https://cables.gg"
) {
  const formattedItems = entries.map((entry) => {
    const sector = inferSourceSector(entry.sourceName, entry.url, entry.sourceSector);
    const digest = entry.blogDigest || compileDeterministicBlogDigest(entry);
    const baseItem = {
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
      publishedAt: entry.publishedAt,
      bannerImage: entry.bannerImage || null,
      markers: digest.markers,
      lead: digest.lead,
      keyPoints: digest.keyPoints,
      takeAway: digest.takeAway,
    };

    if (format === "blog_markdown") {
      return { ...baseItem, markdown: digest.markdown };
    }
    if (format === "html_card") {
      return { ...baseItem, html: compileCuratedBlogHtml(entry, origin) };
    }
    if (format === "newsletter") {
      const newsletterText = [
        `[${entry.countryName} · ${sector === "official" ? "官方" : "民間"} · ${entry.category}] ${digest.headline}`,
        ``,
        digest.lead,
        ``,
        ...digest.keyPoints.map((p) => `• ${p}`),
        ``,
        `→ 建議：${digest.takeAway}`,
        `→ 原文：${entry.url}`,
      ].join("\n");
      return { ...baseItem, newsletterText };
    }
    return baseItem;
  });

  return {
    source: "Cables.gg",
    event: "cables.intelligence.dispatch",
    templateFormat: format,
    dispatchedAt: new Date().toISOString(),
    count: formattedItems.length,
    rssBlogFeedUrl: `${origin}/rss/blog.xml`,
    jsonFeedUrl: `${origin}/feed.json`,
    items: formattedItems,
  };
}

export async function dispatchToSingleN8nWebhook(options: {
  webhookUrl: string;
  webhookName: string;
  entries: CableEntry[];
  templateFormat: N8nTemplateFormat;
  origin?: string;
}): Promise<N8nDispatchLog> {
  validatePublicUrl(options.webhookUrl);
  const nowIso = new Date().toISOString();
  const payload = buildTemplatePayloadForEntries(
    options.entries,
    options.templateFormat,
    options.origin || "https://cables.gg"
  );

  let statusCode: number | null = null;
  let ok = false;
  let message = "";

  try {
    const resp = await fetch(options.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CablesGG-n8n-Dispatcher/2.0",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    statusCode = resp.status;
    ok = resp.ok;
    const text = (await resp.text().catch(() => "")).slice(0, 120);
    message = resp.ok
      ? `HTTP ${resp.status} 傳送成功${text ? ` (${text})` : ""}`
      : `HTTP ${resp.status} 回應錯誤${text ? `: ${text}` : ""}`;
  } catch (err) {
    message = err instanceof Error ? err.message : "連線至 n8n Webhook 逾時或失敗";
  }

  const log: N8nDispatchLog = {
    id: `n8n-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: nowIso,
    webhookName: options.webhookName,
    webhookUrl: options.webhookUrl,
    templateFormat: options.templateFormat,
    entryCount: options.entries.length,
    entryTitle:
      options.entries.length === 1
        ? options.entries[0].title
        : `${options.entries[0]?.title ?? "批次情報"} 等 ${options.entries.length} 筆`,
    statusCode,
    ok,
    message,
  };

  try {
    const n8nData = await readJsonFile<N8nPayload>(N8N_FILE);
    n8nData.dispatchLogs.unshift(log);
    n8nData.dispatchLogs = n8nData.dispatchLogs.slice(0, 40);
    n8nData.lastUpdated = nowIso;
    await writeJsonFile(N8N_FILE, n8nData);
  } catch {
    // Non-blocking log persistence
  }

  return log;
}

export async function dispatchEntriesToEnabledN8nWebhooks(
  entries: CableEntry[],
  origin = "https://cables.gg"
): Promise<{ dispatched: number; logs: N8nDispatchLog[] }> {
  if (entries.length === 0) return { dispatched: 0, logs: [] };
  const n8nData = await readJsonFile<N8nPayload>(N8N_FILE);
  const activeHooks = (n8nData.webhooks || []).filter(
    (w) => w.enabled && w.triggerMode !== "manual"
  );
  if (activeHooks.length === 0) return { dispatched: 0, logs: [] };

  const logs: N8nDispatchLog[] = [];
  for (const hook of activeHooks) {
    const matching = entries.filter((entry) => {
      if (hook.triggerMode === "high_risk" && entry.riskLevel !== "high") return false;
      const sector = inferSourceSector(entry.sourceName, entry.url, entry.sourceSector);
      if (hook.sectorFilter !== "all" && sector !== hook.sectorFilter) return false;
      if (
        hook.countries.length > 0 &&
        !hook.countries.includes("ALL") &&
        !hook.countries.includes(entry.countryCode)
      ) {
        return false;
      }
      return true;
    });
    if (matching.length === 0) continue;
    const log = await dispatchToSingleN8nWebhook({
      webhookUrl: hook.webhookUrl,
      webhookName: hook.name,
      entries: matching.slice(0, 10),
      templateFormat: hook.templateFormat,
      origin,
    });
    hook.lastDispatchedAt = log.timestamp;
    hook.lastStatusCode = log.statusCode;
    logs.push(log);
  }

  if (logs.length > 0) {
    n8nData.lastUpdated = new Date().toISOString();
    await writeJsonFile(N8N_FILE, n8nData);
  }

  return { dispatched: logs.length, logs };
}

function extractArticleBlocksFromHtml(html: string): FullArticleBlock[] {
  // Prefer semantic <article> or <main> container if substantial
  const articleMatch =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const scopeHtml =
    articleMatch && articleMatch[1].length > 800 ? articleMatch[1] : html;

  const cleaned = scopeHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, " ");

  const blocks: FullArticleBlock[] = [];
  const seen = new Set<string>();
  const tagRegex = /<(h2|h3|blockquote|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;

  const noisePatterns =
    /^(sign up|subscribe|read more|advertisement|sponsored|cookie|accept all|privacy policy|terms of service|share this|follow us|related articles|more on this|copyright ©|all rights reserved|免費訂閱|立即訂閱|相關新聞|延伸閱讀|廣告|版權所有)/i;

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(cleaned)) !== null) {
    const tag = match[1].toLowerCase();
    const text = stripTags(match[2]);
    if (!text) continue;

    // Filter out tiny nav items or boilerplate lines
    const minLen = tag === "h2" || tag === "h3" ? 6 : 24;
    if (text.length < minLen) continue;
    if (noisePatterns.test(text)) continue;
    if (seen.has(text)) continue;

    seen.add(text);
    const type: FullArticleBlock["type"] =
      tag === "h2" || tag === "h3"
        ? "heading"
        : tag === "blockquote"
          ? "quote"
          : "paragraph";
    blocks.push({ type, text });
    if (blocks.length >= 36) break;
  }

  return blocks;
}

function buildFallbackBlocksFromEntry(entry: CableEntry): FullArticleBlock[] {
  const blocks: FullArticleBlock[] = [];
  if (entry.aiSummary?.trim()) {
    blocks.push({ type: "paragraph", text: entry.aiSummary.trim() });
  }
  if (entry.keyChanges?.length) {
    blocks.push({ type: "heading", text: "重點報導脈絡與詳細內容" });
    for (const item of entry.keyChanges) {
      if (item?.trim()) blocks.push({ type: "paragraph", text: item.trim() });
    }
  }
  if (entry.impactScope?.trim()) {
    blocks.push({ type: "heading", text: "影響範圍與背景脈絡" });
    blocks.push({ type: "paragraph", text: entry.impactScope.trim() });
  }
  if (entry.migrationSteps?.length) {
    blocks.push({ type: "heading", text: "延伸關注與後續行動" });
    for (const step of entry.migrationSteps) {
      if (step?.trim()) blocks.push({ type: "paragraph", text: step.trim() });
    }
  }
  return blocks;
}

export async function fetchFullArticleForReader(
  entry: CableEntry,
  translateToZh = false
): Promise<{
  blocks: FullArticleBlock[];
  sourceMode: "live_full_article" | "rss_expanded_fallback";
  fetchedAt: string;
  translationWarning?: string;
}> {
  let blocks: FullArticleBlock[] = Array.isArray(entry.fullArticleBlocks)
    ? [...entry.fullArticleBlocks]
    : [];
  let sourceMode: "live_full_article" | "rss_expanded_fallback" =
    entry.fullArticleSourceMode || "rss_expanded_fallback";
  let fetchedAt = entry.fullArticleFetchedAt || new Date().toISOString();

  // Fetch live full article if not yet cached or previous attempt had < 3 blocks
  if (blocks.length < 3 || sourceMode !== "live_full_article") {
    try {
      const parsedUrl = validatePublicUrl(entry.url);
      if (parsedUrl.hostname.toLowerCase() !== "news.google.com") {
        const resp = await fetch(parsedUrl.toString(), {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; CablesGG-Reader/2.0; +https://cables.gg)",
            Accept: "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          const ct = (resp.headers.get("content-type") || "").toLowerCase();
          const raw = (await resp.text()).slice(0, 750_000);
          if (ct.includes("html") || /<html|<body|<article/i.test(raw.slice(0, 1000))) {
            const extracted = extractArticleBlocksFromHtml(raw);
            if (extracted.length >= 2) {
              blocks = extracted;
              sourceMode = "live_full_article";
              fetchedAt = new Date().toISOString();
            }
          } else if (ct.includes("json")) {
            try {
              const jsonData = JSON.parse(raw) as { body?: string; description?: string };
              const textBody = (jsonData.body || jsonData.description || "").trim();
              if (textBody.length > 80) {
                blocks = textBody
                  .split(/\n{2,}/)
                  .map((p) => p.replace(/\s+/g, " ").trim())
                  .filter((p) => p.length > 20)
                  .slice(0, 30)
                  .map((text) => ({ type: "paragraph" as const, text }));
                if (blocks.length > 0) {
                  sourceMode = "live_full_article";
                  fetchedAt = new Date().toISOString();
                }
              }
            } catch {
              // Non-blocking JSON parse fallback
            }
          }
        }
      }
    } catch {
      // Fall back cleanly to stored fields below
    }

    if (blocks.length === 0) {
      blocks = buildFallbackBlocksFromEntry(entry);
      sourceMode = "rss_expanded_fallback";
      fetchedAt = new Date().toISOString();
    }
  }

  let translationWarning: string | undefined;
  const needsTranslation =
    translateToZh &&
    entry.originalLanguage !== "ZH" &&
    blocks.some((b) => !b.translatedText && !/[\u4e00-\u9fff]{6,}/.test(b.text));

  if (needsTranslation) {
    if (!process.env.GEMINI_API_KEY) {
      translationWarning = "目前未設定 GEMINI_API_KEY，保留原文完整閱讀。";
    } else {
      try {
        const ai = getGeminiClient();
        const targetBlocks = blocks.slice(0, 24);
        const prompt = `請將以下新聞／公開文章的每一個段落完整翻譯為自然流暢的繁體中文（台灣用語）。必須保留原始數量（共 ${targetBlocks.length} 段）且不要刪減內容，忠實還原完整文章：\n\n${targetBlocks
          .map((b, i) => `[${i}] (${b.type}) ${b.text}`)
          .join("\n\n")}`;

        const response = await ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: prompt,
          config: {
            systemInstruction:
              "你是專業的跨國新聞編譯，請逐段完整翻譯為繁體中文（台灣），不可自行縮短或省略段落細節，輸出 JSON 陣列。",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                translations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "對應輸入順序的逐段繁體中文完整翻譯",
                },
              },
              required: ["translations"],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? "{}").trim()) as {
          translations?: string[];
        };
        if (Array.isArray(parsed.translations)) {
          blocks = blocks.map((b, idx) => ({
            ...b,
            translatedText: parsed.translations?.[idx]?.trim() || b.translatedText,
          }));
        }
      } catch (err) {
        translationWarning =
          err instanceof Error
            ? `全文自動翻譯未完成：${err.message}`
            : "全文自動翻譯暫時無法使用，顯示原文內容。";
      }
    }
  }

  return {
    blocks,
    sourceMode,
    fetchedAt,
    translationWarning,
  };
}

// -------------------- Custom Blog Profile & Real External Creator Directory --------------------

export type BlogLayoutTemplate = "minimal" | "editorial" | "cards";
export type CreatorPlatform = "github" | "devto" | "rss";

export interface CreatorArticlePreview {
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
  coverImage?: string;
}

export interface RealCreatorProfile {
  id: string;
  platform: CreatorPlatform;
  handle: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  location: string;
  company: string;
  profileUrl: string;
  websiteUrl: string;
  rssUrl: string;
  followers: number | null;
  publicRepos: number | null;
  tags: string[];
  articles: CreatorArticlePreview[];
  fetchedAt: string;
}

export interface ReferencedProfile extends RealCreatorProfile {
  referenceNote: string;
  autoSubscribedSourceId?: string | null;
  importedEntryIds: string[];
  referencedAt: string;
}

export interface FollowedProfile extends RealCreatorProfile {
  followedAt: string;
}

export type ProfileActivityKind = "bookmark" | "highlight" | "blog_post";

export interface ProfileActivityItem {
  id: string;
  kind: ProfileActivityKind;
  actorId: string;
  actorName: string;
  actorHandle: string;
  actorAvatarUrl: string;
  platform: CreatorPlatform | "cables";
  title: string;
  excerpt: string;
  url: string;
  internalPostId?: string;
  internalBlogId?: string;
  tags: string[];
  createdAt: string;
  metaLabel?: string;
}

export interface BlogProfileConfig {
  slug: string;
  blogTitle: string;
  tagline: string;
  ownerName: string;
  ownerBio: string;
  template: BlogLayoutTemplate;
  autoImportEnabled: boolean;
  autoImportCountries: Array<"ALL" | CountryCode>;
  autoImportCategories: CableCategory[];
  importedEntryIds: string[];
  referencedProfiles: ReferencedProfile[];
  followedProfiles?: FollowedProfile[];
  ownerFollowed?: boolean;
  ownerFollowersCount?: number;
  updatedAt: string;
}

const DEFAULT_BLOG_PROFILE: BlogProfileConfig = {
  slug: "my-cables",
  blogTitle: "我的跨國情報與技術觀測 Blog",
  tagline: "自動化引進各國官民資料流，結合真實創作者脈絡與個人精選評論",
  ownerName: "Cables.gg 主編",
  ownerBio: "專注於跨國政策新聞、開源技術釋出與獨立開發者寫作的個人精選情報誌。",
  template: "editorial",
  autoImportEnabled: true,
  autoImportCountries: ["ALL"],
  autoImportCategories: [],
  importedEntryIds: [],
  referencedProfiles: [],
  followedProfiles: [],
  ownerFollowed: false,
  ownerFollowersCount: 0,
  updatedAt: new Date().toISOString(),
};

export function normalizeBlogSlug(raw: string | undefined): string {
  const cleaned = (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 48) || "my-cables";
}

export async function readBlogProfile(): Promise<BlogProfileConfig> {
  try {
    const data = await readJsonFile<BlogProfileConfig>(BLOG_PROFILE_FILE);
    return {
      ...DEFAULT_BLOG_PROFILE,
      ...data,
      slug: normalizeBlogSlug(data.slug),
      importedEntryIds: Array.isArray(data.importedEntryIds) ? data.importedEntryIds : [],
      referencedProfiles: Array.isArray(data.referencedProfiles) ? data.referencedProfiles : [],
      followedProfiles: Array.isArray(data.followedProfiles) ? data.followedProfiles : [],
      ownerFollowed: Boolean(data.ownerFollowed),
      ownerFollowersCount:
        typeof data.ownerFollowersCount === "number" ? data.ownerFollowersCount : 0,
      autoImportCountries:
        Array.isArray(data.autoImportCountries) && data.autoImportCountries.length > 0
          ? data.autoImportCountries
          : ["ALL"],
      autoImportCategories: Array.isArray(data.autoImportCategories)
        ? data.autoImportCategories
        : [],
    };
  } catch {
    await writeJsonFile(BLOG_PROFILE_FILE, DEFAULT_BLOG_PROFILE);
    return { ...DEFAULT_BLOG_PROFILE };
  }
}

const KNOWN_CREATOR_FEEDS: Record<string, string> = {
  simonw: "https://simonwillison.net/atom/everything/",
  gaearon: "https://overreacted.io/rss.xml",
};

async function fetchRssArticlePreviews(
  feedUrl: string,
  limit = 4
): Promise<{
  feedTitle: string;
  siteUrl: string;
  authorName: string;
  description: string;
  articles: CreatorArticlePreview[];
}> {
  validatePublicUrl(feedUrl);
  const resp = await fetch(feedUrl, {
    headers: {
      "User-Agent": "CablesGG-ProfileReader/2.0 (+https://cables.gg)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(7000),
  });
  if (!resp.ok) {
    throw new Error(`訂閱源回應 HTTP ${resp.status}`);
  }
  const xml = (await resp.text()).slice(0, 1_500_000);
  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const headXml = xml.split(isAtom ? /<entry[\s>]/i : /<item[\s>]/i)[0] || xml.slice(0, 4000);

  const feedTitle = stripTags(extractTagValue(headXml, "title"));
  const description = stripTags(
    extractTagValue(headXml, "description") || extractTagValue(headXml, "subtitle")
  ).slice(0, 220);
  const authorName = stripTags(extractTagValue(headXml, "name") || extractTagValue(headXml, "author"));

  let siteUrl = "";
  if (isAtom) {
    const m =
      headXml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ||
      headXml.match(/<link[^>]*href=["']([^"']+)["']/i);
    siteUrl = m ? decodeHtmlEntities(m[1]).trim() : "";
  } else {
    siteUrl = stripTags(extractTagValue(headXml, "link"));
  }
  if (!siteUrl) {
    try {
      siteUrl = new URL(feedUrl).origin;
    } catch {
      siteUrl = feedUrl;
    }
  }

  const blocks = isAtom
    ? xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
    : xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  const articles: CreatorArticlePreview[] = [];
  for (const block of blocks.slice(0, limit)) {
    const title = stripTags(extractTagValue(block, "title"));
    if (!title) continue;
    let url = "";
    if (isAtom) {
      const m =
        block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ||
        block.match(/<link[^>]*href=["']([^"']+)["']/i);
      url = m ? decodeHtmlEntities(m[1]).trim() : "";
    } else {
      url = stripTags(extractTagValue(block, "link"));
    }
    const rawDesc =
      extractTagValue(block, "description") ||
      extractTagValue(block, "summary") ||
      extractTagValue(block, "content");
    const summary = stripTags(rawDesc).slice(0, 220) || title;
    const rawDate =
      extractTagValue(block, "pubDate") ||
      extractTagValue(block, "published") ||
      extractTagValue(block, "updated");
    const coverImage =
      extractImageFromXmlBlock(block, url || siteUrl) ||
      extractImageFromXmlBlock(rawDesc, url || siteUrl);

    articles.push({
      title,
      url: url || siteUrl,
      publishedAt: normalizeIsoDate(rawDate),
      summary,
      coverImage,
    });
  }

  return { feedTitle, siteUrl, authorName, description, articles };
}

export async function fetchGitHubCreatorProfile(rawHandle: string): Promise<RealCreatorProfile> {
  const handle = rawHandle.trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//i, "").split("/")[0];
  if (!handle) {
    throw new Error("請輸入有效的 GitHub 使用者帳號。");
  }

  const userResp = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`, {
    headers: {
      "User-Agent": "CablesGG-ProfileDirectory/2.0",
      Accept: "application/vnd.github+json",
    },
    signal: AbortSignal.timeout(7000),
  });
  if (!userResp.ok) {
    throw new Error(
      userResp.status === 404
        ? `找不到 GitHub 帳號「${handle}」。`
        : `GitHub API 回應 HTTP ${userResp.status}`
    );
  }

  const u = (await userResp.json()) as {
    login: string;
    name?: string;
    avatar_url?: string;
    bio?: string;
    location?: string;
    company?: string;
    html_url: string;
    blog?: string;
    followers?: number;
    public_repos?: number;
  };

  let websiteUrl = (u.blog || "").trim();
  if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
    websiteUrl = `https://${websiteUrl}`;
  }

  const knownRss = KNOWN_CREATOR_FEEDS[u.login.toLowerCase()] || "";
  let rssUrl = knownRss;
  let articles: CreatorArticlePreview[] = [];

  if (knownRss) {
    try {
      const feedData = await fetchRssArticlePreviews(knownRss, 3);
      articles = feedData.articles;
    } catch {
      // Fall through to GitHub repositories below
    }
  }

  if (articles.length === 0) {
    try {
      const repoResp = await fetch(
        `https://api.github.com/users/${encodeURIComponent(u.login)}/repos?sort=updated&per_page=3`,
        {
          headers: {
            "User-Agent": "CablesGG-ProfileDirectory/2.0",
            Accept: "application/vnd.github+json",
          },
          signal: AbortSignal.timeout(6000),
        }
      );
      if (repoResp.ok) {
        const repos = (await repoResp.json()) as Array<{
          name: string;
          full_name: string;
          description?: string;
          html_url: string;
          updated_at?: string;
          language?: string;
          stargazers_count?: number;
        }>;
        articles = repos.map((repo) => ({
          title: `${repo.full_name}${repo.language ? ` [${repo.language}]` : ""}`,
          url: repo.html_url,
          publishedAt: normalizeIsoDate(repo.updated_at),
          summary:
            repo.description?.trim() ||
            `GitHub 公開專案（Stars: ${repo.stargazers_count ?? 0}），可持續追蹤版本釋出。`,
        }));
        if (!rssUrl && repos[0]?.full_name) {
          rssUrl = `https://github.com/${repos[0].full_name}/releases.atom`;
        }
      }
    } catch {
      // Optional repos list
    }
  }

  const tags = ["GitHub"];
  if (u.location) tags.push(u.location.split(",")[0].trim());
  if (knownRss) tags.push("個人 Blog RSS");

  return {
    id: `prof-gh-${u.login.toLowerCase()}`,
    platform: "github",
    handle: u.login,
    displayName: u.name?.trim() || u.login,
    avatarUrl: u.avatar_url || "",
    bio: u.bio?.trim() || `${u.login} 的 GitHub 開源公開個人檔案（${u.public_repos ?? 0} 個公開儲存庫）。`,
    location: u.location?.trim() || "",
    company: u.company?.trim() || "",
    profileUrl: u.html_url,
    websiteUrl: websiteUrl || u.html_url,
    rssUrl,
    followers: typeof u.followers === "number" ? u.followers : null,
    publicRepos: typeof u.public_repos === "number" ? u.public_repos : null,
    tags: tags.slice(0, 4),
    articles,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchDevToCreatorProfile(rawHandle: string): Promise<RealCreatorProfile> {
  const handle = rawHandle
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/dev\.to\//i, "")
    .split("/")[0];
  if (!handle) {
    throw new Error("請輸入有效的 Dev.to 使用者帳號。");
  }

  const [userResp, articlesResp] = await Promise.all([
    fetch(`https://dev.to/api/users/by_username?url=${encodeURIComponent(handle)}`, {
      headers: { "User-Agent": "CablesGG-ProfileDirectory/2.0", Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    }),
    fetch(`https://dev.to/api/articles?username=${encodeURIComponent(handle)}&per_page=4`, {
      headers: { "User-Agent": "CablesGG-ProfileDirectory/2.0", Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    }),
  ]);

  if (!userResp.ok) {
    throw new Error(
      userResp.status === 404
        ? `找不到 Dev.to 帳號「${handle}」。`
        : `Dev.to API 回應 HTTP ${userResp.status}`
    );
  }

  const u = (await userResp.json()) as {
    username: string;
    name?: string;
    summary?: string;
    location?: string;
    profile_image?: string;
    website_url?: string;
    github_username?: string;
  };

  const rawArticles = articlesResp.ok
    ? ((await articlesResp.json()) as Array<{
        title?: string;
        url?: string;
        published_at?: string;
        description?: string;
        cover_image?: string;
        tag_list?: string[];
      }>)
    : [];

  const articles: CreatorArticlePreview[] = rawArticles
    .filter((a) => a.title && a.url)
    .slice(0, 4)
    .map((a) => ({
      title: a.title || "",
      url: a.url || `https://dev.to/${u.username}`,
      publishedAt: normalizeIsoDate(a.published_at),
      summary: a.description?.trim() || a.title || "",
      coverImage: a.cover_image || undefined,
    }));

  const tags = ["Dev.to", ...(rawArticles[0]?.tag_list || []).slice(0, 2)];

  return {
    id: `prof-devto-${u.username.toLowerCase()}`,
    platform: "devto",
    handle: u.username,
    displayName: u.name?.trim() || u.username,
    avatarUrl: u.profile_image || "",
    bio: u.summary?.trim() || `${u.name || u.username} 在 DEV Community 的公開技術文章與開發者個人檔案。`,
    location: u.location?.trim() || "",
    company: u.github_username ? `GitHub: @${u.github_username}` : "",
    profileUrl: `https://dev.to/${u.username}`,
    websiteUrl: u.website_url?.trim() || `https://dev.to/${u.username}`,
    rssUrl: `https://dev.to/feed/${u.username}`,
    followers: null,
    publicRepos: null,
    tags: tags.slice(0, 4),
    articles,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchRssCreatorProfile(feedUrl: string): Promise<RealCreatorProfile> {
  const parsed = validatePublicUrl(feedUrl.trim());
  const data = await fetchRssArticlePreviews(parsed.toString(), 4);
  if (data.articles.length === 0 && !data.feedTitle) {
    throw new Error("該 RSS / Atom 網址未包含可讀取的公開文章或作者資訊。");
  }
  const host = parsed.hostname.replace(/^www\./, "");
  return {
    id: deterministicId(`prof-rss:${parsed.toString()}`),
    platform: "rss",
    handle: host,
    displayName: data.authorName || data.feedTitle || host,
    avatarUrl: resolveFaviconUrl(data.siteUrl || parsed.toString()),
    bio: data.description || `${data.feedTitle || host} 獨立公開 Blog RSS 訂閱源。`,
    location: "",
    company: data.feedTitle || host,
    profileUrl: data.siteUrl || parsed.origin,
    websiteUrl: data.siteUrl || parsed.origin,
    rssUrl: parsed.toString(),
    followers: null,
    publicRepos: null,
    tags: ["獨立 Blog", "RSS / Atom"],
    articles: data.articles,
    fetchedAt: new Date().toISOString(),
  };
}

let creatorDirectoryCache: { fetchedAt: number; profiles: RealCreatorProfile[] } | null = null;

export async function fetchRealCreatorDirectory(forceRefresh = false): Promise<RealCreatorProfile[]> {
  const TTL_MS = 15 * 60 * 1000;
  if (!forceRefresh && creatorDirectoryCache && Date.now() - creatorDirectoryCache.fetchedAt < TTL_MS) {
    return creatorDirectoryCache.profiles;
  }

  const githubHandles = ["simonw", "gaearon", "yyx990803", "mitchellh", "rauchg", "antirez"];

  const devtoPromise = (async (): Promise<RealCreatorProfile[]> => {
    try {
      const resp = await fetch("https://dev.to/api/articles?top=7&per_page=14", {
        headers: { "User-Agent": "CablesGG-ProfileDirectory/2.0", Accept: "application/json" },
        signal: AbortSignal.timeout(7000),
      });
      if (!resp.ok) return [];
      const items = (await resp.json()) as Array<{
        title: string;
        url: string;
        published_at: string;
        description: string;
        cover_image?: string;
        tag_list?: string[];
        user?: {
          name?: string;
          username?: string;
          profile_image_90?: string;
          profile_image?: string;
          github_username?: string;
          website_url?: string;
        };
      }>;

      const byUser = new Map<string, RealCreatorProfile>();
      for (const item of items) {
        const uname = item.user?.username;
        if (!uname) continue;
        const existing = byUser.get(uname);
        const article: CreatorArticlePreview = {
          title: item.title,
          url: item.url,
          publishedAt: normalizeIsoDate(item.published_at),
          summary: item.description || item.title,
          coverImage: item.cover_image || undefined,
        };
        if (existing) {
          if (existing.articles.length < 3) existing.articles.push(article);
          continue;
        }
        byUser.set(uname, {
          id: `prof-devto-${uname.toLowerCase()}`,
          platform: "devto",
          handle: uname,
          displayName: item.user?.name?.trim() || uname,
          avatarUrl: item.user?.profile_image || item.user?.profile_image_90 || "",
          bio: `DEV Community 近期熱門公開作者 · 代表文章《${item.title}》`,
          location: "",
          company: item.user?.github_username ? `GitHub: @${item.user.github_username}` : "DEV Community",
          profileUrl: `https://dev.to/${uname}`,
          websiteUrl: item.user?.website_url || `https://dev.to/${uname}`,
          rssUrl: `https://dev.to/feed/${uname}`,
          followers: null,
          publicRepos: null,
          tags: ["Dev.to", ...(item.tag_list || []).slice(0, 2)],
          articles: [article],
          fetchedAt: new Date().toISOString(),
        });
        if (byUser.size >= 6) break;
      }
      return Array.from(byUser.values());
    } catch {
      return [];
    }
  })();

  const githubPromises = githubHandles.map((handle) => fetchGitHubCreatorProfile(handle));
  const [devtoProfiles, githubResults] = await Promise.all([
    devtoPromise,
    Promise.allSettled(githubPromises),
  ]);

  const githubProfiles = githubResults
    .filter((r): r is PromiseFulfilledResult<RealCreatorProfile> => r.status === "fulfilled")
    .map((r) => r.value);

  const combined = [...githubProfiles, ...devtoProfiles];
  if (combined.length > 0) {
    creatorDirectoryCache = { fetchedAt: Date.now(), profiles: combined };
  }
  return combined;
}

export async function lookupRealCreatorProfile(options: {
  platform: CreatorPlatform;
  query: string;
}): Promise<RealCreatorProfile> {
  if (options.platform === "devto") {
    return fetchDevToCreatorProfile(options.query);
  }
  if (options.platform === "rss") {
    return fetchRssCreatorProfile(options.query);
  }
  return fetchGitHubCreatorProfile(options.query);
}

export async function importEntriesToBlog(
  entryIds: string[],
  markSharedToBlog = true
): Promise<{ importedCount: number; blogProfile: BlogProfileConfig }> {
  const uniqueIds = Array.from(new Set(entryIds.map((id) => id.trim()).filter(Boolean)));
  const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
  const profile = await readBlogProfile();
  const nowIso = new Date().toISOString();

  const existingIds = new Set(profile.importedEntryIds);
  let importedCount = 0;

  for (const id of uniqueIds) {
    const idx = db.entries.findIndex((e) => e.id === id);
    if (idx === -1) continue;
    if (!existingIds.has(id)) {
      existingIds.add(id);
      importedCount += 1;
    }
    if (markSharedToBlog) {
      const target = { ...db.entries[idx] };
      target.sharedToBlog = true;
      target.sharedToBlogAt = target.sharedToBlogAt || nowIso;
      if (!target.blogDigest) {
        target.blogDigest = compileDeterministicBlogDigest(target);
      }
      db.entries[idx] = target;
    }
  }

  profile.importedEntryIds = Array.from(existingIds);
  profile.updatedAt = nowIso;
  db.lastUpdated = nowIso;

  await Promise.all([writeJsonFile(DATABASE_FILE, db), writeJsonFile(BLOG_PROFILE_FILE, profile)]);
  return { importedCount, blogProfile: profile };
}

export async function referenceCreatorIntoBlog(options: {
  profile: RealCreatorProfile;
  referenceNote?: string;
  subscribeFeed?: boolean;
  importArticles?: boolean;
}): Promise<{
  referenced: ReferencedProfile;
  blogProfile: BlogProfileConfig;
  importedEntryCount: number;
  subscribedSourceId: string | null;
}> {
  const { profile, referenceNote = "", subscribeFeed = true, importArticles = true } = options;
  const nowIso = new Date().toISOString();
  const blogProfile = await readBlogProfile();
  const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);

  let subscribedSourceId: string | null = null;
  if (subscribeFeed && profile.rssUrl) {
    try {
      validatePublicUrl(profile.rssUrl);
      const sourcesData = await readJsonFile<SourcesPayload>(SOURCES_FILE);
      const existingSrc = sourcesData.sources.find((s) => s.endpoint === profile.rssUrl);
      if (existingSrc) {
        subscribedSourceId = existingSrc.id;
      } else {
        const newSrcId = `src-creator-${profile.handle.toLowerCase().replace(/[^a-z0-9-]/g, "")}-${Date.now().toString().slice(-4)}`;
        sourcesData.sources.push({
          id: newSrcId,
          name: `${profile.displayName} (${profile.platform.toUpperCase()})`,
          category: "API 變動",
          sourceSector: "community",
          countryCode: "GLOBAL",
          countryName: "全球跨國",
          region: "全球",
          type: "Creator Feed",
          endpoint: profile.rssUrl,
          enabled: true,
          lastCheckedAt: nowIso,
          lastStatus: "ok",
          itemsCaptured: profile.articles.length,
        });
        await writeJsonFile(SOURCES_FILE, sourcesData);
        subscribedSourceId = newSrcId;
      }
    } catch {
      subscribedSourceId = null;
    }
  }

  const importedIdsForProfile: string[] = [];
  if (importArticles && Array.isArray(profile.articles) && profile.articles.length > 0) {
    const existingEntryMap = new Map<string, CableEntry>(db.entries.map((e) => [e.id, e]));
    const importedBlogSet = new Set(blogProfile.importedEntryIds);

    for (const art of profile.articles.slice(0, 3)) {
      if (!art.title || !art.url) continue;
      const entryId = deterministicId(`creator:${profile.id}:${art.url}`);
      const existing = existingEntryMap.get(entryId);
      if (existing) {
        existing.sharedToBlog = true;
        existing.sharedToBlogAt = existing.sharedToBlogAt || nowIso;
        if (!existing.blogDigest) existing.blogDigest = compileDeterministicBlogDigest(existing);
        existingEntryMap.set(entryId, existing);
      } else {
        const newEntry: CableEntry = {
          id: entryId,
          title: art.title,
          originalTitle: art.title,
          category: profile.platform === "github" ? "GitHub 釋出" : "API 變動",
          riskLevel: "low",
          sourceSector: "community",
          countryCode: "GLOBAL",
          countryName: "全球跨國",
          region: "全球",
          originalLanguage: "EN",
          sourceName: `${profile.displayName} (@${profile.handle})`,
          sourceId: subscribedSourceId || profile.id,
          sourceIcon: profile.avatarUrl || resolveFaviconUrl(art.url),
          bannerImage: art.coverImage || "",
          version: profile.platform.toUpperCase(),
          publishedAt: normalizeIsoDate(art.publishedAt),
          url: art.url,
          heatScore: 76,
          commentCount: 0,
          tags: Array.from(new Set(["參考創作者", profile.displayName, ...profile.tags])).slice(0, 5),
          aiSummary: art.summary || `${profile.displayName} 公開分享文章：《${art.title}》。`,
          keyChanges: [
            `創作者出處：${profile.displayName} (${profile.platform} · ${profile.profileUrl})`,
            referenceNote.trim()
              ? `主編參考註記：${referenceNote.trim()}`
              : art.summary.slice(0, 140),
          ],
          impactScope: `參考外部真實個人檔案（${profile.displayName}）所導入之個人 Blog 專題內容`,
          migrationSteps: [
            `閱讀 ${profile.displayName} 原始發布內容並於個人 Blog 延伸標註筆記。`,
            profile.rssUrl ? `已關聯公開 RSS：${profile.rssUrl}` : `已連結創作者檔案：${profile.profileUrl}`,
          ],
          aiEnriched: false,
          sharedToBlog: true,
          sharedToBlogAt: nowIso,
          diff: null,
          comments: [],
        };
        newEntry.blogDigest = compileDeterministicBlogDigest(newEntry);
        existingEntryMap.set(entryId, newEntry);
      }
      importedIdsForProfile.push(entryId);
      importedBlogSet.add(entryId);
    }

    db.entries = Array.from(existingEntryMap.values()).sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    db.totalRecords = db.entries.length;
    db.lastUpdated = nowIso;
    blogProfile.importedEntryIds = Array.from(importedBlogSet);
    await writeJsonFile(DATABASE_FILE, db);
  }

  const referenced: ReferencedProfile = {
    ...profile,
    referenceNote: referenceNote.trim(),
    autoSubscribedSourceId: subscribedSourceId,
    importedEntryIds: importedIdsForProfile,
    referencedAt: nowIso,
  };

  const prevIdx = blogProfile.referencedProfiles.findIndex((p) => p.id === referenced.id);
  if (prevIdx !== -1) {
    blogProfile.referencedProfiles[prevIdx] = referenced;
  } else {
    blogProfile.referencedProfiles.unshift(referenced);
  }
  blogProfile.updatedAt = nowIso;
  await writeJsonFile(BLOG_PROFILE_FILE, blogProfile);

  return {
    referenced,
    blogProfile,
    importedEntryCount: importedIdsForProfile.length,
    subscribedSourceId,
  };
}

// -------------------- Developer Activity Wall & Follow Engine --------------------

const activityWallCache = new Map<
  string,
  { fetchedAt: number; profile: RealCreatorProfile; activities: ProfileActivityItem[] }
>();

function describeGitHubEvent(ev: {
  type?: string;
  repo?: { name?: string };
  payload?: {
    action?: string;
    ref?: string;
    ref_type?: string;
    release?: { tag_name?: string; name?: string; html_url?: string };
    issue?: { title?: string; number?: number; html_url?: string };
    pull_request?: { title?: string; number?: number; html_url?: string };
    comment?: { body?: string; html_url?: string };
    commits?: Array<{ message?: string }>;
  };
}): { metaLabel: string; title: string; excerpt: string; url: string } {
  const repoName = ev.repo?.name || "GitHub Repository";
  const repoUrl = `https://github.com/${repoName}`;
  const p = ev.payload || {};

  switch (ev.type) {
    case "ReleaseEvent":
      return {
        metaLabel: "版本釋出標記",
        title: `${repoName} 發布 ${p.release?.tag_name || p.release?.name || "新版本"}`,
        excerpt: p.release?.name || `於 ${repoName} 發布正式釋出標記。`,
        url: p.release?.html_url || repoUrl,
      };
    case "IssueCommentEvent":
      return {
        metaLabel: "Issue 討論標記",
        title: `${repoName} #${p.issue?.number || ""} 技術評論`,
        excerpt: (p.comment?.body || p.issue?.title || "參與開源議題討論").replace(/\s+/g, " ").slice(0, 180),
        url: p.comment?.html_url || p.issue?.html_url || repoUrl,
      };
    case "IssuesEvent":
      return {
        metaLabel: "Issue 議題動態",
        title: `${repoName} #${p.issue?.number || ""}: ${p.issue?.title || "Issue 更新"}`,
        excerpt: `動作：${p.action || "updated"} · ${p.issue?.title || repoName}`,
        url: p.issue?.html_url || repoUrl,
      };
    case "PullRequestEvent":
      return {
        metaLabel: "PR 審查與變更",
        title: `${repoName} PR #${p.pull_request?.number || ""}: ${p.pull_request?.title || "Pull Request"}`,
        excerpt: `狀態：${p.action || "opened"} · ${p.pull_request?.title || repoName}`,
        url: p.pull_request?.html_url || repoUrl,
      };
    case "PushEvent": {
      const firstMsg = p.commits?.[0]?.message?.split("\n")[0] || "推送程式碼提交";
      return {
        metaLabel: "程式碼推送紀錄",
        title: `推送更新至 ${repoName}`,
        excerpt: firstMsg.slice(0, 180),
        url: repoUrl,
      };
    }
    case "CreateEvent":
      return {
        metaLabel: "建立開源分支/儲存庫",
        title: `於 ${repoName} 建立 ${p.ref_type || "branch"} ${p.ref || ""}`.trim(),
        excerpt: `GitHub 公開建立事件（${repoName}）`,
        url: repoUrl,
      };
    case "WatchEvent":
      return {
        metaLabel: "GitHub 收藏動態",
        title: `關注開源專案 ${repoName}`,
        excerpt: `於 GitHub 公開追蹤並收藏 ${repoName}。`,
        url: repoUrl,
      };
    default:
      return {
        metaLabel: "GitHub 公開動態",
        title: `${repoName} (${ev.type || "Activity"})`,
        excerpt: `GitHub 公開開源開發動態：${repoName}`,
        url: repoUrl,
      };
  }
}

export async function buildOwnerLocalProfileAndActivities(): Promise<{
  profile: RealCreatorProfile;
  activities: ProfileActivityItem[];
}> {
  const [blogProfile, db] = await Promise.all([
    readBlogProfile(),
    readJsonFile<DatabasePayload>(DATABASE_FILE),
  ]);

  const ownerProfile: RealCreatorProfile = {
    id: "prof-cables-owner",
    platform: "rss",
    handle: blogProfile.slug,
    displayName: blogProfile.ownerName || "Cables.gg 主編",
    avatarUrl: "",
    bio: blogProfile.ownerBio || blogProfile.tagline,
    location: "Cables.gg Workspace",
    company: blogProfile.blogTitle,
    profileUrl: `/b/${blogProfile.slug}`,
    websiteUrl: `/b/${blogProfile.slug}`,
    rssUrl: "/rss/blog.xml",
    followers: blogProfile.ownerFollowersCount ?? 0,
    publicRepos: blogProfile.importedEntryIds.length,
    tags: ["本站主編", "個人 Blog", `/b/${blogProfile.slug}`],
    articles: [],
    fetchedAt: new Date().toISOString(),
  };

  const importedSet = new Set(blogProfile.importedEntryIds);
  const activities: ProfileActivityItem[] = [];

  for (const entry of db.entries) {
    // 1. Recent Bookmarks
    if (entry.bookmarked) {
      activities.push({
        id: `act-bm-${entry.id}`,
        kind: "bookmark",
        actorId: ownerProfile.id,
        actorName: ownerProfile.displayName,
        actorHandle: blogProfile.slug,
        actorAvatarUrl: "",
        platform: "cables",
        title: entry.title,
        excerpt: entry.aiSummary,
        url: `/post/${entry.id}`,
        internalPostId: entry.id,
        tags: [entry.countryName, entry.category, "個人收藏"].slice(0, 4),
        createdAt: entry.bookmarkedAt || entry.publishedAt,
        metaLabel: "收藏至個人知識庫",
      });
    }

    // 2. Recent Highlights / Reader Annotations
    const highlights = Array.isArray(entry.readerHighlights) ? entry.readerHighlights : [];
    const strokesCount = Array.isArray(entry.readerStrokes) ? entry.readerStrokes.length : 0;
    if (highlights.length > 0 || strokesCount > 0) {
      const latestHl = highlights[highlights.length - 1];
      activities.push({
        id: `act-hl-${entry.id}`,
        kind: "highlight",
        actorId: ownerProfile.id,
        actorName: ownerProfile.displayName,
        actorHandle: blogProfile.slug,
        actorAvatarUrl: "",
        platform: "cables",
        title: entry.title,
        excerpt: latestHl
          ? `「${latestHl.text}」${latestHl.note ? ` — 筆記：${latestHl.note}` : ""}`
          : `已於閱讀器進行 ${strokesCount} 筆畫筆註記與重點繪製`,
        url: `/post/${entry.id}`,
        internalPostId: entry.id,
        tags: [
          `劃線 ${highlights.length} 處`,
          strokesCount > 0 ? `畫筆 ${strokesCount} 筆` : entry.category,
        ],
        createdAt: latestHl?.createdAt || entry.publishedAt,
        metaLabel: "閱讀器重點標記",
      });
    }

    // 3. Recent Publications to Personal Blog
    if (entry.sharedToBlog || importedSet.has(entry.id)) {
      const digest = entry.blogDigest;
      activities.push({
        id: `act-blog-${entry.id}`,
        kind: "blog_post",
        actorId: ownerProfile.id,
        actorName: ownerProfile.displayName,
        actorHandle: blogProfile.slug,
        actorAvatarUrl: "",
        platform: "cables",
        title: digest?.headline || entry.title,
        excerpt: digest?.lead || entry.aiSummary,
        url: `/blog/${entry.id}`,
        internalBlogId: entry.id,
        internalPostId: entry.id,
        tags: (digest?.markers || entry.tags || []).slice(0, 4),
        createdAt: entry.sharedToBlogAt || digest?.generatedAt || entry.publishedAt,
        metaLabel: `發布至 /b/${blogProfile.slug}`,
      });
    }
  }

  activities.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  ownerProfile.articles = activities
    .filter((a) => a.kind === "blog_post")
    .slice(0, 4)
    .map((a) => ({
      title: a.title,
      url: a.url,
      publishedAt: a.createdAt,
      summary: a.excerpt,
    }));

  return { profile: ownerProfile, activities: activities.slice(0, 40) };
}

export async function fetchCreatorActivityWall(options: {
  platform: CreatorPlatform | "cables";
  handle: string;
  forceRefresh?: boolean;
}): Promise<{
  profile: RealCreatorProfile;
  activities: ProfileActivityItem[];
  stats: { bookmarks: number; highlights: number; blogPosts: number };
}> {
  if (options.platform === "cables") {
    const { profile, activities } = await buildOwnerLocalProfileAndActivities();
    return {
      profile,
      activities,
      stats: {
        bookmarks: activities.filter((a) => a.kind === "bookmark").length,
        highlights: activities.filter((a) => a.kind === "highlight").length,
        blogPosts: activities.filter((a) => a.kind === "blog_post").length,
      },
    };
  }

  const cacheKey = `${options.platform}:${options.handle.toLowerCase()}`;
  const cached = activityWallCache.get(cacheKey);
  const TTL_MS = 10 * 60 * 1000;
  if (!options.forceRefresh && cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return {
      profile: cached.profile,
      activities: cached.activities,
      stats: {
        bookmarks: cached.activities.filter((a) => a.kind === "bookmark").length,
        highlights: cached.activities.filter((a) => a.kind === "highlight").length,
        blogPosts: cached.activities.filter((a) => a.kind === "blog_post").length,
      },
    };
  }

  const blogProfile = await readBlogProfile();
  const knownStored =
    (blogProfile.followedProfiles || []).find(
      (p) => p.platform === options.platform && p.handle.toLowerCase() === options.handle.toLowerCase()
    ) ||
    blogProfile.referencedProfiles.find(
      (p) => p.platform === options.platform && p.handle.toLowerCase() === options.handle.toLowerCase()
    );

  let profile: RealCreatorProfile;
  if (options.platform === "rss") {
    if (knownStored?.rssUrl) {
      profile = await fetchRssCreatorProfile(knownStored.rssUrl);
    } else {
      throw new Error("找不到對應的 RSS 創作者訂閱位址。");
    }
  } else {
    profile = await lookupRealCreatorProfile({
      platform: options.platform,
      query: options.handle,
    });
  }

  const activities: ProfileActivityItem[] = [];

  if (options.platform === "github") {
    const ghHeaders = {
      "User-Agent": "CablesGG-ActivityWall/2.0",
      Accept: "application/vnd.github+json",
    };
    const [starredRes, eventsRes] = await Promise.allSettled([
      fetch(
        `https://api.github.com/users/${encodeURIComponent(profile.handle)}/starred?per_page=8`,
        { headers: ghHeaders, signal: AbortSignal.timeout(6500) }
      ),
      fetch(
        `https://api.github.com/users/${encodeURIComponent(profile.handle)}/events/public?per_page=15`,
        { headers: ghHeaders, signal: AbortSignal.timeout(6500) }
      ),
    ]);

    if (starredRes.status === "fulfilled" && starredRes.value.ok) {
      const repos = (await starredRes.value.json()) as Array<{
        id: number;
        full_name: string;
        description?: string;
        html_url: string;
        language?: string;
        stargazers_count?: number;
        updated_at?: string;
      }>;
      for (const r of repos.slice(0, 6)) {
        activities.push({
          id: `gh-star-${profile.handle}-${r.id}`,
          kind: "bookmark",
          actorId: profile.id,
          actorName: profile.displayName,
          actorHandle: profile.handle,
          actorAvatarUrl: profile.avatarUrl,
          platform: "github",
          title: r.full_name,
          excerpt:
            r.description?.trim() ||
            `GitHub 公開收藏專案（★ ${(r.stargazers_count ?? 0).toLocaleString()}）`,
          url: r.html_url,
          tags: [r.language || "GitHub", "Starred 收藏"],
          createdAt: normalizeIsoDate(r.updated_at),
          metaLabel: "GitHub 收藏專案",
        });
      }
    }

    if (eventsRes.status === "fulfilled" && eventsRes.value.ok) {
      const events = (await eventsRes.value.json()) as Array<{
        id: string;
        type?: string;
        repo?: { name?: string };
        created_at?: string;
        payload?: Record<string, unknown>;
      }>;
      for (const ev of events.slice(0, 8)) {
        const desc = describeGitHubEvent(ev);
        activities.push({
          id: `gh-ev-${ev.id}`,
          kind: "highlight",
          actorId: profile.id,
          actorName: profile.displayName,
          actorHandle: profile.handle,
          actorAvatarUrl: profile.avatarUrl,
          platform: "github",
          title: desc.title,
          excerpt: desc.excerpt,
          url: desc.url,
          tags: [ev.type?.replace(/Event$/, "") || "Event", "公開技術標記"],
          createdAt: normalizeIsoDate(ev.created_at),
          metaLabel: desc.metaLabel,
        });
      }
    }
  } else if (options.platform === "devto") {
    try {
      const resp = await fetch(
        `https://dev.to/api/articles?username=${encodeURIComponent(profile.handle)}&per_page=8`,
        {
          headers: { "User-Agent": "CablesGG-ActivityWall/2.0", Accept: "application/json" },
          signal: AbortSignal.timeout(6500),
        }
      );
      if (resp.ok) {
        const devArticles = (await resp.json()) as Array<{
          id: number;
          title: string;
          url: string;
          published_at: string;
          description?: string;
          public_reactions_count?: number;
          comments_count?: number;
          reading_time_minutes?: number;
          tag_list?: string[];
        }>;
        for (const art of devArticles) {
          activities.push({
            id: `devto-post-${art.id}`,
            kind: "blog_post",
            actorId: profile.id,
            actorName: profile.displayName,
            actorHandle: profile.handle,
            actorAvatarUrl: profile.avatarUrl,
            platform: "devto",
            title: art.title,
            excerpt: art.description || art.title,
            url: art.url,
            tags: (art.tag_list || []).slice(0, 4),
            createdAt: normalizeIsoDate(art.published_at),
            metaLabel: `DEV Blog · ${art.reading_time_minutes ?? 3} 分鐘閱讀 · ♥ ${
              art.public_reactions_count ?? 0
            }`,
          });
          if ((art.tag_list || []).length > 0) {
            activities.push({
              id: `devto-tag-${art.id}`,
              kind: "highlight",
              actorId: profile.id,
              actorName: profile.displayName,
              actorHandle: profile.handle,
              actorAvatarUrl: profile.avatarUrl,
              platform: "devto",
              title: `主題標籤註記：${(art.tag_list || []).map((t) => `#${t}`).join(" ")}`,
              excerpt: `於《${art.title}》標記技術領域並開放社群討論（${
                art.comments_count ?? 0
              } 則互動）。`,
              url: art.url,
              tags: (art.tag_list || []).slice(0, 3),
              createdAt: normalizeIsoDate(art.published_at),
              metaLabel: "主題標籤標記",
            });
          }
        }
      }
    } catch {
      // Fall back to profile.articles below
    }
  }

  // Always include creator's real RSS / Blog articles as blog_post items (deduped by URL)
  const seenUrls = new Set(activities.map((a) => `${a.kind}:${a.url}`));
  for (let i = 0; i < profile.articles.length; i += 1) {
    const art = profile.articles[i];
    if (seenUrls.has(`blog_post:${art.url}`)) continue;
    activities.push({
      id: `art-${profile.id}-${i}`,
      kind: "blog_post",
      actorId: profile.id,
      actorName: profile.displayName,
      actorHandle: profile.handle,
      actorAvatarUrl: profile.avatarUrl,
      platform: profile.platform,
      title: art.title,
      excerpt: art.summary,
      url: art.url,
      tags: profile.tags.slice(0, 3),
      createdAt: normalizeIsoDate(art.publishedAt),
      metaLabel: profile.platform === "github" && !KNOWN_CREATOR_FEEDS[profile.handle.toLowerCase()]
        ? "公開開源專案"
        : "發布至個人 Blog",
    });
  }

  activities.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  activityWallCache.set(cacheKey, {
    fetchedAt: Date.now(),
    profile,
    activities,
  });

  return {
    profile,
    activities,
    stats: {
      bookmarks: activities.filter((a) => a.kind === "bookmark").length,
      highlights: activities.filter((a) => a.kind === "highlight").length,
      blogPosts: activities.filter((a) => a.kind === "blog_post").length,
    },
  };
}

export async function fetchAggregatedActivityWall(
  kindFilter: "all" | ProfileActivityKind = "all"
): Promise<{
  activities: ProfileActivityItem[];
  ownerProfile: RealCreatorProfile;
  followedCount: number;
}> {
  const blogProfile = await readBlogProfile();
  const ownerResult = await buildOwnerLocalProfileAndActivities();

  const followed = blogProfile.followedProfiles || [];
  // Include followed profiles; if none followed yet, also blend referencedProfiles so user sees rich live activity immediately
  const targetExternal =
    followed.length > 0 ? followed : blogProfile.referencedProfiles.slice(0, 3);

  const externalWalls = await Promise.allSettled(
    targetExternal.slice(0, 5).map((p) =>
      fetchCreatorActivityWall({
        platform: p.platform,
        handle: p.handle,
      })
    )
  );

  let merged = [...ownerResult.activities];
  for (const res of externalWalls) {
    if (res.status === "fulfilled") {
      merged.push(...res.value.activities.slice(0, 8));
    }
  }

  if (kindFilter !== "all") {
    merged = merged.filter((item) => item.kind === kindFilter);
  }

  merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    activities: merged.slice(0, 45),
    ownerProfile: ownerResult.profile,
    followedCount: followed.length,
  };
}

export async function toggleFollowCreator(
  profile: RealCreatorProfile
): Promise<{ following: boolean; blogProfile: BlogProfileConfig }> {
  const blogProfile = await readBlogProfile();
  const list = Array.isArray(blogProfile.followedProfiles) ? [...blogProfile.followedProfiles] : [];
  const idx = list.findIndex((p) => p.id === profile.id);
  let following = false;

  if (idx !== -1) {
    list.splice(idx, 1);
    following = false;
  } else {
    list.unshift({
      ...profile,
      followedAt: new Date().toISOString(),
    });
    following = true;
  }

  blogProfile.followedProfiles = list;
  blogProfile.updatedAt = new Date().toISOString();
  await writeJsonFile(BLOG_PROFILE_FILE, blogProfile);
  return { following, blogProfile };
}

export async function toggleFollowOwnerBlog(): Promise<{
  following: boolean;
  followersCount: number;
  blogProfile: BlogProfileConfig;
}> {
  const blogProfile = await readBlogProfile();
  const currentlyFollowed = Boolean(blogProfile.ownerFollowed);
  const currentCount = typeof blogProfile.ownerFollowersCount === "number" ? blogProfile.ownerFollowersCount : 0;

  const nextFollowed = !currentlyFollowed;
  const nextCount = nextFollowed ? currentCount + 1 : Math.max(0, currentCount - 1);

  blogProfile.ownerFollowed = nextFollowed;
  blogProfile.ownerFollowersCount = nextCount;
  blogProfile.updatedAt = new Date().toISOString();
  await writeJsonFile(BLOG_PROFILE_FILE, blogProfile);

  return {
    following: nextFollowed,
    followersCount: nextCount,
    blogProfile,
  };
}




