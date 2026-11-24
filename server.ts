import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import {
  BLOG_PROFILE_FILE,
  COUNTRY_META,
  DATABASE_FILE,
  N8N_FILE,
  SOURCES_FILE,
  SUBSCRIPTIONS_FILE,
  batchEnrichEntriesWithGemini,
  buildTemplatePayloadForEntries,
  compileCuratedBlogHtml,
  compileDeterministicBlogDigest,
  crawlAllSources,
  crawlSingleSourceItems,
  dispatchToSingleN8nWebhook,
  enrichSingleEntryWithGemini,
  fetchAndExtractWebContent,
  fetchAggregatedActivityWall,
  fetchCreatorActivityWall,
  fetchFullArticleForReader,
  fetchRealCreatorDirectory,
  importEntriesToBlog,
  inferSourceSector,
  locateCountryFromCoordsOrTimezone,
  lookupRealCreatorProfile,
  normalizeBlogSlug,
  normalizeCategory,
  normalizeCountry,
  normalizeRegion,
  readBlogProfile,
  readJsonFile,
  referenceCreatorIntoBlog,
  summarizeAndSaveEntry,
  toggleFollowCreator,
  toggleFollowOwnerBlog,
  transformEntryToBlogDigestWithGemini,
  validatePublicUrl,
  writeJsonFile,
  type BlogLayoutTemplate,
  type CableCategory,
  type CableEntry,
  type CommentItem,
  type CountryCode,
  type CreatorPlatform,
  type DatabasePayload,
  type N8nPayload,
  type N8nTemplateFormat,
  type N8nWebhookConfig,
  type ProfileActivityKind,
  type ReaderHighlight,
  type ReaderStroke,
  type RealCreatorProfile,
  type SourceItem,
  type SourceSector,
  type SourcesPayload,
} from "./server/crawlerEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SubscriptionItem {
  id: string;
  email: string;
  scope: "high_risk_only" | "all";
  createdAt: string;
  active: boolean;
}

interface SubscriptionsPayload {
  lastUpdated: string;
  subscribers: SubscriptionItem[];
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

let isAutoCrawling = false;

async function runScheduledCheckIfDue() {
  if (isAutoCrawling) return;
  try {
    const sourcesData = await readJsonFile<SourcesPayload>(SOURCES_FILE);
    if (!sourcesData.pipeline.autoEnabled) return;

    const nextMs = new Date(sourcesData.pipeline.nextRunAt || 0).getTime();
    if (!Number.isNaN(nextMs) && Date.now() >= nextMs) {
      isAutoCrawling = true;
      await crawlAllSources({
        trigger: "排班自動同步推播",
        countryFilter: "ALL",
        limitPerSource: 3,
        enrichWithAi: Boolean(process.env.GEMINI_API_KEY),
      });
    }
  } catch (err) {
    console.warn("[Cables.gg] Scheduled auto-crawl check error:", err);
  } finally {
    isAutoCrawling = false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Read full database.json (also CORS-enabled for external read-only blog widgets)
  app.get("/api/database", async (_req, res) => {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      res.json(db);
    } catch (error) {
      console.error("Failed to read database.json:", error);
      res.status(500).json({ error: "無法讀取 database.json 資料檔案。" });
    }
  });

  // Read single entry by ID
  app.get("/api/database/:id", async (req, res) => {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const entry = db.entries.find((item) => item.id === req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "找不到指定的異動索引項目。" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Failed to read entry:", error);
      res.status(500).json({ error: "讀取項目詳細內容失敗。" });
    }
  });

  // AI enrich/translate an existing database entry via Gemini
  app.post("/api/database/:id/enrich", async (req, res) => {
    try {
      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const idx = db.entries.findIndex((item) => item.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ error: "找不到指定的索引項目。" });
      }

      const updated = await enrichSingleEntryWithGemini({ ...db.entries[idx] });
      db.entries[idx] = updated;
      db.lastUpdated = new Date().toISOString();
      await writeJsonFile(DATABASE_FILE, db);

      res.json(updated);
    } catch (error) {
      console.error("AI enrich entry error:", error);
      const message =
        error instanceof Error ? error.message : "呼叫 Gemini AI 進行繁體中文深度分析失敗。";
      res.status(500).json({ error: message });
    }
  });

  // Transform entry into condensed personal Blog key-point digest + semantic markers
  app.post("/api/database/:id/transform-blog", async (req, res) => {
    try {
      const { useAi = true, tone = "editorial" } = (req.body || {}) as {
        useAi?: boolean;
        tone?: "editorial" | "brief" | "newsletter";
      };
      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const idx = db.entries.findIndex((item) => item.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ error: "找不到指定的索引項目。" });
      }

      const target = { ...db.entries[idx] };
      const updated: CableEntry = useAi
        ? await transformEntryToBlogDigestWithGemini(target, tone)
        : {
            ...target,
            sourceSector: inferSourceSector(target.sourceName, target.url, target.sourceSector),
            blogDigest: compileDeterministicBlogDigest(target),
          };

      db.entries[idx] = updated;
      db.lastUpdated = new Date().toISOString();
      await writeJsonFile(DATABASE_FILE, db);
      res.json(updated);
    } catch (error) {
      console.error("Transform blog digest error:", error);
      const message =
        error instanceof Error ? error.message : "轉換為個人 Blog 重點文章失敗。";
      res.status(500).json({ error: message });
    }
  });

  // Fetch full-length article paragraphs from original source URL (with optional Gemini ZH translation)
  app.get("/api/database/:id/full-article", async (req, res) => {
    try {
      const translateToZh = req.query.translate === "1";
      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const idx = db.entries.findIndex((item) => item.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ error: "找不到指定的文章項目。" });
      }

      const result = await fetchFullArticleForReader({ ...db.entries[idx] }, translateToZh);
      db.entries[idx] = {
        ...db.entries[idx],
        fullArticleBlocks: result.blocks,
        fullArticleFetchedAt: result.fetchedAt,
        fullArticleSourceMode: result.sourceMode,
      };
      db.lastUpdated = new Date().toISOString();
      await writeJsonFile(DATABASE_FILE, db);

      res.json(result);
    } catch (error) {
      console.error("Fetch full article error:", error);
      res.status(500).json({ error: "載入完整文章閱讀內容失敗。" });
    }
  });

  // Persist reader bookmarks (personal knowledge base), blog share status, highlights & pen strokes
  app.post("/api/database/:id/reader-actions", async (req, res) => {
    try {
      const { bookmarked, sharedToBlog, readerHighlights, readerStrokes } = (req.body || {}) as {
        bookmarked?: boolean;
        sharedToBlog?: boolean;
        readerHighlights?: ReaderHighlight[];
        readerStrokes?: ReaderStroke[];
      };

      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const idx = db.entries.findIndex((item) => item.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ error: "找不到指定的文章項目。" });
      }

      const target = { ...db.entries[idx] };
      const nowIso = new Date().toISOString();

      if (typeof bookmarked === "boolean") {
        target.bookmarked = bookmarked;
        target.bookmarkedAt = bookmarked ? nowIso : null;
      }

      if (typeof sharedToBlog === "boolean") {
        target.sharedToBlog = sharedToBlog;
        target.sharedToBlogAt = sharedToBlog ? nowIso : null;
        if (sharedToBlog && !target.blogDigest) {
          target.blogDigest = compileDeterministicBlogDigest(target);
        }
      }

      if (Array.isArray(readerHighlights)) {
        target.readerHighlights = readerHighlights.slice(0, 120);
      }

      if (Array.isArray(readerStrokes)) {
        target.readerStrokes = readerStrokes.slice(0, 200);
      }

      db.entries[idx] = target;
      db.lastUpdated = nowIso;
      await writeJsonFile(DATABASE_FILE, db);

      res.json(target);
    } catch (error) {
      console.error("Save reader actions error:", error);
      res.status(500).json({ error: "儲存閱讀標記或收藏狀態失敗。" });
    }
  });

  // Batch AI enrich/translate un-enriched foreign entries via Gemini
  app.post("/api/database/enrich-batch", async (req, res) => {
    try {
      const limit = Number((req.body as { limit?: number })?.limit) || 5;
      const result = await batchEnrichEntriesWithGemini(Math.min(Math.max(1, limit), 10));
      res.json(result);
    } catch (error) {
      console.error("Batch AI enrich error:", error);
      const message =
        error instanceof Error ? error.message : "批次呼叫 Gemini AI 進行繁體中文分析失敗。";
      res.status(500).json({ error: message });
    }
  });

  // Delete entry by ID from database.json
  app.delete("/api/database/:id", async (req, res) => {
    try {
      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const nextEntries = db.entries.filter((item) => item.id !== req.params.id);
      if (nextEntries.length === db.entries.length) {
        return res.status(404).json({ error: "找不到欲刪除的索引項目。" });
      }
      db.entries = nextEntries;
      db.totalRecords = nextEntries.length;
      db.lastUpdated = new Date().toISOString();
      await writeJsonFile(DATABASE_FILE, db);
      res.json({ deletedId: req.params.id, totalRecords: db.totalRecords });
    } catch (error) {
      console.error("Failed to delete entry:", error);
      res.status(500).json({ error: "刪除索引項目失敗。" });
    }
  });

  // Append lightweight discussion comment to entry
  app.post("/api/database/:id/comments", async (req, res) => {
    try {
      const { author, role, content } = req.body as {
        author?: string;
        role?: string;
        content?: string;
      };
      const trimmedContent = (content ?? "").trim();
      const trimmedAuthor = (author ?? "").trim() || "guest_dev";
      const trimmedRole = (role ?? "").trim() || "Developer";

      if (!trimmedContent) {
        return res.status(400).json({ error: "留言內容不可為空。" });
      }
      if (trimmedContent.length > 1000) {
        return res.status(400).json({ error: "留言長度不可超過 1000 字元。" });
      }

      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const index = db.entries.findIndex((item) => item.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ error: "找不到指定的討論項目。" });
      }

      const newComment: CommentItem = {
        id: `cmt-${Date.now()}`,
        author: trimmedAuthor.slice(0, 40),
        role: trimmedRole.slice(0, 40),
        createdAt: new Date().toISOString(),
        content: trimmedContent,
      };

      db.entries[index].comments.push(newComment);
      db.entries[index].commentCount = db.entries[index].comments.length;
      db.lastUpdated = new Date().toISOString();

      await writeJsonFile(DATABASE_FILE, db);
      res.status(201).json(newComment);
    } catch (error) {
      console.error("Failed to post comment:", error);
      res.status(500).json({ error: "寫入討論留言失敗。" });
    }
  });

  // Delete discussion comment from entry
  app.delete("/api/database/:id/comments/:commentId", async (req, res) => {
    try {
      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const index = db.entries.findIndex((item) => item.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ error: "找不到指定的討論項目。" });
      }
      const prevLen = db.entries[index].comments.length;
      db.entries[index].comments = db.entries[index].comments.filter(
        (c) => c.id !== req.params.commentId
      );
      if (db.entries[index].comments.length === prevLen) {
        return res.status(404).json({ error: "找不到指定的留言。" });
      }
      db.entries[index].commentCount = db.entries[index].comments.length;
      db.lastUpdated = new Date().toISOString();
      await writeJsonFile(DATABASE_FILE, db);
      res.json({ deletedCommentId: req.params.commentId });
    } catch (error) {
      console.error("Failed to delete comment:", error);
      res.status(500).json({ error: "刪除留言失敗。" });
    }
  });

  // Read sources.json
  app.get("/api/sources", async (_req, res) => {
    try {
      const sources = await readJsonFile<SourcesPayload>(SOURCES_FILE);
      res.json(sources);
    } catch (error) {
      console.error("Failed to read sources.json:", error);
      res.status(500).json({ error: "無法讀取 sources.json 設定檔案。" });
    }
  });

  // Toggle or update source
  app.patch("/api/sources/:id", async (req, res) => {
    try {
      const { enabled } = req.body as { enabled?: boolean };
      const data = await readJsonFile<SourcesPayload>(SOURCES_FILE);
      const idx = data.sources.findIndex((s) => s.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ error: "找不到指定的線纜來源。" });
      }
      if (typeof enabled === "boolean") {
        data.sources[idx].enabled = enabled;
      }
      await writeJsonFile(SOURCES_FILE, data);
      res.json(data.sources[idx]);
    } catch (error) {
      console.error("Failed to update source:", error);
      res.status(500).json({ error: "更新來源設定失敗。" });
    }
  });

  // Add new monitored source
  app.post("/api/sources", async (req, res) => {
    try {
      const { name, category, sourceSector, countryCode, region, type, endpoint } = req.body as {
        name?: string;
        category?: string;
        sourceSector?: string;
        countryCode?: string;
        region?: string;
        type?: string;
        endpoint?: string;
      };
      if (!name?.trim() || !endpoint?.trim()) {
        return res.status(400).json({ error: "來源名稱與端點 URL 為必填欄位。" });
      }
      validatePublicUrl(endpoint.trim());

      const validCategory = normalizeCategory(category, "自訂爬文");
      const validCountry = normalizeCountry(countryCode, "GLOBAL");
      const meta = COUNTRY_META[validCountry];
      const validRegion = normalizeRegion(region, meta.region);
      const validSector = inferSourceSector(
        name.trim(),
        endpoint.trim(),
        sourceSector === "official" || sourceSector === "community" ? sourceSector : undefined
      );

      const data = await readJsonFile<SourcesPayload>(SOURCES_FILE);
      const newSource: SourceItem = {
        id: `src-${Date.now()}`,
        name: name.trim(),
        category: validCategory,
        sourceSector: validSector,
        countryCode: validCountry,
        countryName: meta.name,
        region: validRegion,
        type: type?.trim() || "RSS / Atom",
        endpoint: endpoint.trim(),
        enabled: true,
        lastCheckedAt: new Date().toISOString(),
        lastStatus: "pending",
        itemsCaptured: 0,
      };
      data.sources.push(newSource);
      await writeJsonFile(SOURCES_FILE, data);
      res.status(201).json(newSource);
    } catch (error) {
      console.error("Failed to add source:", error);
      const message = error instanceof Error ? error.message : "新增監控來源失敗。";
      res.status(400).json({ error: message });
    }
  });

  // Delete a monitored source
  app.delete("/api/sources/:id", async (req, res) => {
    try {
      const data = await readJsonFile<SourcesPayload>(SOURCES_FILE);
      const nextSources = data.sources.filter((s) => s.id !== req.params.id);
      if (nextSources.length === data.sources.length) {
        return res.status(404).json({ error: "找不到欲刪除的線纜來源。" });
      }
      data.sources = nextSources;
      await writeJsonFile(SOURCES_FILE, data);
      res.json({ deletedId: req.params.id });
    } catch (error) {
      console.error("Failed to delete source:", error);
      res.status(500).json({ error: "刪除線纜來源失敗。" });
    }
  });

  // Live fetch latest items from a single monitored source in sources.json
  app.post("/api/sources/:id/fetch", async (req, res) => {
    try {
      const sourcesData = await readJsonFile<SourcesPayload>(SOURCES_FILE);
      const srcIdx = sourcesData.sources.findIndex((s) => s.id === req.params.id);
      if (srcIdx === -1) {
        return res.status(404).json({ error: "找不到指定的線纜來源。" });
      }
      const src = sourcesData.sources[srcIdx];
      const items = await crawlSingleSourceItems(src, 3);
      if (items.length === 0) {
        throw new Error("該來源目前沒有可擷取的新公開項目。");
      }

      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const existingMap = new Map<string, CableEntry>(db.entries.map((e) => [e.id, e]));
      let addedCount = 0;

      for (const item of items) {
        if (!existingMap.has(item.id)) {
          existingMap.set(item.id, item);
          addedCount += 1;
        }
      }

      const topItem = existingMap.get(items[0].id) || items[0];
      if (process.env.GEMINI_API_KEY && topItem.originalLanguage !== "ZH" && !topItem.aiEnriched) {
        try {
          const enriched = await enrichSingleEntryWithGemini(topItem);
          existingMap.set(enriched.id, enriched);
        } catch (aiErr) {
          console.warn("Single source AI enrich skipped:", aiErr);
        }
      }

      const merged = Array.from(existingMap.values()).sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      const nowIso = new Date().toISOString();
      db.entries = merged;
      db.totalRecords = merged.length;
      db.lastUpdated = nowIso;
      await writeJsonFile(DATABASE_FILE, db);

      sourcesData.sources[srcIdx].lastCheckedAt = nowIso;
      sourcesData.sources[srcIdx].lastStatus = "ok";
      sourcesData.sources[srcIdx].itemsCaptured += addedCount;
      sourcesData.syncLogs.unshift({
        id: `log-${Date.now()}`,
        timestamp: nowIso,
        trigger: `單一來源即時抓取 (${src.name})`,
        status: "success",
        sourcesChecked: 1,
        newEntries: addedCount,
        durationSeconds: 1.0,
        commitSha: "live-fetch",
        message: `已從 ${src.name} (${src.countryName}) 即時抓取 ${items.length} 筆，新增 ${addedCount} 筆索引。`,
      });
      sourcesData.syncLogs = sourcesData.syncLogs.slice(0, 30);
      await writeJsonFile(SOURCES_FILE, sourcesData);

      res.status(201).json(existingMap.get(items[0].id) || items[0]);
    } catch (error) {
      console.error("Source live fetch failed:", error);
      const message = error instanceof Error ? error.message : "即時擷取該來源失敗。";
      res.status(500).json({ error: message });
    }
  });

  // Full live crawl across ALL countries or selected country
  app.post("/api/crawl-all", async (req, res) => {
    try {
      const { countryCode, enrichWithAi, limitPerSource } = (req.body || {}) as {
        countryCode?: string;
        enrichWithAi?: boolean;
        limitPerSource?: number;
      };
      const filter: CountryCode | "ALL" =
        countryCode && countryCode !== "ALL"
          ? normalizeCountry(countryCode, "GLOBAL")
          : "ALL";

      const result = await crawlAllSources({
        trigger: filter === "ALL" ? "手動全國家即時爬蟲" : `手動國家爬蟲 (${filter})`,
        countryFilter: filter,
        limitPerSource: limitPerSource ?? 3,
        enrichWithAi: Boolean(enrichWithAi),
      });

      res.json(result);
    } catch (error) {
      console.error("Full crawl failed:", error);
      const message = error instanceof Error ? error.message : "執行全國家爬蟲同步失敗。";
      res.status(500).json({ error: message });
    }
  });

  // Detect user's country via GPS reverse geocoding or browser timezone/language
  app.post("/api/locate-country", async (req, res) => {
    try {
      const { lat, lon, timezone, language } = (req.body || {}) as {
        lat?: number;
        lon?: number;
        timezone?: string;
        language?: string;
      };
      const location = await locateCountryFromCoordsOrTimezone({
        lat,
        lon,
        timezone,
        language,
      });
      const sourcesData = await readJsonFile<SourcesPayload>(SOURCES_FILE);
      const countrySources = sourcesData.sources.filter(
        (s) => s.enabled && s.countryCode === location.countryCode
      );
      res.json({
        ...location,
        availableSources: countrySources.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          sourceSector: s.sourceSector || "community",
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "無法解析所在國家位置。";
      res.status(500).json({ error: message });
    }
  });

  // Live crawl selected/all countries media + auto-translate foreign news + publish Blog RSS
  app.post("/api/publish-blog-batch", async (req, res) => {
    try {
      const {
        countries = "ALL",
        sectorFilter = "all",
        limitPerSource = 2,
        autoTranslate = true,
      } = (req.body || {}) as {
        countries?: CountryCode[] | "ALL";
        sectorFilter?: "all" | SourceSector;
        limitPerSource?: number;
        autoTranslate?: boolean;
      };

      const countriesFilter =
        Array.isArray(countries) && countries.length > 0
          ? countries.map((c) => normalizeCountry(c, "GLOBAL")).filter(Boolean)
          : undefined;

      const result = await crawlAllSources({
        trigger: "各國媒體爬文＋翻譯整理上架 Blog",
        countryFilter: countriesFilter && countriesFilter.length === 1 ? countriesFilter[0] : "ALL",
        countriesFilter,
        sectorFilter:
          sectorFilter === "official" || sectorFilter === "community" ? sectorFilter : "all",
        limitPerSource: Math.min(Math.max(1, Number(limitPerSource) || 2), 4),
        enrichWithAi: Boolean(autoTranslate),
      });

      res.json(result);
    } catch (error) {
      console.error("Blog batch publish failed:", error);
      const message = error instanceof Error ? error.message : "即時發布各國媒體至 Blog 失敗。";
      res.status(500).json({ error: message });
    }
  });

  // Read & update schedule / shift settings
  app.get("/api/schedule", async (_req, res) => {
    try {
      const sourcesData = await readJsonFile<SourcesPayload>(SOURCES_FILE);
      res.json(sourcesData.pipeline);
    } catch (error) {
      console.error("Failed to read schedule:", error);
      res.status(500).json({ error: "無法讀取排班設定。" });
    }
  });

  app.patch("/api/schedule", async (req, res) => {
    try {
      const { autoEnabled, intervalMinutes, autoPushEnabled, shiftId, shiftEnabled } =
        (req.body || {}) as {
          autoEnabled?: boolean;
          intervalMinutes?: number;
          autoPushEnabled?: boolean;
          shiftId?: string;
          shiftEnabled?: boolean;
        };

      const sourcesData = await readJsonFile<SourcesPayload>(SOURCES_FILE);
      if (typeof autoEnabled === "boolean") {
        sourcesData.pipeline.autoEnabled = autoEnabled;
      }
      if (typeof intervalMinutes === "number" && intervalMinutes >= 15 && intervalMinutes <= 1440) {
        sourcesData.pipeline.intervalMinutes = intervalMinutes;
        const hours = Math.round((intervalMinutes / 60) * 10) / 10;
        sourcesData.pipeline.scheduleLabel =
          intervalMinutes >= 60
            ? `每 ${hours} 小時自動執行一次全國家公開資料庫同步與推播上架`
            : `每 ${intervalMinutes} 分鐘自動執行一次全國家公開資料庫同步與推播上架`;
        sourcesData.pipeline.nextRunAt = new Date(
          Date.now() + intervalMinutes * 60 * 1000
        ).toISOString();
      }
      if (typeof autoPushEnabled === "boolean") {
        sourcesData.pipeline.autoPushEnabled = autoPushEnabled;
      }
      if (shiftId && typeof shiftEnabled === "boolean") {
        const shiftIdx = sourcesData.pipeline.shifts.findIndex((s) => s.id === shiftId);
        if (shiftIdx !== -1) {
          sourcesData.pipeline.shifts[shiftIdx].enabled = shiftEnabled;
        }
      }

      await writeJsonFile(SOURCES_FILE, sourcesData);
      res.json(sourcesData.pipeline);
    } catch (error) {
      console.error("Failed to update schedule:", error);
      res.status(500).json({ error: "更新排班與資料流設定失敗。" });
    }
  });

  // Run live source health & feed check across enabled sources
  app.post("/api/sync", async (_req, res) => {
    const startMs = Date.now();
    try {
      const sourcesData = await readJsonFile<SourcesPayload>(SOURCES_FILE);
      const nowIso = new Date().toISOString();
      let checked = 0;
      let okCount = 0;

      await Promise.all(
        sourcesData.sources.map(async (src) => {
          if (!src.enabled) return;
          checked += 1;
          try {
            const resp = await fetch(src.endpoint, {
              method: "HEAD",
              headers: { "User-Agent": "CablesGG-Sync/2.0" },
              signal: AbortSignal.timeout(4000),
            });
            src.lastCheckedAt = nowIso;
            if (resp.ok || resp.status === 405 || resp.status === 403) {
              src.lastStatus = "ok";
              okCount += 1;
            } else {
              src.lastStatus = `http_${resp.status}`;
            }
          } catch {
            src.lastCheckedAt = nowIso;
            src.lastStatus = "timeout";
          }
        })
      );

      const durationSeconds = Number(((Date.now() - startMs) / 1000).toFixed(1));
      const newLog = {
        id: `log-${Date.now()}`,
        timestamp: nowIso,
        trigger: "Console Endpoint Check",
        status: okCount > 0 ? "success" : "warning",
        sourcesChecked: checked,
        newEntries: 0,
        durationSeconds,
        commitSha: "health-check",
        message: `已完成 ${checked} 個啟用線纜端點連線檢查（${okCount} 個端點正常回應），耗時 ${durationSeconds} 秒。`,
      };

      sourcesData.pipeline.lastRunAt = nowIso;
      sourcesData.pipeline.lastRunStatus = newLog.status;
      sourcesData.syncLogs.unshift(newLog);
      sourcesData.syncLogs = sourcesData.syncLogs.slice(0, 30);

      await writeJsonFile(SOURCES_FILE, sourcesData);
      res.json({ log: newLog, sources: sourcesData.sources, pipeline: sourcesData.pipeline });
    } catch (error) {
      console.error("Sync check failed:", error);
      res.status(500).json({ error: "執行線纜來源檢查失敗。" });
    }
  });

  // Crawl a custom public URL (HTML / RSS / JSON) + optional keywords, summarize via Gemini, and persist
  app.post("/api/crawl", async (req, res) => {
    try {
      const { url, sourceName, keywords, categoryHint, countryHint, regionHint, saveAsSource } =
        req.body as {
          url?: string;
          sourceName?: string;
          keywords?: string;
          categoryHint?: string;
          countryHint?: string;
          regionHint?: string;
          saveAsSource?: boolean;
        };

      if (!url?.trim()) {
        return res.status(400).json({ error: "請輸入要爬取的公開目標網址（https://...）。" });
      }

      const extracted = await fetchAndExtractWebContent(url.trim(), keywords);
      const parsedHost = new URL(url.trim()).hostname.replace(/^www\./, "");
      const effectiveSourceName = sourceName?.trim() || parsedHost;

      const newEntry = await summarizeAndSaveEntry({
        sourceName: effectiveSourceName,
        sourceId: "src-custom-crawl",
        url: extracted.resolvedUrl,
        rawContent: extracted.extractedText,
        bannerImage: extracted.bannerImage,
        sourceIcon: extracted.sourceIcon,
        categoryHint: categoryHint || "自訂爬文",
        countryHint: countryHint || "GLOBAL",
        regionHint: regionHint || "全球",
        keywords: keywords?.trim(),
        triggerLabel: `Custom Crawl (${extracted.contentTypeLabel})`,
      });

      if (saveAsSource) {
        const sourcesData = await readJsonFile<SourcesPayload>(SOURCES_FILE);
        const already = sourcesData.sources.some((s) => s.endpoint === url.trim());
        if (!already) {
          sourcesData.sources.push({
            id: `src-${Date.now()}`,
            name: effectiveSourceName,
            category: newEntry.category,
            countryCode: newEntry.countryCode,
            countryName: newEntry.countryName,
            region: newEntry.region,
            type: extracted.contentTypeLabel,
            endpoint: url.trim(),
            enabled: true,
            lastCheckedAt: new Date().toISOString(),
            lastStatus: "ok",
            itemsCaptured: 1,
          });
          await writeJsonFile(SOURCES_FILE, sourcesData);
        }
      }

      res.status(201).json({ entry: newEntry, extractedFrom: extracted.contentTypeLabel });
    } catch (error) {
      console.error("Custom crawl error:", error);
      const message =
        error instanceof Error ? error.message : "爬取目標網址或執行 AI 摘要時發生錯誤。";
      res.status(500).json({ error: message });
    }
  });

  // Analyze raw changelog / news text via Gemini API and append to database.json
  app.post("/api/analyze", async (req, res) => {
    try {
      const { sourceName, url, rawContent, categoryHint, countryHint, regionHint, versionHint } =
        req.body as {
          sourceName?: string;
          url?: string;
          rawContent?: string;
          categoryHint?: string;
          countryHint?: string;
          regionHint?: string;
          versionHint?: string;
        };

      if (!rawContent?.trim() || rawContent.trim().length < 20) {
        return res
          .status(400)
          .json({ error: "請提供至少 20 字元的異動日誌、新聞或釋出說明內容以供 AI 結構化摘要。" });
      }

      const newEntry = await summarizeAndSaveEntry({
        sourceName: sourceName?.trim() || "Manual Pipeline Input",
        sourceId: "src-manual-ai",
        url: url?.trim() || "https://cables.gg",
        rawContent: rawContent.trim(),
        categoryHint,
        countryHint,
        regionHint,
        versionHint: versionHint?.trim(),
        triggerLabel: "Gemini AI Pipeline",
      });

      res.status(201).json(newEntry);
    } catch (error) {
      console.error("Gemini analyze error:", error);
      const message =
        error instanceof Error ? error.message : "呼叫 Gemini AI 進行結構化摘要時發生未知錯誤。";
      res.status(500).json({ error: message });
    }
  });

  // Get subscriber summary & list
  app.get("/api/subscriptions", async (_req, res) => {
    try {
      const payload = await readJsonFile<SubscriptionsPayload>(SUBSCRIPTIONS_FILE);
      const activeList = payload.subscribers.filter((s) => s.active);
      res.json({
        totalSubscribers: activeList.length,
        lastUpdated: payload.lastUpdated,
        subscribers: activeList,
      });
    } catch (error) {
      console.error("Failed to read subscriptions.json:", error);
      res.status(500).json({ error: "無法讀取訂閱統計資料。" });
    }
  });

  // Remove subscriber by ID
  app.delete("/api/subscriptions/:id", async (req, res) => {
    try {
      const payload = await readJsonFile<SubscriptionsPayload>(SUBSCRIPTIONS_FILE);
      const next = payload.subscribers.filter((s) => s.id !== req.params.id);
      if (next.length === payload.subscribers.length) {
        return res.status(404).json({ error: "找不到指定的訂閱者。" });
      }
      payload.subscribers = next;
      payload.lastUpdated = new Date().toISOString();
      await writeJsonFile(SUBSCRIPTIONS_FILE, payload);
      res.json({
        deletedId: req.params.id,
        totalSubscribers: next.filter((s) => s.active).length,
      });
    } catch (error) {
      console.error("Failed to delete subscriber:", error);
      res.status(500).json({ error: "移除訂閱者失敗。" });
    }
  });

  // Subscribe email for high-risk or all system change notifications
  app.post("/api/subscriptions", async (req, res) => {
    try {
      const { email, scope } = req.body as { email?: string; scope?: string };
      const normalizedEmail = (email ?? "").trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ error: "請輸入有效的 Email 電子郵件地址。" });
      }

      const validScope: "high_risk_only" | "all" =
        scope === "all" ? "all" : "high_risk_only";

      const payload = await readJsonFile<SubscriptionsPayload>(SUBSCRIPTIONS_FILE);
      const nowIso = new Date().toISOString();
      const existingIdx = payload.subscribers.findIndex(
        (s) => s.email.toLowerCase() === normalizedEmail
      );

      if (existingIdx !== -1) {
        payload.subscribers[existingIdx].scope = validScope;
        payload.subscribers[existingIdx].active = true;
        payload.lastUpdated = nowIso;
        await writeJsonFile(SUBSCRIPTIONS_FILE, payload);
        return res.status(200).json({
          alreadySubscribed: true,
          scope: validScope,
          email: normalizedEmail,
          totalSubscribers: payload.subscribers.filter((s) => s.active).length,
        });
      }

      const newSub: SubscriptionItem = {
        id: `sub-${Date.now()}`,
        email: normalizedEmail,
        scope: validScope,
        createdAt: nowIso,
        active: true,
      };
      payload.subscribers.push(newSub);
      payload.lastUpdated = nowIso;
      await writeJsonFile(SUBSCRIPTIONS_FILE, payload);

      res.status(201).json({
        alreadySubscribed: false,
        scope: validScope,
        email: normalizedEmail,
        totalSubscribers: payload.subscribers.filter((s) => s.active).length,
      });
    } catch (error) {
      console.error("Failed to save subscription:", error);
      res.status(500).json({ error: "儲存訂閱設定失敗，請稍後再試。" });
    }
  });

  // -------------------- n8n Automation Integration Endpoints --------------------
  app.get("/api/n8n", async (_req, res) => {
    try {
      const n8n = await readJsonFile<N8nPayload>(N8N_FILE);
      res.json(n8n);
    } catch (error) {
      console.error("Failed to read n8n.json:", error);
      res.status(500).json({ error: "無法讀取 n8n 自動化設定檔。" });
    }
  });

  app.post("/api/n8n/webhooks", async (req, res) => {
    try {
      const {
        name,
        webhookUrl,
        triggerMode = "all_new",
        templateFormat = "blog_markdown",
        sectorFilter = "all",
        countries = ["ALL"],
      } = (req.body || {}) as {
        name?: string;
        webhookUrl?: string;
        triggerMode?: "all_new" | "high_risk" | "manual";
        templateFormat?: N8nTemplateFormat;
        sectorFilter?: "all" | SourceSector;
        countries?: Array<"ALL" | CountryCode>;
      };

      if (!name?.trim() || !webhookUrl?.trim()) {
        return res.status(400).json({ error: "請填寫 n8n 連線名稱與 Webhook URL。" });
      }
      validatePublicUrl(webhookUrl.trim());

      const n8n = await readJsonFile<N8nPayload>(N8N_FILE);
      const nowIso = new Date().toISOString();
      const validFormat: N8nTemplateFormat =
        templateFormat === "json_digest" ||
        templateFormat === "html_card" ||
        templateFormat === "newsletter"
          ? templateFormat
          : "blog_markdown";

      const hook: N8nWebhookConfig = {
        id: `n8n-${Date.now()}`,
        name: name.trim(),
        webhookUrl: webhookUrl.trim(),
        triggerMode:
          triggerMode === "high_risk" || triggerMode === "manual" ? triggerMode : "all_new",
        templateFormat: validFormat,
        sectorFilter:
          sectorFilter === "official" || sectorFilter === "community" ? sectorFilter : "all",
        countries: Array.isArray(countries) && countries.length > 0 ? countries : ["ALL"],
        enabled: true,
        createdAt: nowIso,
        lastDispatchedAt: null,
        lastStatusCode: null,
      };
      n8n.webhooks.unshift(hook);
      n8n.lastUpdated = nowIso;
      await writeJsonFile(N8N_FILE, n8n);
      res.status(201).json(hook);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "新增 n8n Webhook 失敗。";
      res.status(400).json({ error: msg });
    }
  });

  app.patch("/api/n8n/webhooks/:id", async (req, res) => {
    try {
      const { enabled, triggerMode, templateFormat } = (req.body || {}) as {
        enabled?: boolean;
        triggerMode?: "all_new" | "high_risk" | "manual";
        templateFormat?: N8nTemplateFormat;
      };
      const n8n = await readJsonFile<N8nPayload>(N8N_FILE);
      const idx = n8n.webhooks.findIndex((w) => w.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ error: "找不到指定的 n8n Webhook。" });
      }
      if (typeof enabled === "boolean") n8n.webhooks[idx].enabled = enabled;
      if (triggerMode === "all_new" || triggerMode === "high_risk" || triggerMode === "manual") {
        n8n.webhooks[idx].triggerMode = triggerMode;
      }
      if (
        templateFormat === "blog_markdown" ||
        templateFormat === "json_digest" ||
        templateFormat === "html_card" ||
        templateFormat === "newsletter"
      ) {
        n8n.webhooks[idx].templateFormat = templateFormat;
      }
      n8n.lastUpdated = new Date().toISOString();
      await writeJsonFile(N8N_FILE, n8n);
      res.json(n8n.webhooks[idx]);
    } catch {
      res.status(500).json({ error: "更新 n8n Webhook 設定失敗。" });
    }
  });

  app.delete("/api/n8n/webhooks/:id", async (req, res) => {
    try {
      const n8n = await readJsonFile<N8nPayload>(N8N_FILE);
      const next = n8n.webhooks.filter((w) => w.id !== req.params.id);
      if (next.length === n8n.webhooks.length) {
        return res.status(404).json({ error: "找不到欲刪除的 n8n Webhook。" });
      }
      n8n.webhooks = next;
      n8n.lastUpdated = new Date().toISOString();
      await writeJsonFile(N8N_FILE, n8n);
      res.json({ deletedId: req.params.id });
    } catch {
      res.status(500).json({ error: "刪除 n8n Webhook 失敗。" });
    }
  });

  // Dispatch specific entry or latest entries to an n8n webhook with chosen template format
  app.post("/api/n8n/dispatch", async (req, res) => {
    try {
      const {
        webhookId,
        webhookUrl,
        entryId,
        templateFormat = "blog_markdown",
        limit = 3,
      } = (req.body || {}) as {
        webhookId?: string;
        webhookUrl?: string;
        entryId?: string;
        templateFormat?: N8nTemplateFormat;
        limit?: number;
      };

      const n8n = await readJsonFile<N8nPayload>(N8N_FILE);
      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);

      let targetUrl = webhookUrl?.trim() || "";
      let targetName = "自訂即時傳送";
      let effectiveFormat: N8nTemplateFormat = templateFormat;

      if (webhookId) {
        const found = n8n.webhooks.find((w) => w.id === webhookId);
        if (!found) {
          return res.status(404).json({ error: "找不到指定的 n8n Webhook 連線。" });
        }
        targetUrl = found.webhookUrl;
        targetName = found.name;
        if (!req.body?.templateFormat) {
          effectiveFormat = found.templateFormat;
        }
      }

      if (!targetUrl) {
        return res.status(400).json({ error: "請選擇已儲存的 n8n Webhook 或輸入目標 Webhook URL。" });
      }

      const entriesToSend = entryId
        ? db.entries.filter((e) => e.id === entryId)
        : db.entries.slice(0, Math.min(Math.max(1, Number(limit) || 3), 10));

      if (entriesToSend.length === 0) {
        return res.status(404).json({ error: "找不到要傳送的情報文章。" });
      }

      const origin =
        process.env.APP_URL?.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;

      const log = await dispatchToSingleN8nWebhook({
        webhookUrl: targetUrl,
        webhookName: targetName,
        entries: entriesToSend,
        templateFormat: effectiveFormat,
        origin,
      });

      if (webhookId) {
        const refreshed = await readJsonFile<N8nPayload>(N8N_FILE);
        const wIdx = refreshed.webhooks.findIndex((w) => w.id === webhookId);
        if (wIdx !== -1) {
          refreshed.webhooks[wIdx].lastDispatchedAt = log.timestamp;
          refreshed.webhooks[wIdx].lastStatusCode = log.statusCode;
          await writeJsonFile(N8N_FILE, refreshed);
        }
      }

      res.status(log.ok ? 200 : 502).json({
        log,
        payloadPreview: buildTemplatePayloadForEntries(entriesToSend, effectiveFormat, origin),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "傳送至 n8n Webhook 失敗。";
      res.status(400).json({ error: msg });
    }
  });

  // Inbound API for n8n HTTP Request node: trigger official/community crawl and return Blog-ready entries
  app.post("/api/n8n/trigger-crawl", async (req, res) => {
    try {
      const {
        countryCode = "ALL",
        sourceSector = "all",
        limitPerSource = 2,
        enrichWithAi = false,
        templateFormat = "blog_markdown",
      } = (req.body || {}) as {
        countryCode?: string;
        sourceSector?: "all" | SourceSector;
        limitPerSource?: number;
        enrichWithAi?: boolean;
        templateFormat?: N8nTemplateFormat;
      };

      const normalizedCountry =
        countryCode.toUpperCase() === "ALL" ? "ALL" : normalizeCountry(countryCode, "ALL" as CountryCode);
      const sector: "all" | SourceSector =
        sourceSector === "official" || sourceSector === "community" ? sourceSector : "all";

      const result = await crawlAllSources({
        trigger: "n8n HTTP Node 自動觸發",
        countryFilter: normalizedCountry as CountryCode | "ALL",
        sectorFilter: sector,
        limitPerSource: Math.min(Math.max(1, Number(limitPerSource) || 2), 5),
        enrichWithAi: Boolean(enrichWithAi),
      });

      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const outputEntries =
        result.capturedEntries.length > 0 ? result.capturedEntries : db.entries.slice(0, 5);
      const origin =
        process.env.APP_URL?.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;

      res.json({
        ...result,
        templatePayload: buildTemplatePayloadForEntries(outputEntries, templateFormat, origin),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "n8n 觸發爬蟲失敗。";
      res.status(500).json({ error: msg });
    }
  });

  // Inbound API for n8n HTTP Request node: push external content into Cables.gg condensed Blog pipeline
  app.post("/api/n8n/ingest", async (req, res) => {
    try {
      const {
        url,
        sourceName,
        rawContent,
        title,
        categoryHint,
        countryHint,
        sourceSector,
        keywords,
      } = (req.body || {}) as {
        url?: string;
        sourceName?: string;
        rawContent?: string;
        title?: string;
        categoryHint?: string;
        countryHint?: string;
        sourceSector?: SourceSector;
        keywords?: string;
      };

      let effectiveRaw = (rawContent || "").trim();
      let resolvedUrl = (url || "").trim();
      let bannerImage = "";
      let sourceIcon = "";

      if (resolvedUrl && !effectiveRaw) {
        const extracted = await fetchAndExtractWebContent(resolvedUrl, keywords);
        effectiveRaw = extracted.extractedText;
        resolvedUrl = extracted.resolvedUrl;
        bannerImage = extracted.bannerImage || "";
        sourceIcon = extracted.sourceIcon;
      }

      if (!effectiveRaw && !title) {
        return res.status(400).json({
          error: "請提供公開網址 (url) 或文章標題與內文 (rawContent) 以供 n8n 匯入整理。",
        });
      }

      const contentForEngine = title ? `網頁標題：${title}\n${effectiveRaw}` : effectiveRaw;
      const newEntry = await summarizeAndSaveEntry({
        sourceName: sourceName?.trim() || "n8n Automation Feed",
        sourceId: "src-n8n-ingest",
        url: resolvedUrl || "https://cables.gg",
        rawContent: contentForEngine,
        bannerImage,
        sourceIcon,
        categoryHint: categoryHint || "自訂爬文",
        countryHint: countryHint || "GLOBAL",
        keywords,
        triggerLabel: "n8n Inbound Ingest",
      });

      if (sourceSector === "official" || sourceSector === "community") {
        const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
        const idx = db.entries.findIndex((e) => e.id === newEntry.id);
        if (idx !== -1) {
          db.entries[idx].sourceSector = sourceSector;
          await writeJsonFile(DATABASE_FILE, db);
          newEntry.sourceSector = sourceSector;
        }
      }

      const origin =
        process.env.APP_URL?.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;

      res.status(201).json({
        entry: newEntry,
        blogUrl: `${origin}/blog/${newEntry.id}`,
        rssBlogFeedUrl: `${origin}/rss/blog.xml`,
        digest: compileDeterministicBlogDigest(newEntry),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "n8n 資料匯入整理失敗。";
      res.status(500).json({ error: msg });
    }
  });

  // -------------------- Custom Blog Profile & Real External Creator Profiles --------------------
  app.get("/api/blog-profile", async (_req, res) => {
    try {
      const profile = await readBlogProfile();
      res.json(profile);
    } catch (error) {
      console.error("Failed to read blog profile:", error);
      res.status(500).json({ error: "無法讀取個人 Blog 設定檔。" });
    }
  });

  app.patch("/api/blog-profile", async (req, res) => {
    try {
      const {
        slug,
        blogTitle,
        tagline,
        ownerName,
        ownerBio,
        template,
        autoImportEnabled,
        autoImportCountries,
        autoImportCategories,
      } = (req.body || {}) as {
        slug?: string;
        blogTitle?: string;
        tagline?: string;
        ownerName?: string;
        ownerBio?: string;
        template?: BlogLayoutTemplate;
        autoImportEnabled?: boolean;
        autoImportCountries?: Array<"ALL" | CountryCode>;
        autoImportCategories?: CableCategory[];
      };

      const profile = await readBlogProfile();
      if (typeof slug === "string" && slug.trim()) {
        profile.slug = normalizeBlogSlug(slug);
      }
      if (typeof blogTitle === "string" && blogTitle.trim()) {
        profile.blogTitle = blogTitle.trim().slice(0, 80);
      }
      if (typeof tagline === "string") {
        profile.tagline = tagline.trim().slice(0, 160);
      }
      if (typeof ownerName === "string" && ownerName.trim()) {
        profile.ownerName = ownerName.trim().slice(0, 48);
      }
      if (typeof ownerBio === "string") {
        profile.ownerBio = ownerBio.trim().slice(0, 320);
      }
      if (template === "minimal" || template === "editorial" || template === "cards") {
        profile.template = template;
      }
      if (typeof autoImportEnabled === "boolean") {
        profile.autoImportEnabled = autoImportEnabled;
      }
      if (Array.isArray(autoImportCountries)) {
        profile.autoImportCountries =
          autoImportCountries.length > 0 ? autoImportCountries : ["ALL"];
      }
      if (Array.isArray(autoImportCategories)) {
        profile.autoImportCategories = autoImportCategories;
      }

      profile.updatedAt = new Date().toISOString();
      await writeJsonFile(BLOG_PROFILE_FILE, profile);
      res.json(profile);
    } catch (error) {
      console.error("Failed to update blog profile:", error);
      res.status(500).json({ error: "更新個人 Blog 設定失敗。" });
    }
  });

  app.post("/api/blog-profile/import-entries", async (req, res) => {
    try {
      const { entryIds = [], markSharedToBlog = true } = (req.body || {}) as {
        entryIds?: string[];
        markSharedToBlog?: boolean;
      };
      if (!Array.isArray(entryIds) || entryIds.length === 0) {
        return res.status(400).json({ error: "請至少選擇一篇文章導入個人 Blog。" });
      }
      const result = await importEntriesToBlog(entryIds, markSharedToBlog);
      res.json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "導入文章至 Blog 失敗。";
      res.status(500).json({ error: msg });
    }
  });

  app.delete("/api/blog-profile/imported-entries/:id", async (req, res) => {
    try {
      const profile = await readBlogProfile();
      profile.importedEntryIds = profile.importedEntryIds.filter((eid) => eid !== req.params.id);
      profile.updatedAt = new Date().toISOString();
      await writeJsonFile(BLOG_PROFILE_FILE, profile);

      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const idx = db.entries.findIndex((e) => e.id === req.params.id);
      if (idx !== -1) {
        db.entries[idx].sharedToBlog = false;
        db.entries[idx].sharedToBlogAt = null;
        await writeJsonFile(DATABASE_FILE, db);
      }
      res.json(profile);
    } catch {
      res.status(500).json({ error: "從 Blog 移除該篇文章失敗。" });
    }
  });

  app.get("/api/profiles/discover", async (req, res) => {
    try {
      const force = req.query.refresh === "1";
      const profiles = await fetchRealCreatorDirectory(force);
      res.json({ profiles, fetchedAt: new Date().toISOString() });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "讀取真實創作者公開檔案失敗。";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/profiles/lookup", async (req, res) => {
    try {
      const { platform = "github", query = "" } = (req.body || {}) as {
        platform?: CreatorPlatform;
        query?: string;
      };
      if (!query.trim()) {
        return res.status(400).json({ error: "請輸入要查詢的帳號或公開 RSS 網址。" });
      }
      const validPlatform: CreatorPlatform =
        platform === "devto" || platform === "rss" ? platform : "github";
      const profile = await lookupRealCreatorProfile({
        platform: validPlatform,
        query: query.trim(),
      });
      res.json({ profile });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "查詢外部真實個人檔案失敗。";
      res.status(400).json({ error: msg });
    }
  });

  app.post("/api/profiles/reference", async (req, res) => {
    try {
      const {
        profile,
        referenceNote = "",
        subscribeFeed = true,
        importArticles = true,
      } = (req.body || {}) as {
        profile?: RealCreatorProfile;
        referenceNote?: string;
        subscribeFeed?: boolean;
        importArticles?: boolean;
      };
      if (!profile || !profile.id || !profile.displayName || !profile.profileUrl) {
        return res.status(400).json({ error: "請提供有效的真實創作者檔案資料。" });
      }
      const result = await referenceCreatorIntoBlog({
        profile,
        referenceNote,
        subscribeFeed,
        importArticles,
      });
      res.status(201).json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "參考並導入個人檔案至 Blog 失敗。";
      res.status(500).json({ error: msg });
    }
  });

  app.delete("/api/profiles/reference/:id", async (req, res) => {
    try {
      const profile = await readBlogProfile();
      profile.referencedProfiles = profile.referencedProfiles.filter(
        (p) => p.id !== req.params.id
      );
      profile.updatedAt = new Date().toISOString();
      await writeJsonFile(BLOG_PROFILE_FILE, profile);
      res.json(profile);
    } catch {
      res.status(500).json({ error: "移除已參考的創作者檔案失敗。" });
    }
  });

  app.get("/api/profiles/activity-wall", async (req, res) => {
    try {
      const rawKind = typeof req.query.kind === "string" ? req.query.kind : "all";
      const kind: "all" | ProfileActivityKind =
        rawKind === "bookmark" || rawKind === "highlight" || rawKind === "blog_post"
          ? rawKind
          : "all";
      const data = await fetchAggregatedActivityWall(kind);
      res.json(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "無法載入開發者聚合動態牆。";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/profiles/:platform/:handle/activity", async (req, res) => {
    try {
      const rawPlatform = req.params.platform;
      const platform: CreatorPlatform | "cables" =
        rawPlatform === "github" || rawPlatform === "devto" || rawPlatform === "rss"
          ? rawPlatform
          : rawPlatform === "cables"
            ? "cables"
            : "github";
      const handle = decodeURIComponent(req.params.handle || "");
      const forceRefresh = req.query.refresh === "1";
      const data = await fetchCreatorActivityWall({
        platform,
        handle,
        forceRefresh,
      });
      res.json(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "載入該開發者動態牆失敗。";
      res.status(400).json({ error: msg });
    }
  });

  app.post("/api/profiles/follow", async (req, res) => {
    try {
      const { profile, ownerAction } = (req.body || {}) as {
        profile?: RealCreatorProfile;
        ownerAction?: boolean;
      };
      if (ownerAction) {
        const result = await toggleFollowOwnerBlog();
        return res.json(result);
      }
      if (!profile || !profile.id || !profile.displayName) {
        return res.status(400).json({ error: "請提供有效的開發者個人檔案資料。" });
      }
      const result = await toggleFollowCreator(profile);
      res.json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "更新追蹤狀態失敗。";
      res.status(500).json({ error: msg });
    }
  });

  app.delete("/api/profiles/follow/:id", async (req, res) => {
    try {
      const blogProfile = await readBlogProfile();
      blogProfile.followedProfiles = (blogProfile.followedProfiles || []).filter(
        (p) => p.id !== req.params.id
      );
      blogProfile.updatedAt = new Date().toISOString();
      await writeJsonFile(BLOG_PROFILE_FILE, blogProfile);
      res.json(blogProfile);
    } catch {
      res.status(500).json({ error: "取消追蹤失敗。" });
    }
  });

  // Downloadable real n8n Workflow JSON template pre-wired to this server
  app.get("/api/n8n/workflow-template.json", (req, res) => {
    const origin =
      process.env.APP_URL?.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;
    const workflow = {
      name: "Cables.gg 多國官民情資自動抓取與個人 Blog RSS 轉換工作流",
      nodes: [
        {
          parameters: {
            rule: {
              interval: [{ field: "hours", hoursInterval: 4 }],
            },
          },
          id: "schedule-trigger-1",
          name: "每 4 小時自動排程",
          type: "n8n-nodes-base.scheduleTrigger",
          typeVersion: 1.2,
          position: [220, 300],
        },
        {
          parameters: {
            method: "POST",
            url: `${origin}/api/n8n/trigger-crawl`,
            sendBody: true,
            specifyBody: "json",
            jsonBody: JSON.stringify(
              {
                countryCode: "ALL",
                sourceSector: "all",
                limitPerSource: 2,
                templateFormat: "blog_markdown",
              },
              null,
              2
            ),
            options: {},
          },
          id: "http-trigger-crawl-1",
          name: "觸發 Cables.gg 全國官民爬蟲與 Blog 模板轉換",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 4.2,
          position: [480, 220],
        },
        {
          parameters: {
            url: `${origin}/rss/blog.xml`,
          },
          id: "rss-read-blog-1",
          name: "讀取個人 Blog 轉換版 RSS Feed",
          type: "n8n-nodes-base.rssFeedRead",
          typeVersion: 1,
          position: [480, 400],
        },
        {
          parameters: {
            jsCode:
              "// 將 Cables.gg 精煉重點文章轉出為可發布的 Blog Markdown 項目\nconst items = $input.first().json?.templatePayload?.items || [];\nreturn items.map(item => ({\n  json: {\n    title: item.title,\n    country: item.countryName,\n    sector: item.sourceSector,\n    markers: item.markers,\n    lead: item.lead,\n    keyPoints: item.keyPoints,\n    markdown: item.markdown,\n    blogUrl: item.blogUrl,\n    sourceUrl: item.sourceUrl\n  }\n}));",
          },
          id: "code-format-blog-1",
          name: "拆解為單篇 Blog 重點文章",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [760, 220],
        },
      ],
      connections: {
        "每 4 小時自動排程": {
          main: [
            [
              {
                node: "觸發 Cables.gg 全國官民爬蟲與 Blog 模板轉換",
                type: "main",
                index: 0,
              },
              {
                node: "讀取個人 Blog 轉換版 RSS Feed",
                type: "main",
                index: 0,
              },
            ],
          ],
        },
        "觸發 Cables.gg 全國官民爬蟲與 Blog 模板轉換": {
          main: [
            [
              {
                node: "拆解為單篇 Blog 重點文章",
                type: "main",
                index: 0,
              },
            ],
          ],
        },
      },
      active: false,
      settings: { executionOrder: "v1" },
      meta: { templateCredsSetupCompleted: true },
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="cables-gg-n8n-workflow.json"');
    res.send(JSON.stringify(workflow, null, 2));
  });

  // Dynamic RSS 2.0 Feed generated from database.json (supports ?risk=high&country=TW&sector=official&category=...)
  app.get("/rss.xml", async (req, res) => {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const riskQuery = typeof req.query.risk === "string" ? req.query.risk : "";
      const categoryQuery =
        typeof req.query.category === "string" ? req.query.category : "";
      const countryQuery =
        typeof req.query.country === "string" ? req.query.country.toUpperCase() : "";
      const sectorQuery = typeof req.query.sector === "string" ? req.query.sector : "";

      const origin =
        process.env.APP_URL?.replace(/\/$/, "") ||
        `${req.protocol}://${req.get("host")}`;

      let filtered = [...db.entries];
      if (riskQuery === "high" || riskQuery === "medium" || riskQuery === "low") {
        filtered = filtered.filter((e) => e.riskLevel === riskQuery);
      }
      if (categoryQuery) {
        filtered = filtered.filter((e) => e.category === categoryQuery);
      }
      if (countryQuery && countryQuery !== "ALL") {
        filtered = filtered.filter((e) => e.countryCode === countryQuery);
      }
      if (sectorQuery === "official" || sectorQuery === "community") {
        filtered = filtered.filter(
          (e) => inferSourceSector(e.sourceName, e.url, e.sourceSector) === sectorQuery
        );
      }

      const countryLabel =
        countryQuery && countryQuery in COUNTRY_META
          ? COUNTRY_META[countryQuery as CountryCode].name
          : "全球多國";

      const feedTitle =
        riskQuery === "high"
          ? `Cables.gg — ${countryLabel}高風險公告與系統異動 Feed`
          : `Cables.gg — ${countryLabel}公開資料庫與新聞索引 Feed`;

      const itemsXml = filtered
        .slice(0, 40)
        .map((entry) => {
          const postUrl = `${origin}/post/${entry.id}`;
          const sectorLabel =
            inferSourceSector(entry.sourceName, entry.url, entry.sourceSector) === "official"
              ? "官方機構"
              : "民間社群";
          const riskLabel =
            entry.riskLevel === "high"
              ? "高風險"
              : entry.riskLevel === "medium"
                ? "中風險"
                : "低風險";
          const desc = `[${entry.countryName} · ${sectorLabel} · ${entry.category} · ${riskLabel}] ${entry.aiSummary}`;
          return `    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${new Date(entry.publishedAt).toUTCString()}</pubDate>
      <category>${escapeXml(entry.category)}</category>
      <description>${escapeXml(desc)}</description>
    </item>`;
        })
        .join("\n");

      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(origin)}</link>
    <description>${escapeXml("Cables.gg 多國公開資料庫爬蟲、官民新聞整合、資安公告與技術異動自動推播頻道。")}</description>
    <language>zh-Hant</language>
    <lastBuildDate>${new Date(db.lastUpdated).toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(origin + req.originalUrl)}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

      res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
      res.send(rssXml);
    } catch (error) {
      console.error("Failed to generate RSS feed:", error);
      res.status(500).type("text/plain").send("Failed to generate RSS feed.");
    }
  });

  // Personal Blog Condensed RSS 2.0 Feed (<content:encoded> with curated key takeaways & markers)
  app.get("/rss/blog.xml", async (req, res) => {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const riskQuery = typeof req.query.risk === "string" ? req.query.risk : "";
      const categoryQuery =
        typeof req.query.category === "string" ? req.query.category : "";
      const countryQuery =
        typeof req.query.country === "string" ? req.query.country.toUpperCase() : "";
      const sectorQuery = typeof req.query.sector === "string" ? req.query.sector : "";

      const origin =
        process.env.APP_URL?.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;

      let filtered = [...db.entries];
      if (riskQuery === "high" || riskQuery === "medium" || riskQuery === "low") {
        filtered = filtered.filter((e) => e.riskLevel === riskQuery);
      }
      if (categoryQuery) {
        filtered = filtered.filter((e) => e.category === categoryQuery);
      }
      if (countryQuery && countryQuery !== "ALL") {
        filtered = filtered.filter((e) => e.countryCode === countryQuery);
      }
      if (sectorQuery === "official" || sectorQuery === "community") {
        filtered = filtered.filter(
          (e) => inferSourceSector(e.sourceName, e.url, e.sourceSector) === sectorQuery
        );
      }

      const itemsXml = filtered
        .slice(0, 30)
        .map((entry) => {
          const digest = entry.blogDigest || compileDeterministicBlogDigest(entry);
          const blogUrl = `${origin}/blog/${entry.id}`;
          const htmlBody = compileCuratedBlogHtml(entry, origin);
          const markerTags = digest.markers
            .map((m) => `      <category>${escapeXml(m)}</category>`)
            .join("\n");
          const enclosureTag = entry.bannerImage
            ? `\n      <enclosure url="${escapeXml(entry.bannerImage)}" type="image/jpeg" />`
            : "";
          return `    <item>
      <title>${escapeXml(digest.headline)}</title>
      <link>${escapeXml(blogUrl)}</link>
      <guid isPermaLink="true">${escapeXml(blogUrl)}</guid>
      <pubDate>${new Date(entry.publishedAt).toUTCString()}</pubDate>
${markerTags}
      <description>${escapeXml(digest.lead)}</description>
      <content:encoded><![CDATA[${htmlBody}]]></content:encoded>${enclosureTag}
    </item>`;
        })
        .join("\n");

      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml("Cables.gg 個人 Blog 重點精煉訂閱頻道")}</title>
    <link>${escapeXml(origin + "/blog")}</link>
    <description>${escapeXml("將各國官方與民間情資自動精簡為重點標記版 Blog 文章的 RSS 訂閱串流（不含冗長全文）。")}</description>
    <language>zh-Hant</language>
    <lastBuildDate>${new Date(db.lastUpdated).toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(origin + req.originalUrl)}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

      res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
      res.send(rssXml);
    } catch (error) {
      console.error("Failed to generate Blog RSS feed:", error);
      res.status(500).type("text/plain").send("Failed to generate Blog RSS feed.");
    }
  });

  // Standard JSON Feed 1.1 for modern static blogs, Hugo/Astro/Next.js & n8n
  app.get("/feed.json", async (req, res) => {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const db = await readJsonFile<DatabasePayload>(DATABASE_FILE);
      const countryQuery =
        typeof req.query.country === "string" ? req.query.country.toUpperCase() : "";
      const sectorQuery = typeof req.query.sector === "string" ? req.query.sector : "";
      const categoryQuery = typeof req.query.category === "string" ? req.query.category : "";
      const limit = Math.min(Math.max(1, Number(req.query.limit) || 25), 60);

      const origin =
        process.env.APP_URL?.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;

      let filtered = [...db.entries];
      if (countryQuery && countryQuery !== "ALL") {
        filtered = filtered.filter((e) => e.countryCode === countryQuery);
      }
      if (sectorQuery === "official" || sectorQuery === "community") {
        filtered = filtered.filter(
          (e) => inferSourceSector(e.sourceName, e.url, e.sourceSector) === sectorQuery
        );
      }
      if (categoryQuery) {
        filtered = filtered.filter((e) => e.category === categoryQuery);
      }

      res.json({
        version: "https://jsonfeed.org/version/1.1",
        title: "Cables.gg 個人 Blog 精簡重點情報誌",
        home_page_url: `${origin}/blog`,
        feed_url: `${origin}${req.originalUrl}`,
        description: "跨國官民資料庫精簡重點整理與個人 Blog 轉換訂閱源",
        language: "zh-Hant",
        items: filtered.slice(0, limit).map((entry) => {
          const digest = entry.blogDigest || compileDeterministicBlogDigest(entry);
          const sector = inferSourceSector(entry.sourceName, entry.url, entry.sourceSector);
          return {
            id: entry.id,
            url: `${origin}/blog/${entry.id}`,
            external_url: entry.url,
            title: digest.headline,
            summary: digest.lead,
            content_html: compileCuratedBlogHtml(entry, origin),
            content_text: digest.markdown,
            image: entry.bannerImage || undefined,
            date_published: entry.publishedAt,
            tags: digest.markers,
            authors: [{ name: `${entry.sourceName} (${entry.countryName})` }],
            _cables: {
              countryCode: entry.countryCode,
              countryName: entry.countryName,
              sourceSector: sector,
              category: entry.category,
              riskLevel: entry.riskLevel,
              keyPoints: digest.keyPoints,
              takeAway: digest.takeAway,
            },
          };
        }),
      });
    } catch (error) {
      console.error("Failed to generate feed.json:", error);
      res.status(500).json({ error: "無法產生 JSON Feed。" });
    }
  });

  // External JavaScript Embed Widget for third-party websites & personal blogs
  app.get("/api/embed/widget.js", (req, res) => {
    const origin =
      process.env.APP_URL?.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;
    const country = typeof req.query.country === "string" ? req.query.country : "ALL";
    const sector = typeof req.query.sector === "string" ? req.query.sector : "all";
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 5), 15);
    const theme = req.query.theme === "dark" ? "dark" : "light";

    const js = `(function(){
  var target = document.getElementById("cables-blog-widget") || document.currentScript.parentElement;
  if(!target) return;
  var isDark = ${JSON.stringify(theme)} === "dark";
  var bg = isDark ? "#18181B" : "#FFFFFF";
  var fg = isDark ? "#F4F4F5" : "#37352F";
  var muted = isDark ? "#A1A1AA" : "#787774";
  var border = isDark ? "#27272A" : "#E9E9E7";
  var chipBg = isDark ? "#27272A" : "#F7F6F3";
  fetch(${JSON.stringify(`${origin}/feed.json?country=${encodeURIComponent(country)}&sector=${encodeURIComponent(sector)}&limit=${limit}`)})
    .then(function(r){ return r.json(); })
    .then(function(feed){
      var items = (feed && feed.items) || [];
      var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:'+bg+';color:'+fg+';border:1px solid '+border+';border-radius:6px;padding:16px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;margin-bottom:12px;border-bottom:1px solid '+border+';font-size:13px;font-weight:600;"><span>Cables.gg 重點精選情報</span><a href="${origin}/blog" target="_blank" rel="noopener" style="font-size:11px;color:'+muted+';text-decoration:none;">閱讀完整 Blog →</a></div>';
      items.forEach(function(item, idx){
        var meta = item._cables || {};
        var sectorTxt = meta.sourceSector === "official" ? "官方" : "民間";
        var borderStyle = idx > 0 ? "border-top:1px solid "+border+";padding-top:12px;margin-top:12px;" : "";
        html += '<div style="'+borderStyle+'">';
        html += '<div style="font-size:11px;color:'+muted+';margin-bottom:4px;">'+ (meta.countryName || "") +' · '+ sectorTxt +' · '+ (meta.category || "") +'</div>';
        html += '<a href="'+ item.url +'" target="_blank" rel="noopener" style="display:block;font-size:14px;font-weight:600;color:'+fg+';text-decoration:none;line-height:1.4;margin-bottom:6px;">'+ item.title.replace(/</g,"&lt;") +'</a>';
        html += '<p style="margin:0 0 6px 0;font-size:12px;color:'+muted+';line-height:1.5;">'+ (item.summary || "").slice(0,140).replace(/</g,"&lt;") +'</p>';
        if(meta.keyPoints && meta.keyPoints.length){
          html += '<div style="font-size:11px;background:'+chipBg+';padding:6px 8px;border-radius:4px;color:'+fg+';">重點：'+ String(meta.keyPoints[0]).replace(/</g,"&lt;") +'</div>';
        }
        html += '</div>';
      });
      html += '</div>';
      target.innerHTML = html;
    })
    .catch(function(){
      target.innerHTML = '<div style="font-size:12px;color:#787774;padding:12px;border:1px solid #E9E9E7;border-radius:6px;">無法載入 Cables.gg Blog 嵌入內容</div>';
    });
})();`;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.send(js);
  });

  // Vite middleware for development or static dist for production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Cables.gg] Server listening on http://0.0.0.0:${PORT}`);
    setInterval(runScheduledCheckIfDue, 60_000);
  });
}

startServer();
