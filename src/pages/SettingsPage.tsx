import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  Download,
  Copy,
  Check,
  Plus,
  FileText,
  FileJson,
  Languages,
  Clock,
  ArrowRight,
  Globe,
  Loader2,
  CalendarClock,
  Trash2,
  Mail,
} from "lucide-react";
import {
  COUNTRY_OPTIONS,
  type CableCategory,
  type CableEntry,
  type CountryCode,
  type DatabasePayload,
  type SourceSector,
  type SourcesPayload,
} from "../types/cables";
import { CategoryTag, CountryTag, SectorTag, formatDateTime } from "../components/NotionTags";
import { SafeSourceIcon } from "../components/SafeImage";

interface SettingsPageProps {
  db: DatabasePayload | null;
  sources: SourcesPayload | null;
  onRefreshAll: () => Promise<void>;
}

const ALL_CATEGORIES: CableCategory[] = [
  "國際焦點",
  "財經科技",
  "資安公告",
  "自訂爬文",
  "API 變動",
  "GitHub 釋出",
  "Reddit 熱議",
];

export function SettingsPage({ db, sources, onRefreshAll }: SettingsPageProps) {
  const [activeJsonTab, setActiveJsonTab] = useState<"database" | "sources">("database");
  const [copiedJson, setCopiedJson] = useState(false);

  // Full-country crawl + endpoint health check state
  const [crawlingAll, setCrawlingAll] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [fetchingSourceId, setFetchingSourceId] = useState<string | null>(null);
  const [fetchedEntry, setFetchedEntry] = useState<CableEntry | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [confirmDeleteSourceId, setConfirmDeleteSourceId] = useState<string | null>(null);
  const [batchEnriching, setBatchEnriching] = useState(false);
  const [subscribers, setSubscribers] = useState<
    Array<{ id: string; email: string; scope: "high_risk_only" | "all"; createdAt: string }>
  >([]);

  const loadSubscribers = async () => {
    try {
      const res = await fetch("/api/subscriptions");
      if (res.ok) {
        const data = (await res.json()) as {
          subscribers?: Array<{
            id: string;
            email: string;
            scope: "high_risk_only" | "all";
            createdAt: string;
          }>;
        };
        setSubscribers(data.subscribers ?? []);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    loadSubscribers();
  }, []);

  // Add source state
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceCategory, setNewSourceCategory] = useState<CableCategory>("國際焦點");
  const [newSourceCountry, setNewSourceCountry] = useState<CountryCode>("TW");
  const [newSourceSector, setNewSourceSector] = useState<SourceSector>("community");
  const [newSourceType, setNewSourceType] = useState("RSS / Atom");
  const [newSourceEndpoint, setNewSourceEndpoint] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  // Ingest Mode: URL crawl vs raw text
  const [ingestMode, setIngestMode] = useState<"crawl" | "text">("crawl");

  // Crawl form state
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlSourceName, setCrawlSourceName] = useState("");
  const [crawlKeywords, setCrawlKeywords] = useState("");
  const [crawlCategory, setCrawlCategory] = useState<CableCategory>("自訂爬文");
  const [crawlCountry, setCrawlCountry] = useState<CountryCode>("TW");
  const [crawlSaveSource, setCrawlSaveSource] = useState(true);

  // Text analyze form state
  const [ingestSource, setIngestSource] = useState("");
  const [ingestCategory, setIngestCategory] = useState<CableCategory>("國際焦點");
  const [ingestCountry, setIngestCountry] = useState<CountryCode>("GLOBAL");
  const [ingestVersion, setIngestVersion] = useState("");
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestRaw, setIngestRaw] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [createdEntry, setCreatedEntry] = useState<CableEntry | null>(null);

  const activeJsonObject = activeJsonTab === "database" ? db : sources;
  const activeJsonString = activeJsonObject ? JSON.stringify(activeJsonObject, null, 2) : "{}";
  const activeJsonSizeKb = (new Blob([activeJsonString]).size / 1024).toFixed(1);

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(activeJsonString);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1800);
    } catch {
      // Ignore clipboard permission failure
    }
  };

  const handleDownloadJson = () => {
    const filename = activeJsonTab === "database" ? "database.json" : "sources.json";
    const blob = new Blob([activeJsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdateSchedule = async (patch: Record<string, unknown>) => {
    setSavingSchedule(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        await onRefreshAll();
      }
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleFullCrawlAllCountries = async () => {
    setCrawlingAll(true);
    setSyncFeedback(null);
    try {
      const res = await fetch("/api/crawl-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: "ALL",
          enrichWithAi: false,
          limitPerSource: 3,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        log?: { message: string };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || "全國家同步爬蟲失敗");
      }
      setSyncFeedback(body.log?.message || "已完成所有國家公開資料庫爬取與更新。");
      await onRefreshAll();
    } catch (err) {
      setSyncFeedback(err instanceof Error ? err.message : "爬蟲過程發生錯誤");
    } finally {
      setCrawlingAll(false);
    }
  };

  const handleToggleSource = async (id: string, currentEnabled: boolean) => {
    try {
      const res = await fetch(`/api/sources/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      if (res.ok) {
        await onRefreshAll();
      }
    } catch {
      // Handled silently
    }
  };

  const handleFetchSingleSource = async (id: string) => {
    setFetchingSourceId(id);
    setFetchError(null);
    setFetchedEntry(null);
    try {
      const res = await fetch(`/api/sources/${encodeURIComponent(id)}/fetch`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as CableEntry & { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "即時抓取該來源失敗");
      }
      setFetchedEntry(body);
      await onRefreshAll();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "抓取來源時發生錯誤");
    } finally {
      setFetchingSourceId(null);
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      const res = await fetch(`/api/sources/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConfirmDeleteSourceId(null);
        await onRefreshAll();
      }
    } catch {
      // Ignored silently
    }
  };

  const handleBatchEnrich = async () => {
    setBatchEnriching(true);
    setSyncFeedback(null);
    try {
      const res = await fetch("/api/database/enrich-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        enrichedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || "批次繁中翻譯失敗");
      }
      setSyncFeedback(`已完成 ${body.enrichedCount ?? 0} 筆外語紀錄的繁體中文結構化翻譯。`);
      await onRefreshAll();
    } catch (err) {
      setSyncFeedback(err instanceof Error ? err.message : "批次翻譯連線發生錯誤");
    } finally {
      setBatchEnriching(false);
    }
  };

  const handleDeleteSubscriber = async (id: string) => {
    try {
      const res = await fetch(`/api/subscriptions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadSubscribers();
      }
    } catch {
      // Ignored
    }
  };

  const handleAddSource = async (e: FormEvent) => {
    e.preventDefault();
    setSourceError(null);
    if (!newSourceName.trim() || !newSourceEndpoint.trim()) {
      setSourceError("請填寫來源名稱與端點 URL。");
      return;
    }

    const countryMeta = COUNTRY_OPTIONS.find((c) => c.code === newSourceCountry);
    setAddingSource(true);
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSourceName.trim(),
          category: newSourceCategory,
          sourceSector: newSourceSector,
          countryCode: newSourceCountry,
          region: countryMeta?.region || "全球",
          type: newSourceType,
          endpoint: newSourceEndpoint.trim(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "新增來源失敗");
      }
      setNewSourceName("");
      setNewSourceEndpoint("");
      setShowAddSource(false);
      await onRefreshAll();
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : "無法新增來源");
    } finally {
      setAddingSource(false);
    }
  };

  const handleManualSyncCheck = async () => {
    setSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        log?: { message: string };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || "執行檢查失敗");
      }
      setSyncFeedback(body.log?.message || "線纜檢查完成。");
      await onRefreshAll();
    } catch (err) {
      setSyncFeedback(err instanceof Error ? err.message : "連線檢查發生錯誤");
    } finally {
      setSyncing(false);
    }
  };

  const handleCrawlSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAnalyzeError(null);
    setCreatedEntry(null);
    setAnalyzing(true);
    const countryMeta = COUNTRY_OPTIONS.find((c) => c.code === crawlCountry);
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: crawlUrl.trim(),
          sourceName: crawlSourceName.trim(),
          keywords: crawlKeywords.trim(),
          categoryHint: crawlCategory,
          countryHint: crawlCountry,
          regionHint: countryMeta?.region || "全球",
          saveAsSource: crawlSaveSource,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        entry?: CableEntry;
        error?: string;
      };
      if (!res.ok || !body.entry) {
        throw new Error(body.error || "目標網址爬取失敗");
      }
      setCreatedEntry(body.entry);
      setCrawlUrl("");
      setCrawlKeywords("");
      await onRefreshAll();
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "爬文過程發生錯誤");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAnalyzeError(null);
    setCreatedEntry(null);
    setAnalyzing(true);
    const countryMeta = COUNTRY_OPTIONS.find((c) => c.code === ingestCountry);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceName: ingestSource.trim() || "Manual Pipeline Input",
          categoryHint: ingestCategory,
          countryHint: ingestCountry,
          regionHint: countryMeta?.region || "全球",
          versionHint: ingestVersion.trim(),
          url: ingestUrl.trim(),
          rawContent: ingestRaw.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as CableEntry & { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "內容重點整理執行失敗");
      }
      setCreatedEntry(body);
      setIngestRaw("");
      setIngestVersion("");
      setIngestUrl("");
      await onRefreshAll();
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "摘要過程發生錯誤");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[#37352F]">
            排班資料流、來源管理與自訂爬文設定
          </h1>
          <p className="text-sm text-[#787774]">
            管理多國公開資料庫排班週期、自訂目標網址爬文與即時推播，並檢視真實抓回的 database.json 與同步日誌。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleBatchEnrich}
            disabled={batchEnriching || crawlingAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] disabled:opacity-60 active:scale-[0.99] transition-all whitespace-nowrap"
          >
            {batchEnriching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Languages className="w-3.5 h-3.5 text-[#5B3A7D]" />
            )}
            <span>{batchEnriching ? "繁中翻譯中..." : "批次繁中轉譯"}</span>
          </button>

          <button
            type="button"
            onClick={handleManualSyncCheck}
            disabled={syncing || crawlingAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] disabled:opacity-60 active:scale-[0.99] transition-all whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "檢查端點中..." : "檢查端點狀態"}</span>
          </button>

          <button
            type="button"
            onClick={handleFullCrawlAllCountries}
            disabled={crawlingAll || syncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-60 active:scale-[0.99] transition-all whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${crawlingAll ? "animate-spin" : ""}`} />
            <span>{crawlingAll ? "全國家爬蟲同步中..." : "立即執行全國家全資料庫爬蟲"}</span>
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div className="bg-[#EDF5F0] border border-[#C7E0D0] rounded-md px-4 py-3 text-xs text-[#22643D]">
          {syncFeedback}
        </div>
      )}

      {/* Schedule & Auto-Push Configuration */}
      {sources && (
        <section
          id="schedule"
          aria-label="排班與自動化資料流設定"
          className="bg-white border border-[#E9E9E7] rounded-md p-5 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-[#37352F] flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#37352F]" />
                <span>自動化排班與資料流推播設定</span>
              </h2>
              <p className="text-xs text-[#787774]">
                設定背景自動爬取週期與跨時區早午晚班表，抓回的新聞與資安公告將自動更新至資料庫與 RSS Feed。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={savingSchedule}
                onClick={() =>
                  handleUpdateSchedule({ autoEnabled: !sources.pipeline.autoEnabled })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-[4px] border transition-colors whitespace-nowrap ${
                  sources.pipeline.autoEnabled
                    ? "bg-[#EDF5F0] text-[#22643D] border-[#C7E0D0]"
                    : "bg-[#F4F2EE] text-[#787774] border-[#E9E9E7]"
                }`}
              >
                {sources.pipeline.autoEnabled ? "背景排班：啟用中" : "背景排班：已暫停"}
              </button>

              <button
                type="button"
                disabled={savingSchedule}
                onClick={() =>
                  handleUpdateSchedule({ autoPushEnabled: !sources.pipeline.autoPushEnabled })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-[4px] border transition-colors whitespace-nowrap ${
                  sources.pipeline.autoPushEnabled
                    ? "bg-[#EEF2F9] text-[#2B4C7E] border-[#CBD7EC]"
                    : "bg-[#F4F2EE] text-[#787774] border-[#E9E9E7]"
                }`}
              >
                {sources.pipeline.autoPushEnabled ? "自動推播上架：啟用" : "自動推播上架：停用"}
              </button>

              <select
                value={sources.pipeline.intervalMinutes || 240}
                disabled={savingSchedule}
                onChange={(e) =>
                  handleUpdateSchedule({ intervalMinutes: Number(e.target.value) })
                }
                aria-label="自動同步週期"
                className="px-2.5 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F]"
              >
                <option value={60}>每 1 小時自動執行</option>
                <option value={120}>每 2 小時自動執行</option>
                <option value={240}>每 4 小時自動執行</option>
                <option value={480}>每 8 小時自動執行</option>
                <option value={1440}>每 24 小時自動執行</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] p-3 space-y-1">
              <div className="text-[#787774]">最近一次全庫同步</div>
              <div className="font-mono font-semibold text-[#37352F] tabular-nums">
                {formatDateTime(sources.pipeline.lastRunAt)}
              </div>
              <div className="text-[#787774]">狀態：{sources.pipeline.lastRunStatus}</div>
            </div>

            <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] p-3 space-y-1">
              <div className="text-[#787774]">下一次排程觸發時間</div>
              <div className="font-mono font-semibold text-[#37352F] tabular-nums">
                {sources.pipeline.nextRunAt ? formatDateTime(sources.pipeline.nextRunAt) : "—"}
              </div>
              <div className="text-[#787774]">{sources.pipeline.scheduleLabel}</div>
            </div>

            <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] p-3 space-y-1">
              <div className="text-[#787774]">多語翻譯與摘要引擎</div>
              <div className="font-mono font-semibold text-[#37352F]">
                {sources.pipeline.aiModel}
              </div>
              <div className="text-[#787774]">目標語系：{sources.pipeline.targetLanguage}</div>
            </div>
          </div>

          {/* 3 Shift Schedules */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#37352F]">跨國分區排班班表（點擊切換各班啟用狀態）</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(sources.pipeline.shifts ?? []).map((shift) => (
                <div
                  key={shift.id}
                  className="border border-[#E9E9E7] rounded-[4px] p-3.5 bg-[#FBFBFA] flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-[#37352F]">{shift.name}</div>
                      <div className="mt-0.5 text-[11px] font-mono text-[#787774]">
                        {shift.timeLabel} · {shift.cron}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={savingSchedule}
                      onClick={() =>
                        handleUpdateSchedule({
                          shiftId: shift.id,
                          shiftEnabled: !shift.enabled,
                        })
                      }
                      className={`px-2 py-0.5 text-[11px] font-medium rounded-[4px] border whitespace-nowrap shrink-0 ${
                        shift.enabled
                          ? "bg-[#EDF5F0] text-[#22643D] border-[#C7E0D0]"
                          : "bg-white text-[#787774] border-[#E9E9E7]"
                      }`}
                    >
                      {shift.enabled ? "排班中" : "已停用"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {shift.countries.map((code) => (
                      <span
                        key={code}
                        className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-[#E9E9E7] rounded-[3px] text-[#5A5852]"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pipeline Ingest & Custom URL Crawler Section */}
      <section
        id="ingest"
        aria-label="自訂網址爬文與重點整理"
        className="bg-white border border-[#E9E9E7] rounded-md p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[#37352F] flex items-center gap-2">
              {ingestMode === "crawl" ? (
                <Globe className="w-4 h-4 text-[#22643D]" />
              ) : (
                <FileText className="w-4 h-4 text-[#5B3A7D]" />
              )}
              <span>
                {ingestMode === "crawl"
                  ? "自訂目標網址與關鍵字即時爬文（含橫幅與圖示擷取）"
                  : "手動貼上新聞或異動文本進行重點整理"}
              </span>
            </h2>
            <p className="text-xs text-[#787774]">
              {ingestMode === "crawl"
                ? "支援跨國公開 RSS/Atom、新聞網頁 og:image 擷取、政府公告與 GitHub/CISA JSON，並自動寫入 database.json。"
                : "貼上任何語言新聞或官方公告原文，系統將自動翻譯並整理繁體中文摘要、國家分類與重要度分級。"}
            </p>
          </div>

          <div className="flex items-center border border-[#E9E9E7] rounded-[4px] bg-[#F7F6F3] p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIngestMode("crawl");
                setAnalyzeError(null);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-[3px] transition-colors whitespace-nowrap ${
                ingestMode === "crawl"
                  ? "bg-white text-[#37352F] shadow-2xs"
                  : "text-[#5A5852] hover:text-[#37352F]"
              }`}
            >
              網址爬文模式
            </button>
            <button
              type="button"
              onClick={() => {
                setIngestMode("text");
                setAnalyzeError(null);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-[3px] transition-colors whitespace-nowrap ${
                ingestMode === "text"
                  ? "bg-white text-[#37352F] shadow-2xs"
                  : "text-[#5A5852] hover:text-[#37352F]"
              }`}
            >
              文本貼上模式
            </button>
          </div>
        </div>

        {ingestMode === "crawl" ? (
          <form onSubmit={handleCrawlSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <label htmlFor="crawl-url" className="block text-xs text-[#787774] mb-1">
                  公開目標網址 (URL / RSS Feed)
                </label>
                <input
                  id="crawl-url"
                  type="url"
                  required
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  placeholder="https://feeds.bbci.co.uk/news/world/rss.xml"
                  className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
                />
              </div>

              <div>
                <label htmlFor="crawl-name" className="block text-xs text-[#787774] mb-1">
                  來源顯示名稱（選填）
                </label>
                <input
                  id="crawl-name"
                  type="text"
                  value={crawlSourceName}
                  onChange={(e) => setCrawlSourceName(e.target.value)}
                  placeholder="自動擷取網域名稱"
                  className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
                />
              </div>

              <div>
                <label htmlFor="crawl-kw" className="block text-xs text-[#787774] mb-1">
                  關鍵字過濾（選填）
                </label>
                <input
                  id="crawl-kw"
                  type="text"
                  value={crawlKeywords}
                  onChange={(e) => setCrawlKeywords(e.target.value)}
                  placeholder="例如：AI, Semiconductor, CVE"
                  className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <label htmlFor="crawl-cat" className="block text-xs text-[#787774] mb-1">
                  分類參考
                </label>
                <select
                  id="crawl-cat"
                  value={crawlCategory}
                  onChange={(e) => setCrawlCategory(e.target.value as CableCategory)}
                  className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="crawl-country" className="block text-xs text-[#787774] mb-1">
                  國家歸屬
                </label>
                <select
                  id="crawl-country"
                  value={crawlCountry}
                  onChange={(e) => setCrawlCountry(e.target.value as CountryCode)}
                  className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-[#5A5852] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crawlSaveSource}
                    onChange={(e) => setCrawlSaveSource(e.target.checked)}
                    className="rounded-[3px] border-[#D3D1CB]"
                  />
                  <span>加入排班監控資料流</span>
                </label>

                <button
                  type="submit"
                  disabled={analyzing || !crawlUrl.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-50 active:scale-[0.99] transition-all duration-150"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>正在爬取並生成摘要...</span>
                    </>
                  ) : (
                    <span>開始爬取與整理重點</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAnalyzeSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label htmlFor="ing-src" className="block text-xs text-[#787774] mb-1">
                  來源名稱
                </label>
                <input
                  id="ing-src"
                  type="text"
                  value={ingestSource}
                  onChange={(e) => setIngestSource(e.target.value)}
                  placeholder="例如：Reuters / OpenAI"
                  className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
                />
              </div>

              <div>
                <label htmlFor="ing-cat" className="block text-xs text-[#787774] mb-1">
                  分類參考
                </label>
                <select
                  id="ing-cat"
                  value={ingestCategory}
                  onChange={(e) => setIngestCategory(e.target.value as CableCategory)}
                  className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ing-country" className="block text-xs text-[#787774] mb-1">
                  國家歸屬
                </label>
                <select
                  id="ing-country"
                  value={ingestCountry}
                  onChange={(e) => setIngestCountry(e.target.value as CountryCode)}
                  className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ing-ver" className="block text-xs text-[#787774] mb-1">
                  版本號 / 識別碼
                </label>
                <input
                  id="ing-ver"
                  type="text"
                  value={ingestVersion}
                  onChange={(e) => setIngestVersion(e.target.value)}
                  placeholder="例如：CVE-2026-1024"
                  className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
                />
              </div>

              <div>
                <label htmlFor="ing-url" className="block text-xs text-[#787774] mb-1">
                  原文連結（選填）
                </label>
                <input
                  id="ing-url"
                  type="url"
                  value={ingestUrl}
                  onChange={(e) => setIngestUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="ing-raw" className="block text-xs text-[#787774] mb-1">
                原始新聞、公告或技術異動文本
              </label>
              <textarea
                id="ing-raw"
                rows={4}
                required
                value={ingestRaw}
                onChange={(e) => setIngestRaw(e.target.value)}
                placeholder="貼上跨國新聞內文、官方政策公告或 Release Notes..."
                className="w-full px-3 py-2 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={analyzing || ingestRaw.trim().length < 20}
                className="px-4 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-50 active:scale-[0.99] transition-all duration-150"
              >
                {analyzing ? "結構化整理中..." : "整理重點並寫入 database.json"}
              </button>
            </div>
          </form>
        )}

        {analyzeError && (
          <div className="p-3 bg-[#FDF6F6] border border-[#F5C2C2] rounded-[4px] text-xs text-[#9B2C2C]">
            {analyzeError}
          </div>
        )}

        {createdEntry && (
          <div className="p-3 bg-[#EDF5F0] border border-[#C7E0D0] rounded-[4px] flex flex-wrap items-center justify-between gap-2 text-xs text-[#22643D]">
            <span>已成功生成摘要並寫入 database.json：{createdEntry.title}</span>
            <Link
              to={`/post/${createdEntry.id}`}
              className="inline-flex items-center gap-1 font-semibold underline whitespace-nowrap"
            >
              <span>立即查看詳情</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* Sources Management Table */}
      <section aria-label="監控線纜來源管理" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#37352F]">
            全國家公開資料庫與新聞資料流 (sources.json · {sources?.sources.length ?? 0} 條)
          </h2>
          <button
            type="button"
            onClick={() => setShowAddSource((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] active:scale-[0.99]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新增公開來源</span>
          </button>
        </div>

        {fetchError && (
          <div className="p-3 bg-[#FDF6F6] border border-[#F5C2C2] rounded-[4px] text-xs text-[#9B2C2C]">
            {fetchError}
          </div>
        )}

        {fetchedEntry && (
          <div className="p-3 bg-[#EDF5F0] border border-[#C7E0D0] rounded-[4px] flex flex-wrap items-center justify-between gap-2 text-xs text-[#22643D]">
            <span>即時抓取完成：{fetchedEntry.title}</span>
            <Link
              to={`/post/${fetchedEntry.id}`}
              className="inline-flex items-center gap-1 font-semibold underline whitespace-nowrap"
            >
              <span>檢視內容</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {showAddSource && (
          <form
            onSubmit={handleAddSource}
            className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-md p-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <input
                type="text"
                placeholder="來源名稱（如 經濟部公告 / BBC）"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white border border-[#E9E9E7] rounded-[4px]"
              />
              <select
                value={newSourceSector}
                onChange={(e) => setNewSourceSector(e.target.value as SourceSector)}
                className="px-3 py-1.5 text-sm bg-white border border-[#E9E9E7] rounded-[4px]"
              >
                <option value="official">官方機構 (政府/CERT)</option>
                <option value="community">民間社群 (媒體/開源)</option>
              </select>
              <select
                value={newSourceCategory}
                onChange={(e) => setNewSourceCategory(e.target.value as CableCategory)}
                className="px-3 py-1.5 text-sm bg-white border border-[#E9E9E7] rounded-[4px]"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={newSourceCountry}
                onChange={(e) => setNewSourceCountry(e.target.value as CountryCode)}
                className="px-3 py-1.5 text-sm bg-white border border-[#E9E9E7] rounded-[4px]"
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="協定（RSS / JSON / HTML）"
                value={newSourceType}
                onChange={(e) => setNewSourceType(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white border border-[#E9E9E7] rounded-[4px]"
              />
              <input
                type="url"
                placeholder="端點 URL（https://...）"
                value={newSourceEndpoint}
                onChange={(e) => setNewSourceEndpoint(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white border border-[#E9E9E7] rounded-[4px]"
              />
            </div>
            {sourceError && <p className="text-xs text-[#9B2C2C]">{sourceError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddSource(false)}
                className="px-3 py-1.5 text-xs bg-white border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE]"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={addingSource}
                className="px-3 py-1.5 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28]"
              >
                {addingSource ? "儲存中..." : "儲存來源"}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E9E9E7] bg-[#F7F6F3] text-xs font-medium text-[#787774]">
                  <th className="py-2.5 px-4">狀態</th>
                  <th className="py-2.5 px-3">來源名稱</th>
                  <th className="py-2.5 px-3">國家</th>
                  <th className="py-2.5 px-3">分類</th>
                  <th className="py-2.5 px-3 text-right">累積擷取</th>
                  <th className="py-2.5 px-3 text-right">最近檢查</th>
                  <th className="py-2.5 px-4 text-right">即時抓取</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E7]">
                {(sources?.sources ?? []).map((src) => {
                  const isFetchingThis = fetchingSourceId === src.id;
                  const faviconSrc = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
                    (() => {
                      try {
                        return new URL(src.endpoint).hostname;
                      } catch {
                        return "cables.gg";
                      }
                    })()
                  )}&sz=64`;
                  return (
                    <tr key={src.id} className="hover:bg-[#F7F6F3]/60">
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleSource(src.id, src.enabled)}
                          className={`px-2 py-0.5 text-xs font-medium rounded-[4px] border transition-colors whitespace-nowrap ${
                            src.enabled
                              ? "bg-[#EDF5F0] text-[#22643D] border-[#C7E0D0]"
                              : "bg-[#F4F2EE] text-[#787774] border-[#E9E9E7]"
                          }`}
                        >
                          {src.enabled ? "啟用中" : "已暫停"}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <SafeSourceIcon
                            src={faviconSrc}
                            url={src.endpoint}
                            category={src.category}
                            alt={src.name}
                          />
                          <div className="font-medium text-[#37352F]">{src.name}</div>
                        </div>
                        <div className="text-[11px] font-mono text-[#9B9A97] truncate max-w-[260px] mt-0.5">
                          {src.endpoint}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <CountryTag countryCode={src.countryCode} countryName={src.countryName} />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <SectorTag
                            sector={
                              src.sourceSector ||
                              (/(\.gov|twcert|ncdr|ncsc|certeu|jpcert|nist|sec\.gov)/i.test(
                                src.endpoint
                              )
                                ? "official"
                                : "community")
                            }
                          />
                          <CategoryTag category={src.category} />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs text-[#37352F] tabular-nums">
                        {src.itemsCaptured}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs text-[#787774] tabular-nums whitespace-nowrap">
                        <div>{formatDateTime(src.lastCheckedAt)}</div>
                        <div className="text-[11px] text-[#9B9A97]">{src.lastStatus}</div>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleFetchSingleSource(src.id)}
                            disabled={fetchingSourceId !== null}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] disabled:opacity-50 active:scale-[0.99]"
                          >
                            {isFetchingThis ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>抓取中</span>
                              </>
                            ) : (
                              <span>抓取最新</span>
                            )}
                          </button>

                          {confirmDeleteSourceId === src.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDeleteSource(src.id)}
                                className="px-2 py-1 text-xs font-medium bg-[#9B2C2C] text-white rounded-[4px] hover:bg-[#7E2222]"
                              >
                                確認
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSourceId(null)}
                                className="px-2 py-1 text-xs bg-white border border-[#E9E9E7] rounded-[4px] text-[#5A5852]"
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSourceId(src.id)}
                              className="p-1 text-[#9B9A97] hover:text-[#9B2C2C] rounded-[4px] hover:bg-[#FDF6F6] transition-colors"
                              aria-label={`刪除來源 ${src.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Email Push Subscribers Management */}
      <section aria-label="推播訂閱名單管理" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#37352F] flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#787774]" />
            <span>推播訂閱者名單 (subscriptions.json · {subscribers.length} 位)</span>
          </h2>
          <a
            href="/rss.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-[#787774] hover:text-[#37352F] underline"
          >
            開啟 /rss.xml 推播頻道
          </a>
        </div>

        <div className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden">
          {subscribers.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#787774]">
              目前尚無 Email 訂閱者，可於首頁「訂閱最新動態與自動推播」模組新增接收通知的信箱。
            </div>
          ) : (
            <div className="divide-y divide-[#E9E9E7]">
              {subscribers.map((sub) => (
                <div
                  key={sub.id}
                  className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-medium text-[#37352F] truncate">
                      {sub.email}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[11px] rounded-[4px] border whitespace-nowrap ${
                        sub.scope === "high_risk_only"
                          ? "bg-[#FDEBEB] text-[#9B2C2C] border-[#F5C2C2]"
                          : "bg-[#EEF2F9] text-[#2B4C7E] border-[#CBD7EC]"
                      }`}
                    >
                      {sub.scope === "high_risk_only" ? "僅高風險異動" : "全部分類摘要"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-[#9B9A97] tabular-nums">
                      {formatDateTime(sub.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubscriber(sub.id)}
                      className="text-[#9B9A97] hover:text-[#9B2C2C] transition-colors"
                      aria-label={`移除訂閱者 ${sub.email}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* JSON File State Inspector */}
      <section aria-label="資料檔案狀態檢視" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#37352F] flex items-center gap-2">
            <FileJson className="w-4 h-4 text-[#787774]" />
            <span>核心 JSON 檔案狀態檢視</span>
          </h2>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center border border-[#E9E9E7] rounded-[4px] bg-white p-0.5">
              <button
                type="button"
                onClick={() => setActiveJsonTab("database")}
                className={`px-2.5 py-1 text-xs font-mono rounded-[3px] transition-colors ${
                  activeJsonTab === "database"
                    ? "bg-[#37352F] text-white"
                    : "text-[#5A5852] hover:bg-[#EFEFEE]"
                }`}
              >
                database.json
              </button>
              <button
                type="button"
                onClick={() => setActiveJsonTab("sources")}
                className={`px-2.5 py-1 text-xs font-mono rounded-[3px] transition-colors ${
                  activeJsonTab === "sources"
                    ? "bg-[#37352F] text-white"
                    : "text-[#5A5852] hover:bg-[#EFEFEE]"
                }`}
              >
                sources.json
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-white border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE]"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedJson ? "已複製" : "複製"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-white border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下載</span>
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden">
          <div className="px-4 py-2 bg-[#F7F6F3] border-b border-[#E9E9E7] flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#787774] tabular-nums">
            <span>
              /data/{activeJsonTab}.json · {activeJsonSizeKb} KB
            </span>
            <span>
              {activeJsonTab === "database"
                ? `Schema ${db?.schemaVersion ?? "—"} · ${db?.entries.length ?? 0} 筆真實索引`
                : `${sources?.sources.length ?? 0} 個來源 · ${sources?.syncLogs.length ?? 0} 筆日誌`}
            </span>
          </div>
          <pre className="p-4 text-xs font-mono text-[#37352F] max-h-[340px] overflow-auto leading-relaxed">
            <code>{activeJsonString}</code>
          </pre>
        </div>
      </section>

      {/* Automation Sync Logs */}
      <section aria-label="自動化同步日誌" className="space-y-3">
        <h2 className="text-base font-semibold text-[#37352F] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#787774]" />
          <span>自動化同步與排班執行日誌</span>
        </h2>

        <div className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E9E9E7] bg-[#F7F6F3] text-xs font-medium text-[#787774]">
                  <th className="py-2.5 px-4 whitespace-nowrap">執行時間</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">觸發方式</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">結果</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">耗時</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">任務標籤</th>
                  <th className="py-2.5 px-4">執行摘要</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E7]">
                {(sources?.syncLogs ?? []).map((log) => (
                  <tr key={log.id} className="hover:bg-[#F7F6F3]/60">
                    <td className="py-2.5 px-4 font-mono text-xs text-[#787774] tabular-nums whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-[#37352F] whitespace-nowrap">
                      {log.trigger}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-[4px] border whitespace-nowrap ${
                          log.status === "success"
                            ? "bg-[#EDF5F0] text-[#22643D] border-[#C7E0D0]"
                            : "bg-[#FEF6E0] text-[#8A5A00] border-[#F4DFAA]"
                        }`}
                      >
                        {log.status === "success" ? "成功" : "警告"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-[#787774] tabular-nums whitespace-nowrap">
                      {log.durationSeconds}s
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-[#787774] whitespace-nowrap">
                      {log.commitSha}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-[#37352F]">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
