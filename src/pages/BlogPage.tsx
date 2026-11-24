import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  Highlighter,
  Loader2,
  Rss,
  Save,
  Users,
} from "lucide-react";
import {
  COUNTRY_OPTIONS,
  type BlogLayoutTemplate,
  type BlogProfileConfig,
  type CableCategory,
  type CableEntry,
  type CountryCode,
  type DatabasePayload,
  type SourceSector,
} from "../types/cables";
import { CategoryTag, CountryTag, RiskTag, SectorTag, formatShortDate } from "../components/NotionTags";
import { SafeBannerImage, SafeSourceIcon } from "../components/SafeImage";
import { getCondensedDigest, getEntrySector } from "../utils/blogTemplates";

interface BlogPageProps {
  db: DatabasePayload | null;
  blogProfile: BlogProfileConfig | null;
  loading: boolean;
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

export function BlogPage({ db, blogProfile, loading, onRefreshAll }: BlogPageProps) {
  const { id } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [template, setTemplate] = useState<BlogLayoutTemplate>(() => {
    const t = searchParams.get("template");
    return t === "editorial" || t === "cards" ? t : blogProfile?.template || "minimal";
  });
  const [country, setCountry] = useState<"ALL" | CountryCode>(() => {
    const c = (searchParams.get("country") || "").toUpperCase();
    return COUNTRY_OPTIONS.some((o) => o.code === c) ? (c as CountryCode) : "ALL";
  });
  const [sector, setSector] = useState<"all" | SourceSector>(() => {
    const s = searchParams.get("sector");
    return s === "official" || s === "community" ? s : "all";
  });
  const [category, setCategory] = useState<"all" | CableCategory>("all");

  // Custom Blog Settings State
  const [slugInput, setSlugInput] = useState(blogProfile?.slug || "my-cables");
  const [blogTitleInput, setBlogTitleInput] = useState(blogProfile?.blogTitle || "");
  const [taglineInput, setTaglineInput] = useState(blogProfile?.tagline || "");
  const [ownerNameInput, setOwnerNameInput] = useState(blogProfile?.ownerName || "");
  const [ownerBioInput, setOwnerBioInput] = useState(blogProfile?.ownerBio || "");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSavedMsg, setConfigSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!blogProfile) return;
    setSlugInput(blogProfile.slug);
    setBlogTitleInput(blogProfile.blogTitle);
    setTaglineInput(blogProfile.tagline);
    setOwnerNameInput(blogProfile.ownerName);
    setOwnerBioInput(blogProfile.ownerBio);
    if (!searchParams.get("template")) {
      setTemplate(blogProfile.template || "minimal");
    }
  }, [blogProfile, searchParams]);

  const handleSaveBlogConfig = async (e: FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSavedMsg(null);
    try {
      const res = await fetch("/api/blog-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slugInput,
          blogTitle: blogTitleInput,
          tagline: taglineInput,
          ownerName: ownerNameInput,
          ownerBio: ownerBioInput,
          template,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as BlogProfileConfig & { error?: string };
      if (!res.ok) throw new Error(body.error || "儲存 Blog 設定失敗");
      await onRefreshAll();
      setConfigSavedMsg(`已儲存！您的獨立 Blog 路由已就緒：/b/${body.slug}`);
    } catch (err) {
      setConfigSavedMsg(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSavingConfig(false);
    }
  };

  const activeSlug = blogProfile?.slug || "my-cables";

  const [copiedRss, setCopiedRss] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://cables.gg";
  const allEntries = db?.entries ?? [];

  const filtered = useMemo(() => {
    return allEntries.filter((entry) => {
      if (country !== "ALL" && entry.countryCode !== country) return false;
      if (category !== "all" && entry.category !== category) return false;
      if (sector !== "all" && getEntrySector(entry) !== sector) return false;
      return true;
    });
  }, [allEntries, country, category, sector]);

  const feedQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (country !== "ALL") params.set("country", country);
    if (sector !== "all") params.set("sector", sector);
    if (category !== "all") params.set("category", category);
    return params.toString();
  }, [country, sector, category]);

  const blogRssUrl = `${origin}/rss/blog.xml${feedQuery ? `?${feedQuery}` : ""}`;
  const jsonFeedUrl = `${origin}/feed.json${feedQuery ? `?${feedQuery}` : ""}`;

  const copyText = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  if (loading && !db) {
    return (
      <div className="max-w-[920px] space-y-6">
        <div className="h-12 w-2/3 bg-[#F4F2EE] rounded" />
        <div className="h-64 bg-white border border-[#E9E9E7] rounded-md" />
      </div>
    );
  }

  // Single Blog Article Reader Mode (/blog/:id)
  if (id) {
    const single = allEntries.find((e) => e.id === id);
    if (!single) {
      return (
        <div className="max-w-[780px] bg-white border border-[#E9E9E7] rounded-md p-8 space-y-4">
          <p className="text-sm font-medium text-[#9B2C2C]">找不到指定的個人 Blog 精華文章。</p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回 Blog 總覽</span>
          </Link>
        </div>
      );
    }

    const digest = getCondensedDigest(single);
    const entrySector = getEntrySector(single);

    const handleDownloadSingleMd = () => {
      const blob = new Blob([digest.markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${single.id}.md`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <article className="max-w-[760px] mx-auto space-y-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/b/${activeSlug}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#787774] hover:text-[#37352F]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回專屬 Blog (/b/{activeSlug})</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => copyText(digest.markdown, setCopiedMd)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE]"
            >
              {copiedMd ? <Check className="w-3.5 h-3.5 text-[#22643D]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedMd ? "已複製 Markdown" : "複製 Blog Markdown"}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSingleMd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下載 .md</span>
            </button>
            <Link
              to={`/post/${single.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28]"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span>開啟閱讀器與畫重點</span>
            </Link>
          </div>
        </div>

        <SafeBannerImage
          src={single.bannerImage}
          alt={digest.headline}
          category={single.category}
          wrapperClassName="w-full h-56 sm:h-72 bg-[#F4F2EE] border border-[#E9E9E7] rounded-md overflow-hidden"
          className="w-full h-full object-cover"
        />

        <header className="space-y-4 border-b border-[#E9E9E7] pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <SectorTag sector={entrySector} />
            <CountryTag countryCode={single.countryCode} countryName={single.countryName} />
            <CategoryTag category={single.category} />
            <RiskTag level={single.riskLevel} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#37352F] leading-snug text-balance">
            {digest.headline}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#787774]">
            <span className="inline-flex items-center gap-1.5 text-[#37352F] font-medium">
              <SafeSourceIcon
                src={single.sourceIcon}
                url={single.url}
                category={single.category}
                alt={single.sourceName}
              />
              <span>{single.sourceName}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{formatShortDate(single.publishedAt)}</span>
            <span aria-hidden="true">·</span>
            <span>精簡重點模式</span>
          </div>
        </header>

        <section className="space-y-6 text-[#37352F]">
          <p className="text-base leading-relaxed text-[#37352F]">{digest.lead}</p>

          <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-md p-5 space-y-3">
            <h2 className="text-xs font-semibold text-[#787774]">後端標記重點（僅關鍵條目）</h2>
            <ol className="space-y-2.5 text-[15px] leading-relaxed">
              {digest.keyPoints.map((pt, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="font-mono text-xs text-[#9B9A97] mt-1 tabular-nums">
                    {String(i + 1).padStart(2, "0")}.
                  </span>
                  <span>{pt}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="border border-[#E9E9E7] bg-white rounded-md p-5 space-y-2">
            <h2 className="text-xs font-semibold text-[#787774]">觀點結論與受影響範圍</h2>
            <p className="text-sm text-[#5A5852] leading-relaxed">{single.impactScope}</p>
            <p className="text-sm font-medium text-[#37352F] pt-1">{digest.takeAway}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E9E9E7] text-xs">
            <div className="flex flex-wrap gap-1.5">
              {digest.markers.map((m, idx) => (
                <span
                  key={`${m}-${idx}`}
                  className="px-2 py-0.5 font-mono bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] text-[#5A5852]"
                >
                  #{m}
                </span>
              ))}
            </div>
            <a
              href={single.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#37352F] hover:underline"
            >
              <span>查閱原始來源出處</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>
      </article>
    );
  }

  const renderBlogPostCard = (entry: CableEntry, featured = false) => {
    const digest = getCondensedDigest(entry);
    const entrySector = getEntrySector(entry);

    return (
      <article
        key={entry.id}
        className={`bg-white border border-[#E9E9E7] rounded-md overflow-hidden flex flex-col justify-between hover:border-[#D3D1CB] transition-colors ${
          featured ? "md:col-span-2" : ""
        }`}
      >
        <div>
          <SafeBannerImage
            src={entry.bannerImage}
            alt={digest.headline}
            category={entry.category}
            wrapperClassName={`w-full ${featured ? "h-52" : "h-36"} bg-[#F4F2EE] border-b border-[#E9E9E7] overflow-hidden`}
            className="w-full h-full object-cover"
          />

          <div className="p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <SectorTag sector={entrySector} />
              <CountryTag countryCode={entry.countryCode} countryName={entry.countryName} />
              <CategoryTag category={entry.category} />
              <RiskTag level={entry.riskLevel} />
            </div>

            <Link to={`/blog/${entry.id}`} className="block group">
              <h2
                className={`${
                  featured ? "text-xl" : "text-base"
                } font-bold text-[#37352F] leading-snug group-hover:underline`}
              >
                {digest.headline}
              </h2>
            </Link>

            <p className="text-sm text-[#5A5852] leading-relaxed line-clamp-3">{digest.lead}</p>

            <ul className="space-y-1 pt-2 border-t border-[#E9E9E7] text-xs text-[#37352F]">
              {digest.keyPoints.slice(0, 2).map((pt, i) => (
                <li key={i} className="flex items-start gap-1.5 leading-snug">
                  <span className="font-mono text-[#9B9A97] shrink-0">•</span>
                  <span className="line-clamp-2">{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="px-5 py-3 bg-[#FBFBFA] border-t border-[#E9E9E7] flex flex-wrap items-center justify-between gap-2 text-xs text-[#787774]">
          <span className="inline-flex items-center gap-1.5 truncate">
            <SafeSourceIcon
              src={entry.sourceIcon}
              url={entry.url}
              category={entry.category}
              alt={entry.sourceName}
              className="w-3.5 h-3.5"
            />
            <span className="truncate">{entry.sourceName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{formatShortDate(entry.publishedAt)}</span>
          </span>

          <Link
            to={`/blog/${entry.id}`}
            className="font-medium text-[#37352F] hover:underline whitespace-nowrap"
          >
            閱讀重點文章 →
          </Link>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-7">
      {/* Personal Blog Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#E9E9E7] pb-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#787774]">
            <BookOpen className="w-3.5 h-3.5" />
            <span>功能二 · 個人專屬 Blog 設定與訂閱管理</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#37352F]">
            個人 Blog 設定台與全庫精選預覽
          </h1>
          <p className="text-sm text-[#787774] max-w-2xl">
            自訂您的專屬 Blog 頁面路由（/b/{activeSlug}）、名稱與主編簡介，亦可瀏覽並參考其他真實創作者的個人檔案導入您的 Blog。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to={`/b/${activeSlug}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>開啟我的專屬 Blog (/b/{activeSlug})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            to="/profiles"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
          >
            <Users className="w-3.5 h-3.5" />
            <span>瀏覽他人個人檔案 ({blogProfile?.referencedProfiles.length ?? 0} 已參考)</span>
          </Link>

          <button
            type="button"
            onClick={() => copyText(blogRssUrl, setCopiedRss)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
          >
            {copiedRss ? <Check className="w-3.5 h-3.5 text-[#22643D]" /> : <Rss className="w-3.5 h-3.5" />}
            <span>{copiedRss ? "已複製 Blog RSS" : "複製 RSS"}</span>
          </button>

          <button
            type="button"
            onClick={() => copyText(jsonFeedUrl, setCopiedJson)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
          >
            {copiedJson ? <Check className="w-3.5 h-3.5 text-[#22643D]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedJson ? "已複製 JSON Feed" : "JSON Feed"}</span>
          </button>
        </div>
      </div>

      {/* Custom Blog Route & Identity Configurator */}
      <form
        onSubmit={handleSaveBlogConfig}
        className="bg-white border border-[#E9E9E7] rounded-md p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#37352F]">
            設定您的獨立 Blog 頁面路由與個人資料
          </h2>
          <span className="font-mono text-xs text-[#787774]">
            目前頁面路由：<strong className="text-[#37352F]">/b/{activeSlug}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="cfg-slug" className="block text-xs text-[#787774] mb-1">
              自訂專屬路由代稱 (/b/...)
            </label>
            <input
              id="cfg-slug"
              type="text"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              placeholder="my-cables"
              className="w-full px-3 py-1.5 text-xs font-mono bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
            />
          </div>

          <div>
            <label htmlFor="cfg-title" className="block text-xs text-[#787774] mb-1">
              Blog 站台名稱
            </label>
            <input
              id="cfg-title"
              type="text"
              value={blogTitleInput}
              onChange={(e) => setBlogTitleInput(e.target.value)}
              placeholder="我的跨國情報與技術觀測 Blog"
              className="w-full px-3 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
            />
          </div>

          <div>
            <label htmlFor="cfg-owner" className="block text-xs text-[#787774] mb-1">
              主編顯示名稱
            </label>
            <input
              id="cfg-owner"
              type="text"
              value={ownerNameInput}
              onChange={(e) => setOwnerNameInput(e.target.value)}
              placeholder="您的名稱"
              className="w-full px-3 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
            />
          </div>

          <div>
            <label htmlFor="cfg-tagline" className="block text-xs text-[#787774] mb-1">
              副標題說明
            </label>
            <input
              id="cfg-tagline"
              type="text"
              value={taglineInput}
              onChange={(e) => setTaglineInput(e.target.value)}
              placeholder="一句話介紹您的 Blog 定位"
              className="w-full px-3 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex-1">
            <label htmlFor="cfg-bio" className="block text-xs text-[#787774] mb-1">
              主編簡介（顯示於 /b/{activeSlug} 頁首）
            </label>
            <input
              id="cfg-bio"
              type="text"
              value={ownerBioInput}
              onChange={(e) => setOwnerBioInput(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] focus:outline-none focus:border-[#37352F]"
            />
          </div>

          <button
            type="submit"
            disabled={savingConfig}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>儲存並更新 Blog 設定</span>
          </button>
        </div>

        {configSavedMsg && (
          <div className="p-2.5 bg-[#EDF5F0] border border-[#C7E0D0] rounded-[4px] flex flex-wrap items-center justify-between gap-2 text-xs text-[#22643D]">
            <span>{configSavedMsg}</span>
            <Link
              to={`/b/${activeSlug}`}
              className="font-semibold underline whitespace-nowrap"
            >
              前往 /b/{activeSlug} →
            </Link>
          </div>
        )}
      </form>

      {/* Blog Template Switcher + Country / Sector / Category Filters */}
      <div className="bg-white border border-[#E9E9E7] rounded-md p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center border border-[#E9E9E7] rounded-[4px] bg-[#F7F6F3] p-0.5">
            {[
              { id: "minimal", label: "極簡週報版" },
              { id: "editorial", label: "編輯雙欄版" },
              { id: "cards", label: "知識卡片牆" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  const next = item.id as BlogLayoutTemplate;
                  setTemplate(next);
                  const p = new URLSearchParams(searchParams);
                  p.set("template", next);
                  setSearchParams(p, { replace: true });
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-[3px] whitespace-nowrap ${
                  template === item.id
                    ? "bg-white text-[#37352F] shadow-2xs"
                    : "text-[#5A5852] hover:text-[#37352F]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center border border-[#E9E9E7] rounded-[4px] bg-[#F7F6F3] p-0.5">
            {[
              { id: "all", label: "官民全收錄" },
              { id: "official", label: "僅官方機構" },
              { id: "community", label: "僅民間社群" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSector(item.id as "all" | SourceSector)}
                className={`px-2.5 py-1 text-xs font-medium rounded-[3px] whitespace-nowrap ${
                  sector === item.id
                    ? "bg-white text-[#37352F] shadow-2xs"
                    : "text-[#5A5852] hover:text-[#37352F]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value as "ALL" | CountryCode)}
            aria-label="依國家篩選 Blog"
            className="px-2.5 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F]"
          >
            <option value="ALL">全部國家地區</option>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "all" | CableCategory)}
            aria-label="依分類篩選 Blog"
            className="px-2.5 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "全部分類主題" : c}
              </option>
            ))}
          </select>

          <span className="text-xs font-mono text-[#787774] tabular-nums pl-1">
            共 {filtered.length} 篇重點稿
          </span>
        </div>
      </div>

      {/* Blog Feed Render */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E9E9E7] rounded-md p-10 text-center space-y-2 text-xs text-[#787774]">
          <p>目前篩選條件尚無對應文章，請切換國家或來源屬性。</p>
        </div>
      ) : template === "minimal" ? (
        <div className="space-y-4">
          {filtered.slice(0, 24).map((entry) => {
            const digest = getCondensedDigest(entry);
            const entrySector = getEntrySector(entry);
            return (
              <article
                key={entry.id}
                className="bg-white border border-[#E9E9E7] rounded-md p-5 sm:p-6 flex flex-col sm:flex-row gap-5 hover:border-[#D3D1CB] transition-colors"
              >
                {entry.bannerImage && !entry.bannerImage.startsWith("/src/assets/images/banner_") && (
                  <SafeBannerImage
                    src={entry.bannerImage}
                    alt={digest.headline}
                    category={entry.category}
                    wrapperClassName="w-full sm:w-44 h-36 sm:h-auto shrink-0 bg-[#F4F2EE] border border-[#E9E9E7] rounded-[4px] overflow-hidden"
                    className="w-full h-full object-cover"
                  />
                )}

                <div className="flex-1 min-w-0 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SectorTag sector={entrySector} />
                    <CountryTag countryCode={entry.countryCode} countryName={entry.countryName} />
                    <CategoryTag category={entry.category} />
                    <RiskTag level={entry.riskLevel} />
                    <span className="font-mono text-[11px] text-[#9B9A97] tabular-nums ml-auto">
                      {formatShortDate(entry.publishedAt)}
                    </span>
                  </div>

                  <Link to={`/blog/${entry.id}`} className="block group">
                    <h2 className="text-lg font-bold text-[#37352F] leading-snug group-hover:underline">
                      {digest.headline}
                    </h2>
                  </Link>

                  <p className="text-sm text-[#5A5852] leading-relaxed">{digest.lead}</p>

                  <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] p-3 space-y-1 text-xs text-[#37352F]">
                    {digest.keyPoints.slice(0, 3).map((pt, i) => (
                      <div key={i} className="flex items-start gap-2 leading-snug">
                        <span className="font-mono text-[#9B9A97] tabular-nums">
                          {String(i + 1).padStart(2, "0")}.
                        </span>
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#787774]">
                    <span className="inline-flex items-center gap-1.5">
                      <SafeSourceIcon
                        src={entry.sourceIcon}
                        url={entry.url}
                        category={entry.category}
                        alt={entry.sourceName}
                        className="w-3.5 h-3.5"
                      />
                      <span>{entry.sourceName}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/post/${entry.id}`}
                        className="text-[#787774] hover:text-[#37352F] hover:underline"
                      >
                        閱讀器與畫重點
                      </Link>
                      <Link
                        to={`/blog/${entry.id}`}
                        className="font-medium text-[#37352F] hover:underline"
                      >
                        閱讀精華單篇 →
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : template === "editorial" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.slice(0, 21).map((entry, idx) => renderBlogPostCard(entry, idx === 0))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.slice(0, 24).map((entry) => renderBlogPostCard(entry, false))}
        </div>
      )}
    </div>
  );
}
