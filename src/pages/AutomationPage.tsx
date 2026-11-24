import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Rss,
  Search,
  Send,
  Trash2,
  Webhook,
  Workflow,
} from "lucide-react";
import {
  COUNTRY_OPTIONS,
  type BlogProfileConfig,
  type CableCategory,
  type CountryCode,
  type DatabasePayload,
  type N8nPayload,
  type N8nTemplateFormat,
  type SourceSector,
  type SourcesPayload,
} from "../types/cables";
import { CountryTag, SectorTag, formatDateTime, formatShortDate } from "../components/NotionTags";
import { SafeSourceIcon } from "../components/SafeImage";
import { getCondensedDigest, getEntrySector } from "../utils/blogTemplates";

interface AutomationPageProps {
  db: DatabasePayload | null;
  sources: SourcesPayload | null;
  blogProfile: BlogProfileConfig | null;
  onRefreshAll: () => Promise<void>;
}

const CATEGORIES: Array<"all" | CableCategory> = [
  "all",
  "國際焦點",
  "財經科技",
  "資安公告",
  "自訂爬文",
  "API 變動",
  "GitHub 釋出",
  "Reddit 熱議",
];

export function AutomationPage({
  db,
  sources,
  blogProfile,
  onRefreshAll,
}: AutomationPageProps) {
  const [n8n, setN8n] = useState<N8nPayload | null>(null);
  const [loadingN8n, setLoadingN8n] = useState(true);

  // Function 1: Stream ingestion + selective import into user's configured Blog
  const [crawlCountry, setCrawlCountry] = useState<"ALL" | CountryCode>("ALL");
  const [crawlingStreams, setCrawlingStreams] = useState(false);
  const [crawlFeedback, setCrawlFeedback] = useState<string | null>(null);

  const [importSearch, setImportSearch] = useState("");
  const [importCountry, setImportCountry] = useState<"ALL" | CountryCode>("ALL");
  const [importSector, setImportSector] = useState<"all" | SourceSector>("all");
  const [importCategory, setImportCategory] = useState<"all" | CableCategory>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importingToBlog, setImportingToBlog] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // Add n8n webhook form
  const [hookName, setHookName] = useState("");
  const [hookUrl, setHookUrl] = useState("");
  const [hookTrigger, setHookTrigger] = useState<"all_new" | "high_risk" | "manual">("all_new");
  const [hookFormat, setHookFormat] = useState<N8nTemplateFormat>("blog_markdown");
  const [hookSector, setHookSector] = useState<"all" | SourceSector>("all");
  const [savingHook, setSavingHook] = useState(false);
  const [hookError, setHookError] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchStatusMsg, setDispatchStatusMsg] = useState<string | null>(null);

  // Embed & Blog export configurator
  const [embedCountry, setEmbedCountry] = useState<"ALL" | CountryCode>("ALL");
  const [embedSector, setEmbedSector] = useState<"all" | SourceSector>("all");
  const [embedCategory, setEmbedCategory] = useState<"all" | CableCategory>("all");
  const [embedTheme, setEmbedTheme] = useState<"light" | "dark">("light");
  const [embedLimit, setEmbedLimit] = useState<number>(5);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://cables.gg";
  const activeSlug = blogProfile?.slug || "my-cables";
  const importedBlogSet = useMemo(
    () => new Set(blogProfile?.importedEntryIds ?? []),
    [blogProfile?.importedEntryIds]
  );

  const candidateEntries = useMemo(() => {
    const q = importSearch.trim().toLowerCase();
    return (db?.entries ?? []).filter((entry) => {
      if (importCountry !== "ALL" && entry.countryCode !== importCountry) return false;
      if (importCategory !== "all" && entry.category !== importCategory) return false;
      if (importSector !== "all" && getEntrySector(entry) !== importSector) return false;
      if (q) {
        const hay = `${entry.title} ${entry.sourceName} ${entry.aiSummary}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [db?.entries, importSearch, importCountry, importSector, importCategory]);

  const handleRunStreamCrawl = async () => {
    setCrawlingStreams(true);
    setCrawlFeedback(null);
    try {
      const res = await fetch("/api/crawl-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: crawlCountry,
          limitPerSource: 2,
          enrichWithAi: false,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        log?: { message: string };
        newEntries?: number;
        totalEntries?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "同步資料串流失敗");
      await onRefreshAll();
      setCrawlFeedback(
        body.log?.message ||
          `已完成同步，新增 ${body.newEntries ?? 0} 篇真實文章（總計 ${body.totalEntries ?? 0} 篇）。`
      );
    } catch (err) {
      setCrawlFeedback(err instanceof Error ? err.message : "同步資料串流失敗");
    } finally {
      setCrawlingStreams(false);
    }
  };

  const toggleSelectEntry = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectTopTen = () => {
    const topIds = candidateEntries.slice(0, 10).map((e) => e.id);
    setSelectedIds(topIds);
  };

  const handleBatchImportToBlog = async () => {
    if (selectedIds.length === 0) return;
    setImportingToBlog(true);
    setImportFeedback(null);
    try {
      const res = await fetch("/api/blog-profile/import-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryIds: selectedIds,
          markSharedToBlog: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        importedCount?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "導入至個人 Blog 失敗");
      await onRefreshAll();
      setImportFeedback(
        `已成功導入 ${selectedIds.length} 篇文章至您的專屬 Blog（/b/${activeSlug}）。`
      );
      setSelectedIds([]);
    } catch (err) {
      setImportFeedback(err instanceof Error ? err.message : "導入失敗");
    } finally {
      setImportingToBlog(false);
    }
  };

  const fetchN8n = async () => {
    try {
      const res = await fetch("/api/n8n");
      if (res.ok) {
        const data = (await res.json()) as N8nPayload;
        setN8n(data);
      }
    } finally {
      setLoadingN8n(false);
    }
  };

  useEffect(() => {
    fetchN8n();
  }, []);

  const copyWithKey = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleCreateWebhook = async (e: FormEvent) => {
    e.preventDefault();
    setHookError(null);
    setSavingHook(true);
    try {
      const res = await fetch("/api/n8n/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: hookName.trim(),
          webhookUrl: hookUrl.trim(),
          triggerMode: hookTrigger,
          templateFormat: hookFormat,
          sectorFilter: hookSector,
          countries: ["ALL"],
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "新增 n8n Webhook 失敗");
      }
      setHookName("");
      setHookUrl("");
      await fetchN8n();
    } catch (err) {
      setHookError(err instanceof Error ? err.message : "無法建立 Webhook");
    } finally {
      setSavingHook(false);
    }
  };

  const handleToggleWebhook = async (id: string, current: boolean) => {
    const res = await fetch(`/api/n8n/webhooks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !current }),
    });
    if (res.ok) await fetchN8n();
  };

  const handleDeleteWebhook = async (id: string) => {
    const res = await fetch(`/api/n8n/webhooks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) await fetchN8n();
  };

  const handleTestDispatch = async (webhookId: string) => {
    setDispatchingId(webhookId);
    setDispatchStatusMsg(null);
    try {
      const res = await fetch("/api/n8n/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookId, limit: 3 }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        log?: { message: string };
        error?: string;
      };
      setDispatchStatusMsg(body.log?.message || body.error || "已執行測試傳送。");
      await fetchN8n();
    } finally {
      setDispatchingId(null);
    }
  };

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (embedCountry !== "ALL") p.set("country", embedCountry);
    if (embedSector !== "all") p.set("sector", embedSector);
    if (embedCategory !== "all") p.set("category", embedCategory);
    return p.toString();
  }, [embedCountry, embedSector, embedCategory]);

  const blogRssUrl = `${origin}/rss/blog.xml${queryParams ? `?${queryParams}` : ""}`;
  const jsonFeedUrl = `${origin}/feed.json${queryParams ? `?${queryParams}` : ""}`;
  const embedIframeUrl = `${origin}/embed?country=${encodeURIComponent(embedCountry)}&sector=${encodeURIComponent(embedSector)}&category=${encodeURIComponent(embedCategory)}&theme=${embedTheme}&limit=${embedLimit}`;
  const iframeCode = `<iframe src="${embedIframeUrl}" width="100%" height="520" style="border:1px solid #E9E9E7;border-radius:6px;" loading="lazy"></iframe>`;
  const scriptCode = `<div id="cables-blog-widget"></div>\n<script src="${origin}/api/embed/widget.js?country=${encodeURIComponent(embedCountry)}&sector=${encodeURIComponent(embedSector)}&theme=${embedTheme}&limit=${embedLimit}"></script>`;

  const handleExportMarkdownBundle = () => {
    const entries = (db?.entries ?? [])
      .filter((entry) => {
        if (embedCountry !== "ALL" && entry.countryCode !== embedCountry) return false;
        if (embedCategory !== "all" && entry.category !== embedCategory) return false;
        if (embedSector !== "all" && getEntrySector(entry) !== embedSector) return false;
        return true;
      })
      .slice(0, 20);

    const bundle = entries.map((e) => getCondensedDigest(e).markdown).join("\n\n---\n\n");
    const blob = new Blob([bundle], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cables-blog-digest-${embedCountry.toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalSourcesCount = sources?.sources.length ?? 0;
  const activeSourcesCount = (sources?.sources ?? []).filter((s) => s.enabled).length;

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#E9E9E7] pb-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#787774]">
            <Workflow className="w-3.5 h-3.5" />
            <span>功能一 · 自動化引進與文章導入整合中心</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#37352F]">
            自動化引進資料串流與文章導入中心
          </h1>
          <p className="text-sm text-[#787774] max-w-2xl">
            先透過多國公開串流與 n8n 自動引進最新文章，再挑選您要的條目一鍵整合導入至獨立設定的個人專屬 Blog 頁面路由。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to={`/b/${activeSlug}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>前往開啟我的 Blog (/b/{activeSlug})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <a
            href="/api/n8n/workflow-template.json"
            download="cables-gg-n8n-workflow.json"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下載 n8n JSON</span>
          </a>
        </div>
      </div>

      {/* Section 0: Function 1 Core — Live Crawl New Streams & Select Articles to Import into Blog */}
      <section aria-label="自動化文章引進與導入個人 Blog" className="space-y-5">
        <div className="bg-white border border-[#E9E9E7] rounded-md p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E9E9E7] pb-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-[#37352F]">
                1. 自動化引進新串流 ＆ 勾選文章導入個人 Blog
              </h2>
              <p className="text-xs text-[#787774] font-mono tabular-nums">
                已掛載 {totalSourcesCount} 個真實公開串流（{activeSourcesCount} 個啟用中）· 目前資料庫共{" "}
                {db?.totalRecords ?? 0} 筆文章 · 專屬 Blog 已收錄 {importedBlogSet.size} 篇
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={crawlCountry}
                onChange={(e) => setCrawlCountry(e.target.value as "ALL" | CountryCode)}
                aria-label="選擇即時爬取的國家"
                className="px-2.5 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F]"
              >
                <option value="ALL">全部國家與新增串流</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleRunStreamCrawl}
                disabled={crawlingStreams}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {crawlingStreams ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{crawlingStreams ? "正在同步串流..." : "立即抓取新增資料串流"}</span>
              </button>

              <Link
                to="/settings"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
              >
                <span>管理 RSS 串流來源</span>
              </Link>
            </div>
          </div>

          {crawlFeedback && (
            <div className="p-3 bg-[#EDF5F0] border border-[#C7E0D0] rounded-[4px] text-xs text-[#22643D]">
              {crawlFeedback}
            </div>
          )}

          {/* Article Selection Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-[#9B9A97] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
                placeholder="搜尋要導入的文章標題、來源或關鍵字..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] focus:outline-none focus:border-[#37352F]"
              />
            </div>

            <select
              value={importCountry}
              onChange={(e) => setImportCountry(e.target.value as "ALL" | CountryCode)}
              aria-label="篩選引進文章國家"
              className="px-2.5 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]"
            >
              <option value="ALL">全部國家地區</option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>

            <select
              value={importSector}
              onChange={(e) => setImportSector(e.target.value as "all" | SourceSector)}
              aria-label="篩選官民屬性"
              className="px-2.5 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]"
            >
              <option value="all">官方 + 民間全來源</option>
              <option value="official">僅官方機構</option>
              <option value="community">僅民間與寫作者</option>
            </select>

            <select
              value={importCategory}
              onChange={(e) => setImportCategory(e.target.value as "all" | CableCategory)}
              aria-label="篩選文章分類"
              className="px-2.5 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "全部分類主題" : c}
                </option>
              ))}
            </select>
          </div>

          {/* Selection Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[#787774]" />
              <span className="text-[#5A5852] tabular-nums">
                符合篩選共 {candidateEntries.length} 篇（已勾選 {selectedIds.length} 篇）
              </span>
              <button
                type="button"
                onClick={selectTopTen}
                className="px-2 py-1 bg-white border border-[#E9E9E7] rounded-[3px] text-[#37352F] hover:bg-[#EFEFEE]"
              >
                勾選前 10 篇
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-2 py-1 text-[#787774] hover:text-[#37352F]"
                >
                  清除勾選
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleBatchImportToBlog}
              disabled={importingToBlog || selectedIds.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#22643D] text-white rounded-[4px] hover:bg-[#1B5232] disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              {importingToBlog ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>
                導入勾選文章至我的 Blog (/b/{activeSlug})
              </span>
            </button>
          </div>

          {importFeedback && (
            <div className="p-3 bg-[#EDF5F0] border border-[#C7E0D0] rounded-[4px] flex flex-wrap items-center justify-between gap-2 text-xs text-[#22643D]">
              <span>{importFeedback}</span>
              <Link to={`/b/${activeSlug}`} className="font-semibold underline whitespace-nowrap">
                立即開啟 /b/{activeSlug} 檢視導入結果 →
              </Link>
            </div>
          )}

          {/* Candidate Articles List */}
          <div className="border border-[#E9E9E7] rounded-[4px] divide-y divide-[#E9E9E7] max-h-[380px] overflow-y-auto">
            {candidateEntries.slice(0, 25).map((entry) => {
              const checked = selectedIds.includes(entry.id);
              const alreadyInBlog = importedBlogSet.has(entry.id) || Boolean(entry.sharedToBlog);
              return (
                <label
                  key={entry.id}
                  className={`px-3.5 py-2.5 flex items-start gap-3 cursor-pointer hover:bg-[#FBFBFA] transition-colors ${
                    checked ? "bg-[#F7F6F3]" : "bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelectEntry(entry.id)}
                    className="mt-1 rounded border-[#D3D1CB]"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#37352F] line-clamp-1">
                        {entry.title}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {alreadyInBlog && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#EDF5F0] text-[#22643D] border border-[#C7E0D0] rounded-[3px]">
                            已導入 Blog
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-[#9B9A97] tabular-nums">
                          {formatShortDate(entry.publishedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#787774]">
                      <span className="inline-flex items-center gap-1">
                        <SafeSourceIcon
                          src={entry.sourceIcon}
                          url={entry.url}
                          category={entry.category}
                          alt={entry.sourceName}
                          className="w-3 h-3"
                        />
                        <span>{entry.sourceName}</span>
                      </span>
                      <SectorTag sector={getEntrySector(entry)} />
                      <CountryTag countryCode={entry.countryCode} countryName={entry.countryName} />
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 2: n8n Outbound Webhooks & Inbound HTTP APIs */}
      <section aria-label="n8n 自動化連線設定" className="space-y-6">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-[#37352F]" />
          <h2 className="text-base font-semibold text-[#37352F]">
            2. n8n 雙向自動化連線（Outbound Webhook + Inbound API）
          </h2>
        </div>

        {/* Add Outbound Webhook Card */}
        <form
          onSubmit={handleCreateWebhook}
          className="bg-white border border-[#E9E9E7] rounded-md p-5 space-y-4"
        >
          <div className="text-xs font-semibold text-[#37352F] flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>新增 n8n 自動推播 Webhook 目標（排程抓到新官民情資時自動發送模板）</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label htmlFor="n8n-name" className="block text-xs text-[#787774] mb-1">
                連線名稱
              </label>
              <input
                id="n8n-name"
                type="text"
                required
                value={hookName}
                onChange={(e) => setHookName(e.target.value)}
                placeholder="例如：Notion 個人 Blog 自動發文"
                className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
              />
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="n8n-url" className="block text-xs text-[#787774] mb-1">
                n8n Webhook URL
              </label>
              <input
                id="n8n-url"
                type="url"
                required
                value={hookUrl}
                onChange={(e) => setHookUrl(e.target.value)}
                placeholder="https://your-n8n.example.com/webhook/cables-blog"
                className="w-full px-3 py-1.5 text-sm font-mono bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
              />
            </div>

            <div>
              <label htmlFor="n8n-trigger" className="block text-xs text-[#787774] mb-1">
                自動觸發條件
              </label>
              <select
                id="n8n-trigger"
                value={hookTrigger}
                onChange={(e) =>
                  setHookTrigger(e.target.value as "all_new" | "high_risk" | "manual")
                }
                className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]"
              >
                <option value="all_new">每次新抓取自動推播</option>
                <option value="high_risk">僅高風險公告自動推播</option>
                <option value="manual">僅手動一鍵傳送</option>
              </select>
            </div>

            <div>
              <label htmlFor="n8n-format" className="block text-xs text-[#787774] mb-1">
                傳送模板格式
              </label>
              <select
                id="n8n-format"
                value={hookFormat}
                onChange={(e) => setHookFormat(e.target.value as N8nTemplateFormat)}
                className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]"
              >
                <option value="blog_markdown">個人 Blog Markdown</option>
                <option value="json_digest">結構化重點 JSON</option>
                <option value="html_card">HTML 卡片</option>
                <option value="newsletter">電子報精簡短訊</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#787774]">來源屬性過濾：</span>
              <select
                value={hookSector}
                onChange={(e) => setHookSector(e.target.value as "all" | SourceSector)}
                aria-label="Webhook 來源屬性過濾"
                className="px-2.5 py-1 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]"
              >
                <option value="all">官方 + 民間全收錄</option>
                <option value="official">僅官方機構公告</option>
                <option value="community">僅民間社群與媒體</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={savingHook || !hookName.trim() || !hookUrl.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-50"
            >
              {savingHook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Webhook className="w-3.5 h-3.5" />}
              <span>儲存 n8n Webhook</span>
            </button>
          </div>

          {hookError && <p className="text-xs text-[#9B2C2C]">{hookError}</p>}
        </form>

        {dispatchStatusMsg && (
          <div className="p-3 bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] text-xs text-[#37352F]">
            {dispatchStatusMsg}
          </div>
        )}

        {/* Saved Webhooks Table */}
        <div className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden">
          <div className="px-4 py-2.5 bg-[#F7F6F3] border-b border-[#E9E9E7] flex items-center justify-between text-xs font-medium text-[#787774]">
            <span>已設定的 n8n Outbound Webhooks ({n8n?.webhooks.length ?? 0})</span>
            <span>支援手動測試與排程自動發送</span>
          </div>

          {loadingN8n ? (
            <div className="p-6 text-xs text-[#787774]">載入 n8n 設定中...</div>
          ) : (n8n?.webhooks ?? []).length === 0 ? (
            <div className="p-6 text-center text-xs text-[#787774]">
              尚未建立 n8n Outbound Webhook。您可於上方新增 Webhook URL，或直接複製下方 Inbound API 給 n8n 呼叫。
            </div>
          ) : (
            <div className="divide-y divide-[#E9E9E7]">
              {(n8n?.webhooks ?? []).map((hook) => (
                <div
                  key={hook.id}
                  className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#37352F]">{hook.name}</span>
                      <span className="px-1.5 py-0.5 font-mono bg-[#F7F6F3] border border-[#E9E9E7] rounded-[3px] text-[11px]">
                        {hook.templateFormat}
                      </span>
                      <span className="px-1.5 py-0.5 bg-[#EEF2F9] text-[#2B4C7E] border border-[#CBD7EC] rounded-[3px] text-[11px]">
                        {hook.triggerMode === "all_new"
                          ? "新抓全推"
                          : hook.triggerMode === "high_risk"
                            ? "僅高風險"
                            : "僅手動"}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-[#787774] truncate max-w-md">
                      {hook.webhookUrl}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleWebhook(hook.id, hook.enabled)}
                      className={`px-2.5 py-1 rounded-[4px] border font-medium ${
                        hook.enabled
                          ? "bg-[#EDF5F0] text-[#22643D] border-[#C7E0D0]"
                          : "bg-[#F4F2EE] text-[#787774] border-[#E9E9E7]"
                      }`}
                    >
                      {hook.enabled ? "啟用中" : "已停用"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTestDispatch(hook.id)}
                      disabled={dispatchingId === hook.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE]"
                    >
                      {dispatchingId === hook.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span>測試傳送 3 筆</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteWebhook(hook.id)}
                      className="p-1 text-[#9B9A97] hover:text-[#9B2C2C]"
                      aria-label={`刪除 Webhook ${hook.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inbound n8n Node Endpoints */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-[#E9E9E7] rounded-md p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#37352F]">
                n8n Inbound 觸發全國官民爬蟲 API (POST)
              </span>
              <button
                type="button"
                onClick={() => copyWithKey("trigger", `${origin}/api/n8n/trigger-crawl`)}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#787774] hover:text-[#37352F]"
              >
                {copiedKey === "trigger" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === "trigger" ? "已複製" : "複製端點"}</span>
              </button>
            </div>
            <div className="px-2.5 py-1.5 bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] font-mono text-[11px] text-[#37352F] break-all">
              POST {origin}/api/n8n/trigger-crawl
            </div>
            <pre className="p-2.5 bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] font-mono text-[11px] text-[#5A5852] overflow-x-auto">
              <code>{`{\n  "countryCode": "ALL",\n  "sourceSector": "all",\n  "templateFormat": "blog_markdown"\n}`}</code>
            </pre>
          </div>

          <div className="bg-white border border-[#E9E9E7] rounded-md p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#37352F]">
                n8n 推入外部文章並轉化為 Blog API (POST)
              </span>
              <button
                type="button"
                onClick={() => copyWithKey("ingest", `${origin}/api/n8n/ingest`)}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#787774] hover:text-[#37352F]"
              >
                {copiedKey === "ingest" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === "ingest" ? "已複製" : "複製端點"}</span>
              </button>
            </div>
            <div className="px-2.5 py-1.5 bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] font-mono text-[11px] text-[#37352F] break-all">
              POST {origin}/api/n8n/ingest
            </div>
            <pre className="p-2.5 bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] font-mono text-[11px] text-[#5A5852] overflow-x-auto">
              <code>{`{\n  "url": "https://example.org/news-article",\n  "countryHint": "TW",\n  "sourceSector": "official"\n}`}</code>
            </pre>
          </div>
        </div>

        {/* n8n Dispatch Logs */}
        {(n8n?.dispatchLogs ?? []).length > 0 && (
          <div className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden">
            <div className="px-4 py-2 bg-[#F7F6F3] border-b border-[#E9E9E7] text-xs font-medium text-[#787774]">
              最近 n8n 傳送紀錄
            </div>
            <div className="divide-y divide-[#E9E9E7]">
              {(n8n?.dispatchLogs ?? []).slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded-[3px] border text-[11px] font-mono ${
                        log.ok
                          ? "bg-[#EDF5F0] text-[#22643D] border-[#C7E0D0]"
                          : "bg-[#FDEBEB] text-[#9B2C2C] border-[#F5C2C2]"
                      }`}
                    >
                      {log.statusCode ?? "ERR"}
                    </span>
                    <span className="font-medium text-[#37352F]">{log.webhookName}</span>
                    <span className="text-[#787774] truncate max-w-sm">{log.entryTitle}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-[#787774] tabular-nums">
                    <span>{log.message}</span>
                    <span>{formatDateTime(log.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Section 3: External Embed Widget & Personal Blog RSS Export Generator */}
      <section aria-label="外部網站嵌入與個人 Blog 轉換生成器" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#37352F]" />
            <h2 className="text-base font-semibold text-[#37352F]">
              3. 提供他人嵌入與訂閱的個人 Blog 轉換生成器
            </h2>
          </div>

          <button
            type="button"
            onClick={handleExportMarkdownBundle}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>匯出精選 Blog Markdown 合輯 (.md)</span>
          </button>
        </div>

        {/* Config Controls */}
        <div className="bg-white border border-[#E9E9E7] rounded-md p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label htmlFor="emb-country" className="block text-xs text-[#787774] mb-1">
                國家地區篩選
              </label>
              <select
                id="emb-country"
                value={embedCountry}
                onChange={(e) => setEmbedCountry(e.target.value as "ALL" | CountryCode)}
                className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]"
              >
                <option value="ALL">ALL · 全部國家</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="emb-sector" className="block text-xs text-[#787774] mb-1">
                官方 / 民間來源
              </label>
              <select
                id="emb-sector"
                value={embedSector}
                onChange={(e) => setEmbedSector(e.target.value as "all" | SourceSector)}
                className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]"
              >
                <option value="all">官民全部整合</option>
                <option value="official">僅官方機構</option>
                <option value="community">僅民間社群與媒體</option>
              </select>
            </div>

            <div>
              <label htmlFor="emb-cat" className="block text-xs text-[#787774] mb-1">
                主題分類
              </label>
              <select
                id="emb-cat"
                value={embedCategory}
                onChange={(e) => setEmbedCategory(e.target.value as "all" | CableCategory)}
                className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "all" ? "全部分類" : cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="emb-theme" className="block text-xs text-[#787774] mb-1">
                嵌入面板外觀
              </label>
              <select
                id="emb-theme"
                value={embedTheme}
                onChange={(e) => setEmbedTheme(e.target.value as "light" | "dark")}
                className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]"
              >
                <option value="light">Notion 淺色紙張</option>
                <option value="dark">深色閱讀模式</option>
              </select>
            </div>

            <div>
              <label htmlFor="emb-limit" className="block text-xs text-[#787774] mb-1">
                顯示筆數
              </label>
              <select
                id="emb-limit"
                value={embedLimit}
                onChange={(e) => setEmbedLimit(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]"
              >
                <option value={3}>最新 3 篇重點</option>
                <option value={5}>最新 5 篇重點</option>
                <option value={10}>最新 10 篇重點</option>
              </select>
            </div>
          </div>

          {/* 4 Copyable Export Channels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#37352F] inline-flex items-center gap-1.5">
                  <Rss className="w-3.5 h-3.5 text-[#8F4B14]" />
                  <span>個人 Blog 重點轉換版 RSS 2.0</span>
                </span>
                <button
                  type="button"
                  onClick={() => copyWithKey("blog-rss", blogRssUrl)}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-[#37352F] hover:underline"
                >
                  {copiedKey === "blog-rss" ? <Check className="w-3 h-3 text-[#22643D]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === "blog-rss" ? "已複製" : "複製 RSS URL"}</span>
                </button>
              </div>
              <div className="font-mono text-[11px] text-[#5A5852] break-all">{blogRssUrl}</div>
            </div>

            <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#37352F]">JSON Feed 1.1 (Hugo / Astro / n8n)</span>
                <button
                  type="button"
                  onClick={() => copyWithKey("json-feed", jsonFeedUrl)}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-[#37352F] hover:underline"
                >
                  {copiedKey === "json-feed" ? <Check className="w-3 h-3 text-[#22643D]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === "json-feed" ? "已複製" : "複製 JSON Feed"}</span>
                </button>
              </div>
              <div className="font-mono text-[11px] text-[#5A5852] break-all">{jsonFeedUrl}</div>
            </div>

            <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#37352F]">外部網站 &lt;iframe&gt; 嵌入碼</span>
                <button
                  type="button"
                  onClick={() => copyWithKey("iframe", iframeCode)}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-[#37352F] hover:underline"
                >
                  {copiedKey === "iframe" ? <Check className="w-3 h-3 text-[#22643D]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === "iframe" ? "已複製" : "複製 Iframe"}</span>
                </button>
              </div>
              <pre className="font-mono text-[11px] text-[#5A5852] whitespace-pre-wrap break-all">
                <code>{iframeCode}</code>
              </pre>
            </div>

            <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#37352F]">原生 JavaScript Widget (&lt;script&gt;)</span>
                <button
                  type="button"
                  onClick={() => copyWithKey("script", scriptCode)}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-[#37352F] hover:underline"
                >
                  {copiedKey === "script" ? <Check className="w-3 h-3 text-[#22643D]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === "script" ? "已複製" : "複製 Script"}</span>
                </button>
              </div>
              <pre className="font-mono text-[11px] text-[#5A5852] whitespace-pre-wrap break-all">
                <code>{scriptCode}</code>
              </pre>
            </div>
          </div>

          {/* Live Embed Iframe Preview */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#37352F]">外部嵌入即時畫面預覽</span>
              <a
                href={embedIframeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#787774] hover:text-[#37352F]"
              >
                <span>在新分頁開啟嵌入頁</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <iframe
              title="Cables.gg Embed Widget Preview"
              src={embedIframeUrl}
              className="w-full h-[460px] border border-[#E9E9E7] rounded-md bg-white"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
