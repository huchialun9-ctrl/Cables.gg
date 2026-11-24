import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Flame,
  RotateCcw,
  Table as TableIcon,
  LayoutGrid,
  Download,
  Image as ImageIcon,
  Languages,
  Loader2,
  Bookmark,
  BookmarkCheck,
  Columns3,
} from "lucide-react";
import {
  COUNTRY_OPTIONS,
  type CableCategory,
  type CountryCode,
  type DatabasePayload,
  type RiskLevel,
  type SourceSector,
} from "../types/cables";
import {
  CategoryTag,
  CountryTag,
  RiskTag,
  SectorTag,
  formatShortDate,
} from "../components/NotionTags";
import { SafeBannerImage, SafeSourceIcon } from "../components/SafeImage";
import { getEntrySector } from "../utils/blogTemplates";

interface DatabasePageProps {
  db: DatabasePayload | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRefresh?: () => Promise<void>;
}

type SortField = "publishedAt" | "riskLevel" | "heatScore";
type SortOrder = "desc" | "asc";
type ViewMode = "table" | "board" | "gallery";

const RISK_WEIGHT: Record<RiskLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const CATEGORY_OPTIONS: Array<"all" | CableCategory> = [
  "all",
  "國際焦點",
  "財經科技",
  "資安公告",
  "自訂爬文",
  "API 變動",
  "GitHub 釋出",
  "Reddit 熱議",
];

const RISK_OPTIONS: Array<{ value: "all" | RiskLevel; label: string }> = [
  { value: "all", label: "全部重要度" },
  { value: "high", label: "頭條焦點" },
  { value: "medium", label: "重點報導" },
  { value: "low", label: "一般快訊" },
];

function isValidCategory(val: string | null): val is CableCategory {
  return (
    val === "國際焦點" ||
    val === "財經科技" ||
    val === "資安公告" ||
    val === "自訂爬文" ||
    val === "API 變動" ||
    val === "Reddit 熱議" ||
    val === "GitHub 釋出"
  );
}

function isValidCountry(val: string | null): val is CountryCode {
  return COUNTRY_OPTIONS.some((c) => c.code === val);
}

export function DatabasePage({ db, loading, error, onRetry, onRefresh }: DatabasePageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQuery = searchParams.get("q") || "";
  const initialCategory = searchParams.get("category");
  const initialRisk = searchParams.get("risk");
  const initialCountry = searchParams.get("country");
  const initialSector = searchParams.get("sector");
  const initialView = searchParams.get("view");
  const initialBookmarked = searchParams.get("bookmarked") === "1";

  const [query, setQuery] = useState(initialQuery);
  const [onlyWithImages, setOnlyWithImages] = useState(false);
  const [onlyBookmarked, setOnlyBookmarked] = useState(initialBookmarked);
  const [togglingBookmarkId, setTogglingBookmarkId] = useState<string | null>(null);
  const [batchEnriching, setBatchEnriching] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialView === "gallery" ? "gallery" : initialView === "board" ? "board" : "table"
  );
  const [categoryFilter, setCategoryFilter] = useState<"all" | CableCategory>(
    isValidCategory(initialCategory) ? initialCategory : "all"
  );
  const [countryFilter, setCountryFilter] = useState<"all" | CountryCode>(
    isValidCountry(initialCountry) ? initialCountry : "all"
  );
  const [sectorFilter, setSectorFilter] = useState<"all" | SourceSector>(
    initialSector === "official" || initialSector === "community" ? initialSector : "all"
  );
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>(
    initialRisk === "high" || initialRisk === "medium" || initialRisk === "low"
      ? initialRisk
      : "all"
  );
  const [regionFilter, setRegionFilter] = useState<string>(
    () => searchParams.get("region") || "all"
  );
  const [sortField, setSortField] = useState<SortField>("publishedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    const qParam = searchParams.get("q") || "";
    const cat = searchParams.get("category");
    const risk = searchParams.get("risk");
    const country = searchParams.get("country");
    const sector = searchParams.get("sector");
    const view = searchParams.get("view");
    const region = searchParams.get("region") || "all";
    const bookmarkedParam = searchParams.get("bookmarked") === "1";

    setQuery(qParam);
    setOnlyBookmarked(bookmarkedParam);
    setRegionFilter(region);
    setCategoryFilter(isValidCategory(cat) ? cat : "all");
    setCountryFilter(isValidCountry(country) ? country : "all");
    setSectorFilter(sector === "official" || sector === "community" ? sector : "all");
    setRiskFilter(
      risk === "high" || risk === "medium" || risk === "low" ? risk : "all"
    );
    if (view === "gallery" || view === "table" || view === "board") {
      setViewMode(view);
    }
  }, [searchParams]);

  const updateFilterParams = (
    nextCat: "all" | CableCategory,
    nextRisk: "all" | RiskLevel,
    nextCountry: "all" | CountryCode,
    nextView: ViewMode = viewMode,
    nextQuery: string = query,
    nextSector: "all" | SourceSector = sectorFilter,
    nextBookmarked: boolean = onlyBookmarked,
    nextRegion: string = regionFilter
  ) => {
    const next = new URLSearchParams();
    if (nextQuery.trim()) next.set("q", nextQuery.trim());
    if (nextCat !== "all") next.set("category", nextCat);
    if (nextRisk !== "all") next.set("risk", nextRisk);
    if (nextCountry !== "all") next.set("country", nextCountry);
    if (nextSector !== "all") next.set("sector", nextSector);
    if (nextRegion && nextRegion !== "all") next.set("region", nextRegion);
    if (nextView === "gallery" || nextView === "board") next.set("view", nextView);
    if (nextBookmarked) next.set("bookmarked", "1");
    setSearchParams(next, { replace: true });
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    updateFilterParams(categoryFilter, riskFilter, countryFilter, viewMode, val, sectorFilter);
  };

  const handleCategoryChange = (cat: "all" | CableCategory) => {
    setCategoryFilter(cat);
    updateFilterParams(cat, riskFilter, countryFilter, viewMode, query, sectorFilter);
  };

  const handleCountryChange = (country: "all" | CountryCode) => {
    setCountryFilter(country);
    updateFilterParams(categoryFilter, riskFilter, country, viewMode, query, sectorFilter);
  };

  const handleSectorChange = (sector: "all" | SourceSector) => {
    setSectorFilter(sector);
    updateFilterParams(categoryFilter, riskFilter, countryFilter, viewMode, query, sector);
  };

  const handleRiskChange = (risk: "all" | RiskLevel) => {
    setRiskFilter(risk);
    updateFilterParams(categoryFilter, risk, countryFilter, viewMode, query, sectorFilter);
  };

  const handleRegionChange = (region: string) => {
    setRegionFilter(region);
    updateFilterParams(
      categoryFilter,
      riskFilter,
      countryFilter,
      viewMode,
      query,
      sectorFilter,
      onlyBookmarked,
      region
    );
  };

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    updateFilterParams(categoryFilter, riskFilter, countryFilter, mode, query, sectorFilter);
  };

  const handleToggleBookmark = async (
    e: React.MouseEvent,
    entryId: string,
    currentBookmarked: boolean
  ) => {
    e.stopPropagation();
    setTogglingBookmarkId(entryId);
    try {
      const res = await fetch(
        `/api/database/${encodeURIComponent(entryId)}/reader-actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookmarked: !currentBookmarked }),
        }
      );
      if (res.ok && onRefresh) {
        await onRefresh();
      }
    } finally {
      setTogglingBookmarkId(null);
    }
  };

  const handleResetFilters = () => {
    setQuery("");
    setOnlyWithImages(false);
    setOnlyBookmarked(false);
    setCategoryFilter("all");
    setCountryFilter("all");
    setRegionFilter("all");
    setSectorFilter("all");
    setRiskFilter("all");
    setSortField("publishedAt");
    setSortOrder("desc");
    setSearchParams({}, { replace: true });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredEntries = useMemo(() => {
    const entries = db?.entries ?? [];
    const q = query.trim().toLowerCase();

    return entries
      .filter((entry) => {
        if (onlyBookmarked && !entry.bookmarked) return false;
        if (categoryFilter !== "all" && entry.category !== categoryFilter) return false;
        if (riskFilter !== "all" && entry.riskLevel !== riskFilter) return false;
        if (countryFilter !== "all" && entry.countryCode !== countryFilter) return false;
        if (regionFilter !== "all") {
          const normalized = entry.region === "台灣" ? "亞太" : entry.region;
          if (normalized !== regionFilter && entry.region !== regionFilter) return false;
        }
        if (sectorFilter !== "all" && getEntrySector(entry) !== sectorFilter) return false;
        if (onlyWithImages && !entry.bannerImage?.trim()) return false;
        if (!q) return true;
        return (
          entry.title.toLowerCase().includes(q) ||
          (entry.originalTitle || "").toLowerCase().includes(q) ||
          entry.aiSummary.toLowerCase().includes(q) ||
          entry.sourceName.toLowerCase().includes(q) ||
          entry.countryName.toLowerCase().includes(q) ||
          entry.countryCode.toLowerCase().includes(q) ||
          entry.version.toLowerCase().includes(q) ||
          entry.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "publishedAt") {
          cmp = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
        } else if (sortField === "riskLevel") {
          cmp = RISK_WEIGHT[a.riskLevel] - RISK_WEIGHT[b.riskLevel];
        } else if (sortField === "heatScore") {
          cmp = a.heatScore - b.heatScore;
        }
        return sortOrder === "desc" ? -cmp : cmp;
      });
  }, [db?.entries, query, categoryFilter, riskFilter, countryFilter, regionFilter, sectorFilter, onlyWithImages, onlyBookmarked, sortField, sortOrder]);

  const unenrichedCount = useMemo(
    () => (db?.entries ?? []).filter((e) => !e.aiEnriched && e.originalLanguage !== "ZH").length,
    [db?.entries]
  );

  const handleBatchEnrich = async () => {
    setBatchEnriching(true);
    setBatchMessage(null);
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
      setBatchMessage(`已完成 ${body.enrichedCount ?? 0} 筆外語項目繁體中文結構化翻譯。`);
      if (onRefresh) await onRefresh();
    } catch (err) {
      setBatchMessage(err instanceof Error ? err.message : "批次翻譯連線失敗");
    } finally {
      setBatchEnriching(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ["id", "title", "countryCode", "countryName", "category", "riskLevel", "sourceName", "version", "publishedAt", "url"];
    const escapeCsv = (val: string) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = [
      headers.join(","),
      ...filteredEntries.map((e) =>
        [
          e.id,
          e.title,
          e.countryCode,
          e.countryName,
          e.category,
          e.riskLevel,
          e.sourceName,
          e.version,
          e.publishedAt,
          e.url,
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ];
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cables-index-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters =
    query.trim() !== "" ||
    onlyWithImages ||
    onlyBookmarked ||
    categoryFilter !== "all" ||
    riskFilter !== "all" ||
    countryFilter !== "all" ||
    regionFilter !== "all" ||
    sectorFilter !== "all";

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-[#9B9A97]" />;
    }
    return sortOrder === "desc" ? (
      <ArrowDown className="w-3.5 h-3.5 text-[#37352F]" />
    ) : (
      <ArrowUp className="w-3.5 h-3.5 text-[#37352F]" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Database Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[#37352F]">
            跨國新聞媒體與公開資訊完整資料庫
          </h1>
          <p className="text-sm text-[#787774]">
            即時收錄 9 大國家地區主流新聞媒體、官方公告、自訂網頁爬文與開發者釋出，支援表格、狀態看板與圖卡畫廊檢視。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="text-xs font-mono text-[#787774] tabular-nums">
            顯示 {filteredEntries.length} / {db?.entries.length ?? 0} 筆
          </div>
          {unenrichedCount > 0 && (
            <button
              type="button"
              onClick={handleBatchEnrich}
              disabled={batchEnriching}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] disabled:opacity-50 whitespace-nowrap"
            >
              {batchEnriching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Languages className="w-3.5 h-3.5 text-[#5B3A7D]" />
              )}
              <span>{batchEnriching ? "繁中翻譯中..." : `批次繁中翻譯 (${Math.min(5, unenrichedCount)} 筆)`}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredEntries.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>匯出 CSV</span>
          </button>
          <div className="flex items-center border border-[#E9E9E7] rounded-[4px] bg-white p-0.5">
            <button
              type="button"
              onClick={() => handleViewChange("table")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-[3px] transition-colors whitespace-nowrap ${
                viewMode === "table"
                  ? "bg-[#37352F] text-white font-medium"
                  : "text-[#5A5852] hover:bg-[#EFEFEE]"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>表格清單</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("board")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-[3px] transition-colors whitespace-nowrap ${
                viewMode === "board"
                  ? "bg-[#37352F] text-white font-medium"
                  : "text-[#5A5852] hover:bg-[#EFEFEE]"
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>狀態看板</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("gallery")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-[3px] transition-colors whitespace-nowrap ${
                viewMode === "gallery"
                  ? "bg-[#37352F] text-white font-medium"
                  : "text-[#5A5852] hover:bg-[#EFEFEE]"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>圖卡畫廊</span>
            </button>
          </div>
        </div>
      </div>

      {batchMessage && (
        <div className="p-3 bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] text-xs text-[#37352F]">
          {batchMessage}
        </div>
      )}

      {/* Notion-style Filter & Search Toolbar */}
      <div className="bg-white border border-[#E9E9E7] rounded-md p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Global Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9B9A97] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="搜尋新聞標題、國家、來源網站、CVE 編號、標籤或摘要關鍵字..."
              aria-label="全域關鍵字搜尋"
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] placeholder:text-[#9B9A97] focus:outline-none focus:border-[#37352F] transition-colors"
            />
          </div>

          {/* Multi-field Sort Controls */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className="text-xs text-[#787774]">排序：</span>
            {(
              [
                { field: "publishedAt", label: "時間" },
                { field: "riskLevel", label: "重要度" },
                { field: "heatScore", label: "討論熱度" },
              ] as const
            ).map((opt) => {
              const active = sortField === opt.field;
              return (
                <button
                  key={opt.field}
                  type="button"
                  onClick={() => toggleSort(opt.field)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-[4px] border transition-colors duration-150 whitespace-nowrap active:scale-[0.99] ${
                    active
                      ? "bg-[#EFEFEE] border-[#D3D1CB] text-[#37352F] font-medium"
                      : "bg-white border-[#E9E9E7] text-[#5A5852] hover:bg-[#EFEFEE]"
                  }`}
                >
                  <span>{opt.label}</span>
                  {renderSortIcon(opt.field)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category, Country & Risk Filter Buttons */}
        <div className="space-y-2.5 pt-2.5 border-t border-[#E9E9E7]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-[#787774] mr-1">分類：</span>
              {CATEGORY_OPTIONS.map((opt) => {
                const active = categoryFilter === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleCategoryChange(opt)}
                    className={`px-2.5 py-1 text-xs rounded-[4px] border transition-colors duration-150 whitespace-nowrap active:scale-[0.99] ${
                      active
                        ? "bg-[#37352F] text-white border-[#37352F] font-medium"
                        : "bg-white text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
                    }`}
                  >
                    {opt === "all" ? "全部分類" : opt}
                  </button>
                );
              })}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#787774] hover:text-[#37352F] hover:bg-[#EFEFEE] rounded-[4px] transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>清除篩選</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-[#787774] mr-1">國家：</span>
              <button
                type="button"
                onClick={() => handleCountryChange("all")}
                className={`px-2.5 py-1 text-xs rounded-[4px] border transition-colors duration-150 whitespace-nowrap ${
                  countryFilter === "all"
                    ? "bg-[#37352F] text-white border-[#37352F] font-medium"
                    : "bg-white text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
                }`}
              >
                全部國家
              </button>
              {COUNTRY_OPTIONS.map((c) => {
                const active = countryFilter === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleCountryChange(c.code)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-[4px] border transition-colors duration-150 whitespace-nowrap ${
                      active
                        ? "bg-[#37352F] text-white border-[#37352F] font-medium"
                        : "bg-white text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-75">{c.code}</span>
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-[#787774] mr-1">地區：</span>
              {(
                [
                  { value: "all", label: "全部地區" },
                  { value: "亞太", label: "亞太" },
                  { value: "北美", label: "北美" },
                  { value: "歐洲", label: "歐洲" },
                  { value: "全球", label: "全球" },
                ] as const
              ).map((reg) => {
                const active = regionFilter === reg.value;
                return (
                  <button
                    key={reg.value}
                    type="button"
                    onClick={() => handleRegionChange(reg.value)}
                    className={`px-2 py-1 text-xs rounded-[4px] border transition-colors whitespace-nowrap ${
                      active
                        ? "bg-[#37352F] text-white border-[#37352F] font-medium"
                        : "bg-white text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
                    }`}
                  >
                    {reg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-[#787774] mr-1">性質：</span>
                {(
                  [
                    { value: "all", label: "全部來源" },
                    { value: "official", label: "官方機構" },
                    { value: "community", label: "民間社群" },
                  ] as const
                ).map((opt) => {
                  const active = sectorFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSectorChange(opt.value)}
                      className={`px-2.5 py-1 text-xs rounded-[4px] border transition-colors duration-150 whitespace-nowrap active:scale-[0.99] ${
                        active
                          ? "bg-[#37352F] text-white border-[#37352F] font-medium"
                          : "bg-white text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-[#787774] mr-1">重要度：</span>
                {RISK_OPTIONS.map((opt) => {
                  const active = riskFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleRiskChange(opt.value)}
                      className={`px-2.5 py-1 text-xs rounded-[4px] border transition-colors duration-150 whitespace-nowrap active:scale-[0.99] ${
                        active
                          ? "bg-[#37352F] text-white border-[#37352F] font-medium"
                          : "bg-white text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !onlyBookmarked;
                  setOnlyBookmarked(next);
                  updateFilterParams(
                    categoryFilter,
                    riskFilter,
                    countryFilter,
                    viewMode,
                    query,
                    sectorFilter,
                    next
                  );
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-[4px] border transition-colors whitespace-nowrap ${
                  onlyBookmarked
                    ? "bg-[#22643D] text-white border-[#22643D] font-medium"
                    : "bg-white text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
                }`}
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
                <span>我的個人知識庫</span>
              </button>

              <button
                type="button"
                onClick={() => setOnlyWithImages((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-[4px] border transition-colors whitespace-nowrap ${
                  onlyWithImages
                    ? "bg-[#37352F] text-white border-[#37352F] font-medium"
                    : "bg-white text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>僅顯示含來源實景圖片</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Loading / Error / Empty / Table or Gallery */}
      {loading && !db ? (
        <div className="bg-white border border-[#E9E9E7] rounded-md divide-y divide-[#E9E9E7]">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 px-4 flex items-center gap-4">
              <div className="h-4 bg-[#F4F2EE] rounded w-1/2" />
              <div className="h-4 bg-[#F4F2EE] rounded w-20" />
              <div className="h-4 bg-[#F4F2EE] rounded w-16" />
            </div>
          ))}
        </div>
      ) : error && !db ? (
        <div className="bg-white border border-[#E9E9E7] rounded-md p-8 text-center space-y-3">
          <p className="text-sm text-[#9B2C2C]">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px]"
          >
            重試
          </button>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-white border border-[#E9E9E7] rounded-md p-10 text-center space-y-3">
          <p className="text-sm font-medium text-[#37352F]">找不到符合條件的索引紀錄</p>
          <p className="text-xs text-[#787774]">
            請嘗試調整搜尋關鍵字，或重設分類、國家與重要度過濾條件。
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] active:scale-[0.99]"
          >
            重設所有過濾條件
          </button>
        </div>
      ) : viewMode === "board" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {(
            [
              { level: "high" as RiskLevel, title: "頭條焦點", chipClass: "bg-[#FBEAEA] text-[#8E352E]" },
              { level: "medium" as RiskLevel, title: "重點報導", chipClass: "bg-[#FBF3DB] text-[#8A5A00]" },
              { level: "low" as RiskLevel, title: "一般快訊", chipClass: "bg-[#E9F3EC] text-[#22643D]" },
            ] as const
          ).map((col) => {
            const colEntries = filteredEntries.filter((e) => e.riskLevel === col.level);
            return (
              <div
                key={col.level}
                className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-md p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-[11px] font-medium rounded-[3px] ${col.chipClass}`}>
                      {col.title}
                    </span>
                    <span className="text-xs font-mono text-[#787774] tabular-nums">
                      {colEntries.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 max-h-[680px] overflow-y-auto pr-0.5">
                  {colEntries.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#9B9A97] border border-dashed border-[#E9E9E7] rounded-[4px] bg-white/50">
                      此欄位尚無紀錄
                    </div>
                  ) : (
                    colEntries.map((entry) => (
                      <div
                        key={entry.id}
                        onClick={() => navigate(`/post/${entry.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/post/${entry.id}`);
                          }
                        }}
                        tabIndex={0}
                        role="link"
                        className="bg-white border border-[#E9E9E7] rounded-[4px] p-3 space-y-2 hover:border-[#D3D1CB] cursor-pointer transition-colors group shadow-[0_1px_2px_rgba(55,53,47,0.03)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <SafeSourceIcon
                              src={entry.sourceIcon}
                              url={entry.url}
                              category={entry.category}
                              alt={entry.sourceName}
                              className="w-4 h-4 shrink-0"
                            />
                            <span className="text-[11px] text-[#787774] truncate">
                              {entry.sourceName} · {entry.countryName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) =>
                              handleToggleBookmark(e, entry.id, Boolean(entry.bookmarked))
                            }
                            disabled={togglingBookmarkId === entry.id}
                            aria-label={entry.bookmarked ? "取消知識庫收藏" : "收藏至個人知識庫"}
                            className={`p-1 rounded-[3px] shrink-0 transition-colors ${
                              entry.bookmarked
                                ? "text-[#22643D] bg-[#E9F3EC]"
                                : "text-[#9B9A97] hover:text-[#37352F] hover:bg-[#EFEFEE]"
                            }`}
                          >
                            {entry.bookmarked ? (
                              <BookmarkCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Bookmark className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="text-xs font-semibold text-[#37352F] leading-snug group-hover:underline line-clamp-2">
                          {entry.title}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <CategoryTag category={entry.category} />
                            <SectorTag sector={getEntrySector(entry)} />
                          </div>
                          <span className="text-[10px] font-mono text-[#9B9A97] tabular-nums">
                            {formatShortDate(entry.publishedAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === "gallery" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => navigate(`/post/${entry.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/post/${entry.id}`);
                }
              }}
              tabIndex={0}
              role="link"
              className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden flex flex-col hover:border-[#D3D1CB] cursor-pointer transition-colors group"
            >
              <SafeBannerImage
                src={entry.bannerImage}
                alt={entry.title}
                category={entry.category}
                wrapperClassName="aspect-[16/9] w-full bg-[#F4F2EE] border-b border-[#E9E9E7] overflow-hidden"
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
              />

              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <SafeSourceIcon
                        src={entry.sourceIcon}
                        url={entry.url}
                        category={entry.category}
                        alt={entry.sourceName}
                      />
                      <span className="text-xs font-mono text-[#787774] truncate">
                        {entry.sourceName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <RiskTag level={entry.riskLevel} />
                      <button
                        type="button"
                        onClick={(e) =>
                          handleToggleBookmark(e, entry.id, Boolean(entry.bookmarked))
                        }
                        disabled={togglingBookmarkId === entry.id}
                        aria-label={entry.bookmarked ? "取消知識庫收藏" : "收藏至個人知識庫"}
                        className={`p-1 rounded-[3px] transition-colors ${
                          entry.bookmarked
                            ? "text-[#22643D] bg-[#E9F3EC]"
                            : "text-[#9B9A97] hover:text-[#37352F] hover:bg-[#EFEFEE]"
                        }`}
                      >
                        {entry.bookmarked ? (
                          <BookmarkCheck className="w-3.5 h-3.5" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-[#37352F] leading-snug group-hover:underline line-clamp-2">
                    {entry.title}
                  </h3>

                  <p className="text-xs text-[#787774] line-clamp-2 leading-relaxed">
                    {entry.aiSummary}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-[#E9E9E7] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CountryTag countryCode={entry.countryCode} countryName={entry.countryName} />
                    <SectorTag sector={getEntrySector(entry)} />
                    <CategoryTag category={entry.category} />
                  </div>
                  <span className="text-[11px] font-mono text-[#9B9A97] tabular-nums">
                    {formatShortDate(entry.publishedAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E9E9E7] bg-[#F7F6F3] text-xs font-medium text-[#787774]">
                  <th className="py-2.5 px-4 min-w-[300px]">圖示 · 名稱與摘要</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">國家</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">分類</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("riskLevel")}
                      className="inline-flex items-center gap-1 hover:text-[#37352F]"
                    >
                      <span>重要度</span>
                      {renderSortIcon("riskLevel")}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap">來源 / 識別</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("heatScore")}
                      className="inline-flex items-center gap-1 hover:text-[#37352F] ml-auto"
                    >
                      <span>熱度</span>
                      {renderSortIcon("heatScore")}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">討論</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("publishedAt")}
                      className="inline-flex items-center gap-1 hover:text-[#37352F] ml-auto"
                    >
                      <span>發布日期</span>
                      {renderSortIcon("publishedAt")}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">收藏</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E7] text-sm">
                {filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => navigate(`/post/${entry.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/post/${entry.id}`);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    className="hover:bg-[#F7F6F3] cursor-pointer transition-colors duration-150 focus:outline-none focus:bg-[#EFEFEE]"
                  >
                    <td className="py-3 px-4 align-top">
                      <div className="flex items-start gap-3">
                        <SafeBannerImage
                          src={entry.bannerImage}
                          alt={entry.title}
                          category={entry.category}
                          wrapperClassName="w-14 h-9 rounded-[4px] border border-[#E9E9E7] overflow-hidden shrink-0 bg-[#F4F2EE] mt-0.5"
                          className="w-full h-full object-cover"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-[#37352F] leading-snug line-clamp-2">
                            {entry.title}
                          </div>
                          <div className="mt-1 text-xs text-[#787774] line-clamp-1">
                            {entry.aiSummary}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <CountryTag countryCode={entry.countryCode} countryName={entry.countryName} />
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <CategoryTag category={entry.category} />
                        <SectorTag sector={getEntrySector(entry)} />
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <RiskTag level={entry.riskLevel} />
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="flex items-center gap-1.5">
                        <SafeSourceIcon
                          src={entry.sourceIcon}
                          url={entry.url}
                          category={entry.category}
                          alt={entry.sourceName}
                        />
                        <span className="text-xs font-medium text-[#37352F] whitespace-nowrap">
                          {entry.sourceName}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] font-mono text-[#787774] whitespace-nowrap">
                        {entry.version}
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top text-right font-mono text-xs text-[#37352F] tabular-nums whitespace-nowrap">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Flame className="w-3.5 h-3.5 text-[#8F4B14]" />
                        {entry.heatScore}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top text-right font-mono text-xs text-[#787774] tabular-nums whitespace-nowrap">
                      <span className="inline-flex items-center justify-end gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {entry.commentCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top text-right font-mono text-xs text-[#787774] tabular-nums whitespace-nowrap">
                      {formatShortDate(entry.publishedAt)}
                    </td>
                    <td className="py-3 px-3 align-top text-center">
                      <button
                        type="button"
                        onClick={(e) =>
                          handleToggleBookmark(e, entry.id, Boolean(entry.bookmarked))
                        }
                        disabled={togglingBookmarkId === entry.id}
                        aria-label={entry.bookmarked ? "取消知識庫收藏" : "收藏至個人知識庫"}
                        className={`p-1.5 rounded-[4px] transition-colors ${
                          entry.bookmarked
                            ? "text-[#22643D] bg-[#E9F3EC]"
                            : "text-[#9B9A97] hover:text-[#37352F] hover:bg-[#EFEFEE]"
                        }`}
                      >
                        {entry.bookmarked ? (
                          <BookmarkCheck className="w-3.5 h-3.5" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
