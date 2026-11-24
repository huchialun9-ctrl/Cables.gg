import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Rss,
  Settings,
  Sliders,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";
import type {
  BlogProfileConfig,
  CableEntry,
  DatabasePayload,
  ProfileActivityItem,
  RealCreatorProfile,
} from "../types/cables";
import {
  CategoryTag,
  CountryTag,
  RiskTag,
  SectorTag,
  formatShortDate,
} from "../components/NotionTags";
import { SafeBannerImage, SafeSourceIcon } from "../components/SafeImage";
import { getCondensedDigest, getEntrySector } from "../utils/blogTemplates";
import { ActivityWallFeed } from "../components/ActivityWallFeed";

interface CustomBlogPageProps {
  db: DatabasePayload | null;
  blogProfile: BlogProfileConfig | null;
  loading: boolean;
  onRefreshAll: () => Promise<void>;
}

export function CustomBlogPage({
  db,
  blogProfile,
  loading,
  onRefreshAll,
}: CustomBlogPageProps) {
  const { slug } = useParams<{ slug?: string }>();

  const [discoverProfiles, setDiscoverProfiles] = useState<RealCreatorProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [referencingId, setReferencingId] = useState<string | null>(null);
  const [followingId, setFollowingId] = useState<string | null>(null);
  const [togglingOwnerFollow, setTogglingOwnerFollow] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [viewMode, setViewMode] = useState<"curated" | "all" | "activity">("curated");

  // Owner Activity Wall state
  const [ownerActivities, setOwnerActivities] = useState<ProfileActivityItem[]>([]);
  const [ownerWallLoading, setOwnerWallLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingProfiles(true);
    fetch("/api/profiles/discover")
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { profiles?: RealCreatorProfile[] } | null) => {
        if (active && body?.profiles) {
          setDiscoverProfiles(body.profiles);
        }
      })
      .catch(() => {
        // Non-blocking
      })
      .finally(() => {
        if (active) setLoadingProfiles(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadOwnerActivityWall = useCallback(async () => {
    setOwnerWallLoading(true);
    try {
      const res = await fetch("/api/profiles/cables/owner/activity");
      if (res.ok) {
        const body = (await res.json()) as { activities?: ProfileActivityItem[] };
        setOwnerActivities(body.activities || []);
      }
    } finally {
      setOwnerWallLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "activity") {
      loadOwnerActivityWall();
    }
  }, [viewMode, loadOwnerActivityWall]);

  const configuredSlug = blogProfile?.slug || "my-cables";
  const allEntries = db?.entries ?? [];

  const curatedEntries = useMemo(() => {
    const importedSet = new Set(blogProfile?.importedEntryIds ?? []);
    return allEntries.filter(
      (entry) => importedSet.has(entry.id) || Boolean(entry.sharedToBlog)
    );
  }, [allEntries, blogProfile?.importedEntryIds]);

  const ruleMatchedEntries = useMemo(() => {
    const countries = blogProfile?.autoImportCountries ?? ["ALL"];
    const categories = blogProfile?.autoImportCategories ?? [];
    return allEntries.filter((entry) => {
      if (!countries.includes("ALL") && !countries.includes(entry.countryCode)) return false;
      if (categories.length > 0 && !categories.includes(entry.category)) return false;
      return true;
    });
  }, [allEntries, blogProfile?.autoImportCountries, blogProfile?.autoImportCategories]);

  const displayEntries: CableEntry[] =
    viewMode === "curated"
      ? curatedEntries.length > 0
        ? curatedEntries
        : ruleMatchedEntries.slice(0, 12)
      : ruleMatchedEntries.slice(0, 24);

  const referencedIds = new Set(
    (blogProfile?.referencedProfiles ?? []).map((p) => p.id)
  );
  const followedIds = new Set(
    (blogProfile?.followedProfiles ?? []).map((p) => p.id)
  );

  const handleToggleOwnerFollow = async () => {
    setTogglingOwnerFollow(true);
    setToastMsg(null);
    try {
      const res = await fetch("/api/profiles/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerAction: true }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        following?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "更新追蹤狀態失敗");
      await onRefreshAll();
      setToastMsg(
        body.following
          ? `已追蹤「${blogProfile?.ownerName || "Cables.gg 主編"}」的專屬 Blog 與動態牆。`
          : `已取消追蹤「${blogProfile?.ownerName || "Cables.gg 主編"}」。`
      );
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "追蹤操作失敗");
    } finally {
      setTogglingOwnerFollow(false);
    }
  };

  const handleToggleCreatorFollow = async (profile: RealCreatorProfile) => {
    setFollowingId(profile.id);
    setToastMsg(null);
    try {
      const res = await fetch("/api/profiles/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        following?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "追蹤失敗");
      await onRefreshAll();
      setToastMsg(
        body.following
          ? `已追蹤「${profile.displayName}」，可至動態牆檢視其收藏、標記與 Blog 發布。`
          : `已取消追蹤「${profile.displayName}」。`
      );
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setFollowingId(null);
    }
  };

  const handleQuickReference = async (profile: RealCreatorProfile) => {
    setReferencingId(profile.id);
    setToastMsg(null);
    try {
      const res = await fetch("/api/profiles/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          referenceNote: "",
          subscribeFeed: true,
          importArticles: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        importedEntryCount?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "導入創作者失敗");
      await onRefreshAll();
      setToastMsg(
        `已將 ${profile.displayName} 的個人檔案參考進您的 Blog，並同步導入 ${
          body.importedEntryCount ?? 0
        } 篇真實文章。`
      );
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setReferencingId(null);
    }
  };

  const handleRemoveFromBlog = async (entryId: string) => {
    const res = await fetch(
      `/api/blog-profile/imported-entries/${encodeURIComponent(entryId)}`,
      { method: "DELETE" }
    );
    if (res.ok) await onRefreshAll();
  };

  const handleRemoveReferenced = async (profileId: string) => {
    const res = await fetch(
      `/api/profiles/reference/${encodeURIComponent(profileId)}`,
      { method: "DELETE" }
    );
    if (res.ok) await onRefreshAll();
  };

  const handleCopyBlogLink = async () => {
    const url = `${window.location.origin}/b/${configuredSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      // Ignore
    }
  };

  if (loading && !db) {
    return (
      <div className="space-y-6">
        <div className="h-28 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md" />
        <div className="h-64 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md" />
      </div>
    );
  }

  const isSlugMismatch = slug && slug !== configuredSlug;
  const ownerFollowed = Boolean(blogProfile?.ownerFollowed);
  const ownerFollowersCount = blogProfile?.ownerFollowersCount ?? 0;

  return (
    <div className="space-y-8">
      {/* Slug Mismatch Notice if user visited an old slug */}
      {isSlugMismatch && (
        <div className="p-3.5 bg-[#FFF6EB] border border-[#F0D3AE] rounded-md flex flex-wrap items-center justify-between gap-2 text-xs text-[#8F4B14]">
          <span>
            目前設定的專屬 Blog 路由為 <code className="font-mono font-semibold">/b/{configuredSlug}</code>
            （您正在瀏覽 <code className="font-mono">/b/{slug}</code>）。
          </span>
          <Link
            to={`/b/${configuredSlug}`}
            className="font-semibold underline whitespace-nowrap"
          >
            切換至最新專屬路由 →
          </Link>
        </div>
      )}

      {/* Personal Blog Masthead */}
      <header className="bg-white border border-[#E9E9E7] rounded-md p-6 sm:p-8 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-[#787774]">
              <BookOpen className="w-3.5 h-3.5 text-[#37352F]" />
              <span>專屬個人 Blog 獨立頁面</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#22643D] font-semibold">/b/{configuredSlug}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#37352F]">
              {blogProfile?.blogTitle || "我的跨國情報與技術觀測 Blog"}
            </h1>

            <p className="text-sm text-[#5A5852] leading-relaxed">
              {blogProfile?.tagline ||
                "自動化引進各國官民資料流，結合真實創作者脈絡與個人精選評論"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleOwnerFollow}
              disabled={togglingOwnerFollow}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                ownerFollowed
                  ? "bg-[#EDF5F0] text-[#22643D] border border-[#C7E0D0] hover:bg-[#E1EFE6]"
                  : "bg-[#37352F] text-white hover:bg-[#2F2D28]"
              }`}
            >
              {togglingOwnerFollow ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : ownerFollowed ? (
                <UserCheck className="w-3.5 h-3.5" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              <span>
                {ownerFollowed ? "已追蹤主編動態" : "追蹤主編動態"} ({ownerFollowersCount})
              </span>
            </button>

            <Link
              to="/profiles/cables/owner"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>主編動態牆</span>
            </Link>

            <button
              type="button"
              onClick={handleCopyBlogLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
            >
              {copiedUrl ? (
                <Check className="w-3.5 h-3.5 text-[#22643D]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedUrl ? "已複製 Blog 網址" : `複製 /b/${configuredSlug}`}</span>
            </button>

            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>編輯 Blog 設定</span>
            </Link>

            <Link
              to="/automation"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>自動化引進文章</span>
            </Link>
          </div>
        </div>

        {/* Owner Bio + Stats Bar */}
        <div className="pt-4 border-t border-[#E9E9E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#787774]">
          <div className="space-y-0.5">
            <div className="font-semibold text-[#37352F]">
              主編：{blogProfile?.ownerName || "Cables.gg 主編"}
            </div>
            <div>{blogProfile?.ownerBio}</div>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums shrink-0">
            <span>已導入精選：{curatedEntries.length} 篇</span>
            <span>參考真實作者：{blogProfile?.referencedProfiles.length ?? 0} 位</span>
            <span>追蹤開發者：{blogProfile?.followedProfiles?.length ?? 0} 位</span>
            <span>排版：{blogProfile?.template || "editorial"}</span>
          </div>
        </div>
      </header>

      {toastMsg && (
        <div className="p-3.5 bg-[#EDF5F0] border border-[#C7E0D0] rounded-md flex items-center gap-2 text-xs text-[#22643D]">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Two-Column Editorial Split: Left = Imported Blog Posts / Activity Wall, Right = Other Real Creator Profiles */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left 8 Cols: Imported & Curated Blog Articles OR Owner Activity Wall */}
        <section className="lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#37352F]">
                {viewMode === "activity"
                  ? "主編動態牆（近期收藏 · 標記劃線 · Blog 發布）"
                  : viewMode === "curated" && curatedEntries.length > 0
                    ? `已導入我的專屬 Blog 文章 (${curatedEntries.length})`
                    : "自動化引進精選串流文章"}
              </h2>
              <p className="text-xs text-[#787774]">
                {viewMode === "activity"
                  ? "即時彙整主編於 Cables.gg 知識庫的收藏文章、深度閱讀器劃線標記與 Blog 發布紀錄。"
                  : curatedEntries.length > 0
                    ? "包含從「功能一：自動化引進中心」、閱讀器分享與外部創作者檔案導入的真實文章。"
                    : "尚未手動導入指定文章，目前依據您的自動規則展示最新抓取串流；可至「自動化引進與導入」挑選或直接導入下方創作者文章。"}
              </p>
            </div>

            <div className="inline-flex flex-wrap items-center border border-[#E9E9E7] rounded-[4px] bg-[#F7F6F3] p-0.5 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("curated")}
                className={`px-2.5 py-1 rounded-[3px] font-medium whitespace-nowrap ${
                  viewMode === "curated"
                    ? "bg-white text-[#37352F] shadow-2xs"
                    : "text-[#5A5852] hover:text-[#37352F]"
                }`}
              >
                已導入精選 ({curatedEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className={`px-2.5 py-1 rounded-[3px] font-medium whitespace-nowrap ${
                  viewMode === "all"
                    ? "bg-white text-[#37352F] shadow-2xs"
                    : "text-[#5A5852] hover:text-[#37352F]"
                }`}
              >
                全站符合規則串流
              </button>
              <button
                type="button"
                onClick={() => setViewMode("activity")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] font-medium whitespace-nowrap ${
                  viewMode === "activity"
                    ? "bg-white text-[#37352F] shadow-2xs"
                    : "text-[#5A5852] hover:text-[#37352F]"
                }`}
              >
                <Activity className="w-3 h-3" />
                <span>主編動態牆</span>
              </button>
            </div>
          </div>

          {viewMode === "activity" ? (
            <ActivityWallFeed
              activities={ownerActivities}
              loading={ownerWallLoading}
              showActorHeader={false}
              emptyText="主編目前尚無收藏、劃線標記或 Blog 發布紀錄；閱讀文章時進行收藏、劃線或分享至 Blog 即可同步顯示於此。"
            />
          ) : displayEntries.length === 0 ? (
            <div className="bg-white border border-[#E9E9E7] rounded-md p-10 text-center space-y-3">
              <p className="text-sm text-[#787774]">目前此檢視尚無文章。</p>
              <Link
                to="/automation"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28]"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>前往功能一引進與導入文章</span>
              </Link>
            </div>
          ) : (
            <div
              className={
                blogProfile?.template === "cards"
                  ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                  : "space-y-4"
              }
            >
              {displayEntries.map((entry) => {
                const digest = getCondensedDigest(entry);
                const sector = getEntrySector(entry);
                const isExplicitlyImported =
                  (blogProfile?.importedEntryIds ?? []).includes(entry.id) ||
                  Boolean(entry.sharedToBlog);

                return (
                  <article
                    key={entry.id}
                    className="bg-white border border-[#E9E9E7] rounded-md p-5 space-y-3 hover:border-[#D3D1CB] transition-colors"
                  >
                    {entry.bannerImage &&
                      !entry.bannerImage.startsWith("/src/assets/images/banner_") && (
                        <SafeBannerImage
                          src={entry.bannerImage}
                          alt={digest.headline}
                          category={entry.category}
                          wrapperClassName="w-full h-44 bg-[#F4F2EE] border border-[#E9E9E7] rounded-[4px] overflow-hidden"
                          className="w-full h-full object-cover"
                        />
                      )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SectorTag sector={sector} />
                        <CountryTag
                          countryCode={entry.countryCode}
                          countryName={entry.countryName}
                        />
                        <CategoryTag category={entry.category} />
                        <RiskTag level={entry.riskLevel} />
                      </div>
                      <span className="font-mono text-[11px] text-[#9B9A97] tabular-nums">
                        {formatShortDate(entry.publishedAt)}
                      </span>
                    </div>

                    <Link to={`/blog/${entry.id}`} className="block group">
                      <h3 className="text-lg font-bold text-[#37352F] leading-snug group-hover:underline">
                        {digest.headline}
                      </h3>
                    </Link>

                    <p className="text-sm text-[#5A5852] leading-relaxed">{digest.lead}</p>

                    <ul className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] p-3 space-y-1 text-xs text-[#37352F]">
                      {digest.keyPoints.slice(0, 2).map((pt, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-mono text-[#9B9A97] tabular-nums">
                            {String(i + 1).padStart(2, "0")}.
                          </span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-2 border-t border-[#E9E9E7] flex flex-wrap items-center justify-between gap-2 text-xs text-[#787774]">
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <SafeSourceIcon
                          src={entry.sourceIcon}
                          url={entry.url}
                          category={entry.category}
                          alt={entry.sourceName}
                          className="w-3.5 h-3.5"
                        />
                        <span className="truncate">{entry.sourceName}</span>
                      </span>

                      <div className="flex items-center gap-3 shrink-0">
                        {isExplicitlyImported && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFromBlog(entry.id)}
                            className="inline-flex items-center gap-1 text-[#9B9A97] hover:text-[#9B2C2C]"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>移出 Blog</span>
                          </button>
                        )}
                        <Link
                          to={`/post/${entry.id}`}
                          className="text-[#787774] hover:text-[#37352F] hover:underline whitespace-nowrap"
                        >
                          全文閱讀劃線
                        </Link>
                        <Link
                          to={`/blog/${entry.id}`}
                          className="font-medium text-[#37352F] hover:underline whitespace-nowrap"
                        >
                          閱讀摘要 →
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Right 4 Cols: Referenced Creators + Discover Other People's Real Profiles */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Already Referenced Creators on This Blog */}
          <div className="bg-white border border-[#E9E9E7] rounded-md p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#37352F] flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#22643D]" />
                <span>已參考的真實創作者 ({blogProfile?.referencedProfiles.length ?? 0})</span>
              </h2>
              <Link
                to="/profiles"
                className="text-xs font-medium text-[#37352F] hover:underline whitespace-nowrap"
              >
                全部檔案庫 →
              </Link>
            </div>

            {(blogProfile?.referencedProfiles ?? []).length === 0 ? (
              <p className="text-xs text-[#787774] leading-relaxed">
                尚未加入參考對象。點擊下方任意真實開發者或技術作者的個人檔案，即可一鍵將其作品與
                RSS 引用至您的 Blog，或進入對方的動態牆追蹤。
              </p>
            ) : (
              <div className="space-y-3">
                {(blogProfile?.referencedProfiles ?? []).map((ref) => {
                  const wallUrl = `/profiles/${encodeURIComponent(
                    ref.platform
                  )}/${encodeURIComponent(ref.handle)}`;
                  return (
                    <div
                      key={ref.id}
                      className="p-3 bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {ref.avatarUrl && (
                            <img
                              src={ref.avatarUrl}
                              alt={ref.displayName}
                              className="w-8 h-8 rounded-full border border-[#E9E9E7] object-cover shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <Link
                              to={wallUrl}
                              className="text-xs font-bold text-[#37352F] hover:underline flex items-center gap-1 truncate"
                            >
                              <span className="truncate">{ref.displayName}</span>
                            </Link>
                            <div className="text-[11px] font-mono text-[#787774] truncate">
                              {ref.platform} · @{ref.handle}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveReferenced(ref.id)}
                          className="p-1 text-[#9B9A97] hover:text-[#9B2C2C] shrink-0"
                          aria-label={`移除 ${ref.displayName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-[#5A5852] line-clamp-2">{ref.bio}</p>
                      {ref.referenceNote && (
                        <div className="text-[11px] text-[#22643D] bg-[#EDF5F0] px-2 py-1 rounded-[3px]">
                          主編參考註記：{ref.referenceNote}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-[#787774]">
                        <span>已導入 {ref.importedEntryIds.length} 篇</span>
                        <div className="flex items-center gap-2">
                          <Link
                            to={wallUrl}
                            className="inline-flex items-center gap-1 text-[#37352F] font-medium hover:underline"
                          >
                            <Activity className="w-3 h-3" />
                            <span>動態牆</span>
                          </Link>
                          <a
                            href={ref.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 hover:text-[#37352F]"
                            title="原始個人檔案"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          {ref.rssUrl && (
                            <span className="inline-flex items-center gap-1 text-[#8F4B14]">
                              <Rss className="w-3 h-3" />
                              <span>RSS</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Other Real Creators Profiles Discovery */}
          <div className="bg-white border border-[#E9E9E7] rounded-md p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#37352F] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#37352F]" />
                <span>其他人的真實個人檔案</span>
              </h2>
              <Link
                to="/profiles"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#37352F] hover:underline whitespace-nowrap"
              >
                <span>搜尋更多帳號</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-xs text-[#787774]">
              即時擷取 GitHub 與 DEV.to 真實公開個人檔案，支援直接追蹤動態、瀏覽個人動態牆或參考導入文章至您的
              Blog。
            </p>

            {loadingProfiles ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px]"
                  />
                ))}
              </div>
            ) : discoverProfiles.length === 0 ? (
              <div className="text-xs text-[#787774] py-4 text-center">
                請至「真實作者個人檔案」分頁即時搜尋 GitHub 或 RSS 作者。
              </div>
            ) : (
              <div className="space-y-3">
                {discoverProfiles.slice(0, 6).map((prof) => {
                  const isRef = referencedIds.has(prof.id);
                  const isFollowed = followedIds.has(prof.id);
                  const isBusy = referencingId === prof.id;
                  const isFollowBusy = followingId === prof.id;
                  const wallUrl = `/profiles/${encodeURIComponent(
                    prof.platform
                  )}/${encodeURIComponent(prof.handle)}`;

                  return (
                    <div
                      key={prof.id}
                      className="p-3 border border-[#E9E9E7] rounded-[4px] bg-[#FBFBFA] space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link to={wallUrl} className="flex items-center gap-2.5 min-w-0 group">
                          {prof.avatarUrl && (
                            <img
                              src={prof.avatarUrl}
                              alt={prof.displayName}
                              className="w-9 h-9 rounded-full border border-[#E9E9E7] object-cover shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#37352F] truncate group-hover:underline">
                              {prof.displayName}
                            </div>
                            <div className="text-[11px] font-mono text-[#787774] truncate">
                              {prof.platform.toUpperCase()} · @{prof.handle}
                            </div>
                          </div>
                        </Link>

                        <a
                          href={prof.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#787774] hover:text-[#37352F] shrink-0"
                          title="查看真實個人檔案"
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <p className="text-[11px] text-[#5A5852] line-clamp-2">{prof.bio}</p>

                      {prof.articles[0] && (
                        <a
                          href={prof.articles[0].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[11px] text-[#37352F] hover:underline truncate"
                        >
                          最新：{prof.articles[0].title}
                        </a>
                      )}

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleCreatorFollow(prof)}
                          disabled={isFollowBusy}
                          className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-[4px] transition-colors whitespace-nowrap ${
                            isFollowed
                              ? "bg-[#EDF5F0] text-[#22643D] border border-[#C7E0D0]"
                              : "bg-white border border-[#E9E9E7] text-[#37352F] hover:bg-[#EFEFEE]"
                          }`}
                        >
                          {isFollowBusy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isFollowed ? (
                            <UserCheck className="w-3 h-3" />
                          ) : (
                            <UserPlus className="w-3 h-3" />
                          )}
                          <span>{isFollowed ? "追蹤中" : "追蹤"}</span>
                        </button>

                        <Link
                          to={wallUrl}
                          className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] whitespace-nowrap"
                        >
                          <Activity className="w-3 h-3" />
                          <span>動態牆</span>
                        </Link>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickReference(prof)}
                        disabled={isBusy}
                        className={`w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-[4px] transition-colors whitespace-nowrap ${
                          isRef
                            ? "bg-[#EDF5F0] text-[#22643D] border border-[#C7E0D0]"
                            : "bg-white border border-[#E9E9E7] text-[#37352F] hover:bg-[#EFEFEE]"
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isRef ? (
                          <UserCheck className="w-3 h-3" />
                        ) : (
                          <UserPlus className="w-3 h-3" />
                        )}
                        <span>{isRef ? "已參考（同步更新）" : "參考並導入我的 Blog"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
