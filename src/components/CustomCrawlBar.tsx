import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Globe, ArrowRight, Loader2 } from "lucide-react";
import {
  COUNTRY_OPTIONS,
  type CableCategory,
  type CableEntry,
  type CountryCode,
} from "../types/cables";

interface CustomCrawlBarProps {
  onCrawled: () => Promise<void>;
}

const PRESETS: Array<{
  label: string;
  url: string;
  category: CableCategory;
  countryCode: CountryCode;
}> = [
  {
    label: "BBC 國際新聞 RSS",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    category: "國際焦點",
    countryCode: "GB",
  },
  {
    label: "中央社台灣焦點 RSS",
    url: "https://feeds.feedburner.com/cnaFirstNews",
    category: "國際焦點",
    countryCode: "TW",
  },
  {
    label: "Cloudflare 技術與資安",
    url: "https://blog.cloudflare.com/rss/",
    category: "API 變動",
    countryCode: "GLOBAL",
  },
];

export function CustomCrawlBar({ onCrawled }: CustomCrawlBarProps) {
  const [url, setUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>("TW");
  const [category, setCategory] = useState<CableCategory>("自訂爬文");
  const [saveAsSource, setSaveAsSource] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultEntry, setResultEntry] = useState<CableEntry | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const selectedCountry = COUNTRY_OPTIONS.find((c) => c.code === countryCode);
    setLoading(true);
    setError(null);
    setResultEntry(null);
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          keywords: keywords.trim(),
          categoryHint: category,
          countryHint: countryCode,
          regionHint: selectedCountry?.region || "全球",
          saveAsSource,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        entry?: CableEntry;
        error?: string;
      };
      if (!res.ok || !body.entry) {
        throw new Error(body.error || "爬取與摘要失敗");
      }
      setResultEntry(body.entry);
      setUrl("");
      setKeywords("");
      await onCrawled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法完成網址爬取");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-label="自訂位置即時爬文"
      className="bg-white border border-[#E9E9E7] rounded-md p-5 space-y-3.5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#37352F] shrink-0" />
          <h2 className="text-sm font-semibold text-[#37352F]">
            私人資料庫即時爬文（支援自訂公開網頁、各國新聞 RSS、政府資安公告 JSON 與 GitHub）
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-[#787774]">快速範例：</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setUrl(p.url);
                setCategory(p.category);
                setCountryCode(p.countryCode);
              }}
              className="px-2 py-0.5 text-[11px] bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] text-[#5A5852] hover:bg-[#EFEFEE] hover:text-[#37352F] transition-colors whitespace-nowrap"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="輸入任何公開新聞網站、政府公告 RSS 或技術資料庫網址（https://...）"
            aria-label="目標網址"
            className="md:col-span-5 px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] placeholder:text-[#9B9A97] focus:outline-none focus:border-[#37352F]"
          />
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="篩選關鍵字（選填，如 AI, TSMC, CVE）"
            aria-label="篩選關鍵字"
            className="md:col-span-3 px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] placeholder:text-[#9B9A97] focus:outline-none focus:border-[#37352F]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CableCategory)}
            aria-label="分類"
            className="md:col-span-2 px-2.5 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] focus:outline-none focus:border-[#37352F]"
          >
            <option value="自訂爬文">自訂爬文</option>
            <option value="國際焦點">國際焦點</option>
            <option value="財經科技">財經科技</option>
            <option value="資安公告">資安公告</option>
            <option value="API 變動">API 變動</option>
            <option value="GitHub 釋出">GitHub 釋出</option>
            <option value="Reddit 熱議">Reddit 熱議</option>
          </select>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value as CountryCode)}
            aria-label="國家代碼"
            className="md:col-span-2 px-2.5 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] focus:outline-none focus:border-[#37352F]"
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-[#5A5852] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveAsSource}
              onChange={(e) => setSaveAsSource(e.target.checked)}
              className="rounded-[3px] border-[#D3D1CB] text-[#37352F] focus:ring-0"
            />
            <span>同時將此網址加入 sources.json 排班監控資料流</span>
          </label>

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-50 active:scale-[0.99] transition-all duration-150 whitespace-nowrap shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>正在抓取來源圖片與內文...</span>
              </>
            ) : (
              <span>立即爬文與抓取橫幅</span>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="p-3 bg-[#FDF6F6] border border-[#F5C2C2] rounded-[4px] text-xs text-[#9B2C2C]">
          {error}
        </div>
      )}

      {resultEntry && (
        <div className="p-3 bg-[#EDF5F0] border border-[#C7E0D0] rounded-[4px] flex flex-wrap items-center justify-between gap-2 text-xs text-[#22643D]">
          <span>
            已成功爬取 [{resultEntry.countryName} · {resultEntry.category}]：{resultEntry.title}
          </span>
          <Link
            to={`/post/${resultEntry.id}`}
            className="inline-flex items-center gap-1 font-semibold underline whitespace-nowrap"
          >
            <span>閱讀完整摘要</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}
