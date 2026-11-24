import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Flame,
  RefreshCw,
  Clock,
  Globe,
  Search,
  BookOpen,
  Workflow,
  MapPin,
  Newspaper,
  Rss,
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
import {
  CategoryTag,
  CountryTag,
  RiskTag,
  SectorTag,
  formatDateTime,
  formatShortDate,
} from "../components/NotionTags";
import { SubscribeModule } from "../components/SubscribeModule";
import { TrendSparkChart } from "../components/TrendSparkChart";
import { CustomCrawlBar } from "../components/CustomCrawlBar";
import { SafeBannerImage, SafeSourceIcon } from "../components/SafeImage";
import {
  CountryOnboardingGate,
  type WorkspacePrefs,
} from "../components/CountryOnboardingGate";
import {
  InteractiveWorldMap,
  type MapRegionFilter,
} from "../components/InteractiveWorldMap";
import { getEntrySector } from "../utils/blogTemplates";

interface HomePageProps {
  db: DatabasePayload | null;
  sources: SourcesPayload | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRefresh: () => Promise<void>;
}

const PREFS_STORAGE_KEY = "cables_workspace_prefs";

function loadWorkspacePrefs(): WorkspacePrefs | null {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspacePrefs;
    if (typeof parsed?.confirmed === "boolean") return parsed;
    return null;
  } catch {
    return null;
  }
}

const CATEGORIES: CableCategory[] = [
  "國際焦點",
  "財經科技",
  "資安公告",
  "自訂爬文",
  "API 變動",
  "GitHub 釋出",
  "Reddit 熱議",
];

export function HomePage({ db, sources, loading, error, onRetry, onRefresh }: HomePageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [prefs, setPrefs] = useState<WorkspacePrefs | null>(() => loadWorkspacePrefs());
  const [selectedCountry, setSelectedCountry] = useState<"ALL" | "MY_PREFS" | CountryCode>(() => {
    const saved = loadWorkspacePrefs();
    if (!saved?.confirmed || !saved.countries || saved.countries.length === 0) return "ALL";
    if (saved.countries.length === 1) return saved.countries[0];
    return "MY_PREFS";
  });
  const [selectedSector, setSelectedSector] = useState<"all" | SourceSector>(
    () => loadWorkspacePrefs()?.sector || "all"
  );
  const [selectedRegion, setSelectedRegion] = useState<MapRegionFilter>("ALL");
  const [heroQuery, setHeroQuery] = useState("");
  const [crawlingAll, setCrawlingAll] = useState(false);
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null);

  const forceSetup = searchParams.get("setup") === "1";

  useEffect(() => {
    if (forceSetup) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [forceSetup]);

  const allEntries = db?.entries ?? [];

  const heroMatchCount = useMemo(() => {
    const q = heroQuery.trim().toLowerCase();
    if (!q) return null;
    return allEntries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.aiSummary.toLowerCase().includes(q) ||
        e.sourceName.toLowerCase().includes(q) ||
        e.countryName.toLowerCase().includes(q) ||
        e.version.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    ).length;
  }, [allEntries, heroQuery]);

  const handleHeroSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = heroQuery.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (selectedCountry !== "ALL" && selectedCountry !== "MY_PREFS") {
      params.set("country", selectedCountry);
    }
    if (selectedRegion !== "ALL") {
      params.set("region", selectedRegion);
    }
    if (selectedSector !== "all") params.set("sector", selectedSector);
    const qs = params.toString();
    navigate(qs ? `/database?${qs}` : "/database");
  };

  const countryCounts = useMemo(() => {
    const map: Record<string, number> = { ALL: allEntries.length };
    for (const c of COUNTRY_OPTIONS) {
      map[c.code] = 0;
    }
    for (const entry of allEntries) {
      const code = entry.countryCode || "GLOBAL";
      map[code] = (map[code] || 0) + 1;
    }
    return map;
  }, [allEntries]);

  const sectorCounts = useMemo(() => {
    let official = 0;
    let community = 0;
    for (const entry of allEntries) {
      if (getEntrySector(entry) === "official") official += 1;
      else community += 1;
    }
    return { official, community };
  }, [allEntries]);

  const myPrefsCountries = prefs?.countries ?? [];
  const myPrefsCount = useMemo(() => {
    if (myPrefsCountries.length === 0) return allEntries.length;
    const set = new Set(myPrefsCountries);
    return allEntries.filter((e) => set.has(e.countryCode)).length;
  }, [allEntries, myPrefsCountries]);

  const entries = useMemo(() => {
    return allEntries.filter((e) => {
      if (selectedCountry === "MY_PREFS") {
        if (myPrefsCountries.length > 0 && !myPrefsCountries.includes(e.countryCode)) {
          return false;
        }
      } else if (selectedCountry !== "ALL" && e.countryCode !== selectedCountry) {
        return false;
      }
      if (selectedRegion !== "ALL") {
        const normalizedRegion = e.region === "台灣" ? "亞太" : e.region;
        if (normalizedRegion !== selectedRegion) return false;
      }
      if (selectedSector !== "all" && getEntrySector(e) !== selectedSector) return false;
      return true;
    });
  }, [allEntries, selectedCountry, selectedRegion, myPrefsCountries, selectedSector]);

  const handleOnboardingComplete = async (
    nextPrefs: WorkspacePrefs,
    crawlNotice?: string | null
  ) => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(nextPrefs));
    } catch {
      // Ignore storage quota issues
    }
    setPrefs(nextPrefs);
    setSelectedSector(nextPrefs.sector);
    if (nextPrefs.countries.length === 1) {
      setSelectedCountry(nextPrefs.countries[0]);
    } else if (nextPrefs.countries.length > 1) {
      setSelectedCountry("MY_PREFS");
    } else {
      setSelectedCountry("ALL");
    }
    if (crawlNotice) {
      setCrawlMessage(crawlNotice);
    }
    if (forceSetup) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("setup");
      setSearchParams(nextParams, { replace: true });
    }
    await onRefresh();
  };

  const handleCancelOnboarding = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("setup");
    setSearchParams(nextParams, { replace: true });
  };

  const handlePublishBlogBatch = async (publishAllCountries: boolean) => {
    setCrawlingAll(true);
    setCrawlMessage(null);
    try {
      let countriesPayload: "ALL" | CountryCode[] = "ALL";
      if (!publishAllCountries) {
        if (selectedCountry === "MY_PREFS" && myPrefsCountries.length > 0) {
          countriesPayload = myPrefsCountries;
        } else if (selectedCountry !== "ALL" && selectedCountry !== "MY_PREFS") {
          countriesPayload = [selectedCountry];
        } else if (selectedRegion !== "ALL") {
          const regionCodes = COUNTRY_OPTIONS.filter((c) => c.region === selectedRegion).map(
            (c) => c.code
          );
          if (regionCodes.length > 0) countriesPayload = regionCodes;
        }
      }

      const res = await fetch("/api/publish-blog-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countries: countriesPayload,
          sectorFilter: publishAllCountries ? "all" : selectedSector,
          limitPerSource: 2,
          autoTranslate: prefs?.autoTranslate ?? true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        log?: { message: string };
        translationWarning?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || "即時抓取與 Blog 發布失敗");
      }
      const msg = [body.log?.message, body.translationWarning].filter(Boolean).join(" ");
      setCrawlMessage(msg || "已完成最新各國媒體抓取並整理上架 Blog。");
      await onRefresh();
    } catch (err) {
      setCrawlMessage(err instanceof Error ? err.message : "媒體爬蟲與上架過程發生錯誤");
    } finally {
      setCrawlingAll(false);
    }
  };

  if (loading && !db) {
    return (
      <div className="space-y-8">
        <div className="h-32 bg-[#F4F2EE] border border-[#E9E9E7] rounded-md" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-white border border-[#E9E9E7] rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 bg-white border border-[#E9E9E7] rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !db) {
    return (
      <div className="bg-white border border-[#E9E9E7] rounded-md p-8 text-center space-y-3">
        <p className="text-sm font-medium text-[#9B2C2C]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28]"
        >
          重新載入資料
        </button>
      </div>
    );
  }

  if (forceSetup) {
    return (
      <CountryOnboardingGate
        db={db}
        sources={sources}
        initialPrefs={prefs}
        onComplete={handleOnboardingComplete}
        onCancel={handleCancelOnboarding}
      />
    );
  }

  const latestDatePrefix = entries.length > 0 ? entries[0].publishedAt.slice(0, 10) : "";
  const todaysHeadlines = latestDatePrefix
    ? entries.filter(
        (entry) => entry.riskLevel === "high" && entry.publishedAt.startsWith(latestDatePrefix)
      )
    : [];
  const activeHeadlines =
    todaysHeadlines.length > 0
      ? todaysHeadlines.slice(0, 4)
      : entries.filter((entry) => entry.riskLevel === "high").slice(0, 4);

  const featuredVisualEntries = entries
    .filter(
      (e) =>
        Boolean(e.bannerImage?.trim()) &&
        !e.bannerImage.startsWith("/src/assets/images/banner_")
    )
    .slice(0, 4);
  const enabledSourcesCount = sources?.sources.filter((s) => s.enabled).length ?? 0;
  const totalSourcesCount = sources?.sources.length ?? 0;
  const activeShiftsCount = sources?.pipeline.shifts?.filter((s) => s.enabled).length ?? 0;

  const getEntriesByCategory = (cat: CableCategory): CableEntry[] => {
    return entries
      .filter((e) => e.category === cat)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 2);
  };

  const selectedCountryLabel =
    selectedRegion !== "ALL" && selectedCountry === "ALL"
      ? `${selectedRegion === "全球" ? "全球跨國" : `${selectedRegion}地區`}媒體與公開資訊`
      : selectedCountry === "ALL"
        ? "全球全部國家視角"
        : selectedCountry === "MY_PREFS"
          ? myPrefsCountries.length > 0
            ? `我的關注國家 (${myPrefsCountries.join(" / ")})`
            : "全球全部國家視角"
          : `${COUNTRY_OPTIONS.find((c) => c.code === selectedCountry)?.name ?? selectedCountry} 媒體與公開資訊`;

  const handleUseGlobalDefault = () => {
    const defaultPrefs: WorkspacePrefs = {
      confirmed: true,
      countries: [],
      sector: "all",
      autoTranslate: true,
    };
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(defaultPrefs));
    } catch {
      // Ignore storage error
    }
    setPrefs(defaultPrefs);
  };

  return (
    <div className="space-y-8">
      {/* First-Visit Notion Callout Banner (non-blocking so World Map & Live Feeds load immediately) */}
      {!prefs?.confirmed && (
        <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-[6px] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5 text-xs text-[#37352F]">
            <MapPin className="w-4 h-4 text-[#22643D] shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>個人化國家與新聞設定：</strong>
              可偵測所在地並挑選想追蹤的國家媒體與官方資源，系統會自動翻譯並整合至個人 Blog。
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchParams({ setup: "1" })}
              className="px-3 py-1.5 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] whitespace-nowrap"
            >
              開啟國家定位精靈
            </button>
            <button
              type="button"
              onClick={handleUseGlobalDefault}
              className="px-2.5 py-1.5 text-xs text-[#787774] hover:text-[#37352F] hover:bg-[#EFEFEE] rounded-[4px] whitespace-nowrap"
            >
              先維持全球預設
            </button>
          </div>
        </div>
      )}
      {/* Top Overview Split: Concise Title & Intro + D3.js 7-Day Trend Chart */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#37352F] text-balance">
              Cables.gg
            </h1>
            <p className="text-sm sm:text-[15px] text-[#787774] max-w-2xl leading-relaxed">
              跨國新聞媒體與公開資料庫整合搜尋平台。支援定位國家偵測、自動翻譯當地外語資訊為繁體中文，並即時將重點整理上架至個人 Blog 與 RSS 訂閱流。
            </p>
          </div>

          <form onSubmit={handleHeroSearch} className="flex flex-col sm:flex-row gap-2 max-w-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9B9A97] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={heroQuery}
                onChange={(e) => setHeroQuery(e.target.value)}
                placeholder="搜尋各國新聞媒體、官方公告、GitHub 釋出或關鍵字..."
                aria-label="跨國資訊快速搜尋"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] placeholder:text-[#9B9A97] focus:outline-none focus:border-[#37352F]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] active:scale-[0.99] transition-all whitespace-nowrap shrink-0"
            >
              {heroMatchCount !== null ? `搜尋 (${heroMatchCount} 筆)` : "搜尋索引"}
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[#787774] font-mono tabular-nums">
            <span>目前檢視：{selectedCountryLabel}</span>
            <span aria-hidden="true">·</span>
            <span>共 {entries.length} 篇真實索引</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#8F4B14]">
              頭條焦點 {entries.filter((e) => e.riskLevel === "high").length} 篇
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSearchParams({ setup: "1" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] transition-colors whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5 text-[#22643D]" />
              <span>
                {prefs?.detectedCountry
                  ? `定位／國家選擇 (${prefs.detectedCountry})`
                  : "定位與國家選擇精靈"}
              </span>
            </button>
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] transition-colors whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#5B3A7D]" />
              <span>個人 Blog 誌與轉換模板</span>
            </Link>
            <Link
              to="/automation"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] transition-colors whitespace-nowrap"
            >
              <Workflow className="w-3.5 h-3.5 text-[#2B4C7E]" />
              <span>n8n 自動化工作流 · 外部嵌入 / RSS</span>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5">
          <TrendSparkChart entries={entries} />
        </div>
      </section>

      {/* Interactive World Map View for Country/Region Stream Filtering */}
      <InteractiveWorldMap
        allEntries={allEntries}
        filteredEntries={entries}
        selectedCountry={selectedCountry}
        selectedRegion={selectedRegion}
        onSelectCountry={(country) => {
          setSelectedRegion("ALL");
          setSelectedCountry(country);
        }}
        onSelectRegion={(region) => {
          setSelectedCountry("ALL");
          setSelectedRegion(region);
        }}
      />

      {/* Country Selector + Live Media Crawl & Blog Publish Bar */}
      <section
        aria-label="國家媒體選擇與即時上架控制列"
        className="bg-white border border-[#E9E9E7] rounded-md p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#37352F] flex-wrap">
            <Globe className="w-4 h-4 text-[#787774]" />
            <span>國家媒體與資源選擇</span>
            <span className="text-[#787774] font-normal">
              （可切換單一國家或關注清單，並支援即時抓取翻譯上架 Blog）
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/settings#schedule"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] text-[#5A5852] hover:bg-[#EFEFEE] hover:text-[#37352F] whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5 text-[#787774]" />
              <span>
                {sources?.pipeline.autoEnabled
                  ? `自動排班啟用（${activeShiftsCount} 班表）`
                  : "自動排班已暫停"}
              </span>
            </Link>

            <button
              type="button"
              onClick={() => handlePublishBlogBatch(true)}
              disabled={crawlingAll}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <Rss className="w-3.5 h-3.5 text-[#5B3A7D]" />
              <span>發布全 9 國媒體上架 Blog</span>
            </button>

            <button
              type="button"
              onClick={() => handlePublishBlogBatch(false)}
              disabled={crawlingAll}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-60 active:scale-[0.99] transition-all whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${crawlingAll ? "animate-spin" : ""}`} />
              <span>
                {crawlingAll
                  ? "正在爬取翻譯並上架 Blog..."
                  : selectedCountry === "ALL"
                    ? "即時抓取各國媒體上架 Blog"
                    : selectedCountry === "MY_PREFS"
                      ? "抓取關注國家媒體上架 Blog"
                      : `抓取 ${COUNTRY_OPTIONS.find((c) => c.code === selectedCountry)?.name ?? selectedCountry} 媒體上架 Blog`}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#E9E9E7]">
          {myPrefsCountries.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setSelectedRegion("ALL");
                setSelectedCountry("MY_PREFS");
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-[4px] border transition-colors whitespace-nowrap ${
                selectedCountry === "MY_PREFS" && selectedRegion === "ALL"
                  ? "bg-[#37352F] text-white border-[#37352F] font-medium"
                  : "bg-[#FBFBFA] text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
              }`}
            >
              <MapPin className="w-3 h-3" />
              <span>我的關注國家 ({myPrefsCountries.length})</span>
              <span className="font-mono text-[11px] opacity-80 tabular-nums">
                {myPrefsCount}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setSelectedRegion("ALL");
              setSelectedCountry("ALL");
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-[4px] border transition-colors whitespace-nowrap ${
              selectedCountry === "ALL" && selectedRegion === "ALL"
                ? "bg-[#37352F] text-white border-[#37352F] font-medium"
                : "bg-[#FBFBFA] text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
            }`}
          >
            <span>全部國家</span>
            <span className="font-mono text-[11px] opacity-80 tabular-nums">
              {countryCounts.ALL}
            </span>
          </button>

          {COUNTRY_OPTIONS.map((country) => {
            const active = selectedCountry === country.code && selectedRegion === "ALL";
            const count = countryCounts[country.code] || 0;
            return (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  setSelectedRegion("ALL");
                  setSelectedCountry(country.code);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-[4px] border transition-colors whitespace-nowrap ${
                  active
                    ? "bg-[#37352F] text-white border-[#37352F] font-medium"
                    : "bg-[#FBFBFA] text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
                }`}
              >
                <span className="font-mono text-[10px] opacity-75">{country.code}</span>
                <span>{country.name}</span>
                <span className="font-mono text-[11px] opacity-80 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E9E9E7]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[#787774] mr-1">來源性質：</span>
            {(
              [
                { value: "all", label: "新聞媒體＋官方全部", count: allEntries.length },
                { value: "community", label: "各國新聞媒體與社群", count: sectorCounts.community },
                { value: "official", label: "官方機構公告", count: sectorCounts.official },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedSector(opt.value)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-[4px] border transition-colors whitespace-nowrap ${
                  selectedSector === opt.value
                    ? "bg-[#37352F] text-white border-[#37352F] font-medium"
                    : "bg-[#FBFBFA] text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
                }`}
              >
                <span>{opt.label}</span>
                <span className="font-mono text-[11px] opacity-80 tabular-nums">{opt.count}</span>
              </button>
            ))}
          </div>

          <span className="text-[11px] font-mono text-[#787774]">
            自動翻譯繁中：{prefs?.autoTranslate === false ? "手動" : "已啟用"}
          </span>
        </div>

        {crawlMessage && (
          <div className="p-2.5 bg-[#EDF5F0] border border-[#C7E0D0] rounded-[4px] text-xs text-[#22643D]">
            {crawlMessage}
          </div>
        )}
      </section>

      {/* International Editorial Headlines Callout Banner */}
      {activeHeadlines.length > 0 && (
        <section
          aria-label="各國即時頭條與焦點新聞速報"
          className="bg-[#FAF8F5] border border-[#E9E9E7] rounded-md p-5 space-y-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-[#8F4B14] shrink-0" />
              <h2 className="text-sm font-semibold text-[#37352F]">
                {selectedCountry === "ALL" ? "全球各國" : `${selectedCountryLabel}`}即時頭條與焦點新聞速報（{activeHeadlines.length} 篇精選）
              </h2>
            </div>
            <Link
              to={
                selectedCountry === "ALL" || selectedCountry === "MY_PREFS"
                  ? "/database?risk=high"
                  : `/database?risk=high&country=${selectedCountry}`
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-[#8F4B14] hover:underline whitespace-nowrap shrink-0"
            >
              <span>瀏覽全部頭條報導</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-[#E9E9E7] border-t border-[#E9E9E7]">
            {activeHeadlines.map((item) => (
              <Link
                key={item.id}
                to={`/post/${item.id}`}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 group hover:bg-[#F4F1EA] -mx-2 px-2 rounded-[4px] transition-colors duration-150"
              >
                <div className="flex items-start sm:items-center gap-2 min-w-0">
                  <SafeSourceIcon
                    src={item.sourceIcon}
                    url={item.url}
                    category={item.category}
                    alt={item.sourceName}
                  />
                  <CountryTag countryCode={item.countryCode} countryName={item.countryName} />
                  <CategoryTag category={item.category} />
                  <span className="text-sm font-medium text-[#37352F] group-hover:underline truncate">
                    {item.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#787774] font-mono tabular-nums shrink-0">
                  <span>{item.version}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatShortDate(item.publishedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Visual News Banner Cards (Images + Source Icons) */}
      {featuredVisualEntries.length > 0 && (
        <section aria-label="精選圖文新聞與媒體橫幅資產" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#37352F]">
              {selectedCountry === "ALL" ? "最新跨國圖文新聞橫幅" : `${selectedCountryLabel}圖文精選`}
            </h2>
            <Link
              to={
                selectedCountry === "ALL" || selectedCountry === "MY_PREFS"
                  ? "/database?view=gallery"
                  : `/database?view=gallery&country=${selectedCountry}`
              }
              className="text-xs font-medium text-[#787774] hover:text-[#37352F] transition-colors whitespace-nowrap"
            >
              切換畫廊檢視完整圖文庫 →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredVisualEntries.map((item) => (
              <Link
                key={item.id}
                to={`/post/${item.id}`}
                className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden flex flex-col hover:border-[#D3D1CB] transition-colors group"
              >
                <SafeBannerImage
                  src={item.bannerImage}
                  alt={item.title}
                  category={item.category}
                  wrapperClassName="aspect-[16/9] w-full bg-[#F4F2EE] border-b border-[#E9E9E7] overflow-hidden"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                />
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <SafeSourceIcon
                          src={item.sourceIcon}
                          url={item.url}
                          category={item.category}
                          alt={item.sourceName}
                          className="w-5 h-5"
                        />
                        <span className="text-xs font-medium text-[#5A5852] truncate">
                          {item.sourceName}
                        </span>
                      </div>
                      <RiskTag level={item.riskLevel} />
                    </div>
                    <h3 className="text-sm font-medium text-[#37352F] leading-snug group-hover:underline line-clamp-2">
                      {item.title}
                    </h3>
                  </div>

                  <div className="pt-2 border-t border-[#E9E9E7] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <CountryTag countryCode={item.countryCode} countryName={item.countryName} />
                      <SectorTag sector={getEntrySector(item)} />
                    </div>
                    <span className="text-[11px] font-mono text-[#9B9A97] tabular-nums">
                      {formatShortDate(item.publishedAt)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick Custom URL + Keyword Crawler */}
      <div id="custom-crawl">
        <CustomCrawlBar onCrawled={onRefresh} />
      </div>

      {/* System Status & Sync Metrics Strip */}
      <section aria-label="系統運作狀態與排班指標">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-[#E9E9E7] rounded-md p-4">
            <div className="text-xs text-[#787774]">全站真實索引總數</div>
            <div className="mt-1.5 text-2xl font-semibold text-[#37352F] font-mono tabular-nums">
              {allEntries.length}
            </div>
            <div className="mt-1 text-xs text-[#787774]">
              涵蓋 {COUNTRY_OPTIONS.length} 大國家與跨國媒體
            </div>
          </div>

          <div className="bg-white border border-[#E9E9E7] rounded-md p-4">
            <div className="text-xs text-[#787774]">頭條焦點報導</div>
            <div className="mt-1.5 text-2xl font-semibold text-[#8F4B14] font-mono tabular-nums">
              {allEntries.filter((e) => e.riskLevel === "high").length}
            </div>
            <div className="mt-1 text-xs text-[#787774]">跨國重大新聞與優先追蹤動態</div>
          </div>

          <div className="bg-white border border-[#E9E9E7] rounded-md p-4">
            <div className="text-xs text-[#787774]">啟用媒體與公開來源</div>
            <div className="mt-1.5 text-2xl font-semibold text-[#37352F] font-mono tabular-nums">
              {enabledSourcesCount}
              <span className="text-sm font-normal text-[#9B9A97]"> / {totalSourcesCount}</span>
            </div>
            <div className="mt-1 text-xs text-[#787774]">各國新聞媒體、官方流與自訂爬點</div>
          </div>

          <div className="bg-white border border-[#E9E9E7] rounded-md p-4">
            <div className="text-xs text-[#787774]">排班自動同步與 Blog 上架</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-[#22643D]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {sources?.pipeline.autoEnabled ? "排班自動運作中" : "已切換手動模式"}
              </span>
            </div>
            <div className="mt-1.5 text-xs text-[#787774] font-mono tabular-nums">
              下次排程：{sources?.pipeline.nextRunAt ? formatDateTime(sources.pipeline.nextRunAt) : "—"}
            </div>
          </div>
        </div>
      </section>

      {/* Latest Updates by Category */}
      <section aria-label="各分類最新動態速覽" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#37352F]">各分類最新動態速覽</h2>
          <Link
            to={
              selectedCountry === "ALL" || selectedCountry === "MY_PREFS"
                ? "/database"
                : `/database?country=${selectedCountry}`
            }
            className="text-xs font-medium text-[#787774] hover:text-[#37352F] transition-colors whitespace-nowrap"
          >
            前往完整資料庫檢視 →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CATEGORIES.map((category) => {
            const items = getEntriesByCategory(category);
            return (
              <div
                key={category}
                className="bg-white border border-[#E9E9E7] rounded-md flex flex-col"
              >
                <div className="px-4 py-3 border-b border-[#E9E9E7] flex items-center justify-between bg-[#F7F6F3]/60">
                  <CategoryTag category={category} />
                  <Link
                    to={
                      selectedCountry === "ALL" || selectedCountry === "MY_PREFS"
                        ? `/database?category=${encodeURIComponent(category)}`
                        : `/database?category=${encodeURIComponent(category)}&country=${selectedCountry}`
                    }
                    className="text-xs text-[#787774] hover:text-[#37352F] transition-colors whitespace-nowrap"
                  >
                    查看全部
                  </Link>
                </div>

                <div className="divide-y divide-[#E9E9E7] flex-1">
                  {items.length === 0 ? (
                    <div className="p-5 space-y-2.5 text-xs text-[#787774]">
                      <p>
                        目前所選國家條件下尚無此分類紀錄，可切換為「全部國家」或立即爬取新來源。
                      </p>
                      {category === "自訂爬文" && (
                        <button
                          type="button"
                          onClick={() =>
                            document
                              .getElementById("custom-crawl")
                              ?.scrollIntoView({ behavior: "smooth", block: "center" })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE]"
                        >
                          <span>前往自訂網址即時爬文</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    items.map((item) => (
                      <Link
                        key={item.id}
                        to={`/post/${item.id}`}
                        className="block p-4 hover:bg-[#F7F6F3] transition-colors duration-150 group space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <SafeSourceIcon
                              src={item.sourceIcon}
                              url={item.url}
                              category={item.category}
                              alt={item.sourceName}
                              className="w-[18px] h-[18px]"
                            />
                            <span className="text-xs font-medium text-[#5A5852] truncate">
                              {item.sourceName}
                            </span>
                            <span className="text-[11px] font-mono text-[#9B9A97] shrink-0">
                              · {item.countryName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <SectorTag sector={getEntrySector(item)} />
                            <RiskTag level={item.riskLevel} />
                          </div>
                        </div>

                        <div className="flex gap-3 items-start">
                          <SafeBannerImage
                            src={item.bannerImage}
                            alt={item.title}
                            category={item.category}
                            wrapperClassName="w-16 h-11 rounded-[4px] border border-[#E9E9E7] overflow-hidden shrink-0 bg-[#F4F2EE]"
                            className="w-full h-full object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-medium text-[#37352F] leading-snug group-hover:underline line-clamp-2">
                              {item.title}
                            </h3>
                          </div>
                        </div>

                        <p className="text-xs text-[#787774] line-clamp-2 leading-relaxed">
                          {item.aiSummary}
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-[#9B9A97] font-mono tabular-nums">
                          <span>{formatShortDate(item.publishedAt)}</span>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              {item.heatScore}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {item.commentCount}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Subscribe to High-Risk Alerts & Country RSS Feeds */}
      <SubscribeModule />

      {/* Schedule & Data Pipeline Summary */}
      <section className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-md p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#37352F]">自動化排班與多國公開資料庫流向</h2>
            <p className="mt-0.5 text-xs text-[#787774]">
              依早午晚三班排程自動巡檢 9 大國家公開資料流、擷取新聞橫幅與圖示資產，並同步推播至 RSS 與訂閱清單。
            </p>
          </div>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-[#37352F] border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE] active:scale-[0.99] transition-all duration-150 whitespace-nowrap shrink-0"
          >
            <span>管理排班與資料流</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(sources?.pipeline.shifts ?? []).map((shift) => (
            <div
              key={shift.id}
              className="bg-white border border-[#E9E9E7] rounded-[4px] p-3.5 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#37352F]">{shift.name}</span>
                <span
                  className={`px-1.5 py-0.5 text-[11px] rounded-[3px] border whitespace-nowrap ${
                    shift.enabled
                      ? "bg-[#EDF5F0] text-[#22643D] border-[#C7E0D0]"
                      : "bg-[#F4F2EE] text-[#787774] border-[#E9E9E7]"
                  }`}
                >
                  {shift.enabled ? "排班中" : "停用"}
                </span>
              </div>
              <div className="text-xs font-mono text-[#787774]">{shift.timeLabel}</div>
              <div className="text-[11px] text-[#5A5852]">
                涵蓋國家：{shift.countries.join(" / ")}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
