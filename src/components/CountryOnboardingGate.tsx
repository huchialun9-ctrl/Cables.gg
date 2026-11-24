import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Compass,
  Globe,
  Languages,
  Loader2,
  MapPin,
  Newspaper,
} from "lucide-react";
import {
  COUNTRY_OPTIONS,
  type CountryCode,
  type DatabasePayload,
  type SourceSector,
  type SourcesPayload,
} from "../types/cables";

export interface WorkspacePrefs {
  confirmed: boolean;
  countries: CountryCode[]; // empty means ALL
  sector: "all" | SourceSector;
  autoTranslate: boolean;
  detectedCountry?: CountryCode;
  detectedLabel?: string;
}

interface CountryOnboardingGateProps {
  db: DatabasePayload | null;
  sources: SourcesPayload | null;
  initialPrefs?: WorkspacePrefs | null;
  onComplete: (prefs: WorkspacePrefs, crawlNotice?: string | null) => Promise<void>;
  onCancel?: () => void;
}

export function CountryOnboardingGate({
  db,
  sources,
  initialPrefs,
  onComplete,
  onCancel,
}: CountryOnboardingGateProps) {
  const [selectedCountries, setSelectedCountries] = useState<CountryCode[]>(
    initialPrefs?.countries && initialPrefs.countries.length > 0
      ? initialPrefs.countries
      : ["TW", "GLOBAL"]
  );
  const [sector, setSector] = useState<"all" | SourceSector>(initialPrefs?.sector || "all");
  const [autoTranslate, setAutoTranslate] = useState<boolean>(
    initialPrefs?.autoTranslate ?? true
  );
  const [fetchFreshOnEnter, setFetchFreshOnEnter] = useState<boolean>(true);

  const [locating, setLocating] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<CountryCode | undefined>(
    initialPrefs?.detectedCountry
  );
  const [locationBanner, setLocationBanner] = useState<string | null>(
    initialPrefs?.detectedLabel || null
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Silent timezone baseline detection on first mount
  useEffect(() => {
    if (detectedCountry) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const lang = navigator.language || "";
    fetch("/api/locate-country", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz, language: lang }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            countryCode?: CountryCode;
            detectedCountryName?: string;
            city?: string;
          } | null
        ) => {
          if (!data?.countryCode) return;
          setDetectedCountry(data.countryCode);
          setLocationBanner(
            `依您的系統時區偵測所在地為「${data.detectedCountryName} (${data.countryCode})」${
              data.city ? ` · ${data.city}` : ""
            }，可點擊上方按鈕進行精確 GPS 定位。`
          );
          if (!initialPrefs?.confirmed) {
            setSelectedCountries(
              data.countryCode === "GLOBAL" ? ["TW", "US", "GLOBAL"] : [data.countryCode, "GLOBAL"]
            );
          }
        }
      )
      .catch(() => {
        // Non-blocking baseline timezone hint
      });
  }, [detectedCountry, initialPrefs?.confirmed]);

  const sourcesByCountry = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const c of COUNTRY_OPTIONS) map[c.code] = [];
    for (const src of sources?.sources ?? []) {
      if (!src.enabled) continue;
      if (!map[src.countryCode]) map[src.countryCode] = [];
      map[src.countryCode].push(src.name);
    }
    return map;
  }, [sources?.sources]);

  const entryCountByCountry = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of db?.entries ?? []) {
      map[e.countryCode] = (map[e.countryCode] || 0) + 1;
    }
    return map;
  }, [db?.entries]);

  const handleAutoLocate = () => {
    setLocating(true);
    setErrorMsg(null);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const lang = navigator.language || "";

    const sendLocate = async (lat?: number, lon?: number) => {
      try {
        const res = await fetch("/api/locate-country", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon, timezone: tz, language: lang }),
        });
        const data = (await res.json()) as {
          countryCode: CountryCode;
          detectedCountryName: string;
          city: string;
          method: "geolocation" | "timezone" | "language";
          availableSources?: Array<{ name: string }>;
        };
        setDetectedCountry(data.countryCode);
        setSelectedCountries((prev) => {
          const next = new Set<CountryCode>(prev);
          next.add(data.countryCode);
          return Array.from(next);
        });
        const methodText = data.method === "geolocation" ? "GPS 定位成功" : "時區定位完成";
        setLocationBanner(
          `${methodText}：${data.detectedCountryName} (${data.countryCode})${
            data.city ? ` · ${data.city}` : ""
          } — 已自動勾選當地 ${data.availableSources?.length ?? 0} 個新聞媒體與官方資料流。`
        );
      } catch {
        setErrorMsg("目前無法完成自動定位，請直接從下方點選想關注的國家與媒體。");
      } finally {
        setLocating(false);
      }
    };

    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void sendLocate(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          void sendLocate();
        },
        { timeout: 6000, maximumAge: 60000 }
      );
    } else {
      void sendLocate();
    }
  };

  const toggleCountry = (code: CountryCode) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleEnterWorkspace = async (runLiveCrawl: boolean) => {
    setSubmitting(true);
    setErrorMsg(null);

    const effectiveCountries: CountryCode[] =
      selectedCountries.length === COUNTRY_OPTIONS.length ? [] : selectedCountries;

    const prefs: WorkspacePrefs = {
      confirmed: true,
      countries: effectiveCountries,
      sector,
      autoTranslate,
      detectedCountry,
      detectedLabel: locationBanner || undefined,
    };

    let notice: string | null = null;

    try {
      if (runLiveCrawl) {
        const res = await fetch("/api/publish-blog-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            countries: effectiveCountries.length > 0 ? effectiveCountries : "ALL",
            sectorFilter: sector,
            limitPerSource: 2,
            autoTranslate,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          log?: { message: string };
          translationWarning?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error || "即時抓取所選國家媒體失敗");
        }
        notice = [body.log?.message, body.translationWarning].filter(Boolean).join(" ");
      }

      await onComplete(prefs, notice);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "無法完成所選國家新聞整合");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[960px] mx-auto py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#E9E9E7] rounded-md p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-[#787774]">
              <Compass className="w-3.5 h-3.5" />
              <span>個人化跨國新聞媒體與公開資訊設定精靈</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#37352F]">Cables.gg</h1>
            <p className="text-sm text-[#5A5852] leading-relaxed">
              使用平台前，請先透過自動定位偵測所在國家，或互動勾選您想追蹤的全球各國新聞媒體與公開資料庫。系統將自動翻譯當地外語資訊為繁體中文，並即時整理上架至個人 Blog 閱讀牆。
            </p>
          </div>

          <button
            type="button"
            onClick={handleAutoLocate}
            disabled={locating || submitting}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-60 active:scale-[0.99] transition-all whitespace-nowrap shrink-0"
          >
            {locating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MapPin className="w-4 h-4" />
            )}
            <span>{locating ? "定位偵測中..." : "自動定位目前國家"}</span>
          </button>
        </div>

        {locationBanner && (
          <div className="p-3 bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] flex items-center gap-2 text-xs text-[#37352F]">
            <MapPin className="w-3.5 h-3.5 text-[#22643D] shrink-0" />
            <span>{locationBanner}</span>
          </div>
        )}

        {/* Step 1: Country Interactive Selector */}
        <div className="space-y-3 pt-2 border-t border-[#E9E9E7]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#37352F]">
              <Globe className="w-4 h-4 text-[#787774]" />
              <span>1. 選擇要整合與收集的國家新聞與公開資源（可複選）</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCountries(COUNTRY_OPTIONS.map((c) => c.code))}
                className="px-2.5 py-1 bg-white border border-[#E9E9E7] rounded-[4px] text-[#5A5852] hover:bg-[#EFEFEE]"
              >
                全選 9 國/地區
              </button>
              {detectedCountry && (
                <button
                  type="button"
                  onClick={() => setSelectedCountries([detectedCountry])}
                  className="px-2.5 py-1 bg-white border border-[#E9E9E7] rounded-[4px] text-[#5A5852] hover:bg-[#EFEFEE]"
                >
                  僅選定位國家 ({detectedCountry})
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedCountries([])}
                className="px-2.5 py-1 bg-white border border-[#E9E9E7] rounded-[4px] text-[#787774] hover:bg-[#EFEFEE]"
              >
                清除重選
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COUNTRY_OPTIONS.map((country) => {
              const selected = selectedCountries.includes(country.code);
              const isDetected = detectedCountry === country.code;
              const srcNames = sourcesByCountry[country.code] || [];
              const count = entryCountByCountry[country.code] || 0;

              return (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => toggleCountry(country.code)}
                  className={`text-left p-3.5 rounded-[4px] border transition-colors flex flex-col justify-between gap-2 ${
                    selected
                      ? "bg-[#F7F6F3] border-[#37352F]"
                      : "bg-white border-[#E9E9E7] hover:bg-[#FBFBFA]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-[#787774]">{country.code}</span>
                        <span className="text-sm font-semibold text-[#37352F]">{country.name}</span>
                        {isDetected && (
                          <span className="text-[11px] text-[#22643D] font-medium">· 目前位置</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#787774] font-mono tabular-nums">
                        {srcNames.length} 個真實來源 · 已收錄 {count} 篇
                      </div>
                    </div>
                    <span
                      className={`w-5 h-5 rounded-[4px] border flex items-center justify-center shrink-0 ${
                        selected
                          ? "bg-[#37352F] border-[#37352F] text-white"
                          : "bg-white border-[#D3D1CB] text-transparent"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <div className="text-[11px] text-[#5A5852] line-clamp-2 leading-relaxed">
                    {srcNames.length > 0
                      ? srcNames.slice(0, 4).join(" · ")
                      : "支援自訂網址與公開 RSS 接入"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Media Sector & Auto Translation Preferences */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[#E9E9E7]">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#37352F]">
              <Newspaper className="w-4 h-4 text-[#787774]" />
              <span>2. 資訊來源類型篩選</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { value: "all", label: "新聞媒體＋官方機構全部" },
                  { value: "community", label: "各國新聞媒體與社群" },
                  { value: "official", label: "各國官方機構公告" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSector(opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-[4px] border transition-colors whitespace-nowrap ${
                    sector === opt.value
                      ? "bg-[#37352F] text-white border-[#37352F] font-medium"
                      : "bg-white text-[#5A5852] border-[#E9E9E7] hover:bg-[#EFEFEE]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#37352F]">
              <Languages className="w-4 h-4 text-[#787774]" />
              <span>3. 跨國自動翻譯與 Blog 上架</span>
            </div>
            <div className="space-y-2 text-xs text-[#37352F]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoTranslate}
                  onChange={(e) => setAutoTranslate(e.target.checked)}
                  className="rounded-[3px] border-[#D3D1CB]"
                />
                <span>依所選國家語言，自動翻譯外語新聞為繁體中文並整理重點標記</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fetchFreshOnEnter}
                  onChange={(e) => setFetchFreshOnEnter(e.target.checked)}
                  className="rounded-[3px] border-[#D3D1CB]"
                />
                <span>進入前即時爬取最新各國媒體並同步整理上架個人 Blog</span>
              </label>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-[#FDF6F6] border border-[#F5C2C2] rounded-[4px] text-xs text-[#9B2C2C]">
            {errorMsg}
          </div>
        )}

        {/* Primary Action Footer */}
        <div className="pt-4 border-t border-[#E9E9E7] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#787774]">
            已選擇{" "}
            <span className="font-mono font-semibold text-[#37352F] tabular-nums">
              {selectedCountries.length === 0 || selectedCountries.length === COUNTRY_OPTIONS.length
                ? "全球全部國家"
                : selectedCountries.join(" / ")}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="px-3.5 py-2 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#5A5852] hover:bg-[#EFEFEE]"
              >
                返回目前頁面
              </button>
            )}

            <button
              type="button"
              onClick={() => handleEnterWorkspace(false)}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] disabled:opacity-50"
            >
              直接檢視已收錄資訊
            </button>

            <button
              type="button"
              onClick={() => handleEnterWorkspace(fetchFreshOnEnter)}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-60 active:scale-[0.99] transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>正在爬取、翻譯並整理上架 Blog...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {fetchFreshOnEnter
                      ? "立即抓取整合所選國家資訊並進入"
                      : "套用國家設定並進入 Cables.gg"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
