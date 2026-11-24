import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  RefreshCw,
  Rss,
  UserCheck,
  UserPlus,
} from "lucide-react";
import type {
  BlogProfileConfig,
  DeveloperActivityWallPayload,
} from "../types/cables";
import { ActivityWallFeed } from "../components/ActivityWallFeed";

interface DeveloperProfilePageProps {
  blogProfile: BlogProfileConfig | null;
  onRefreshAll: () => Promise<void>;
}

export function DeveloperProfilePage({
  blogProfile,
  onRefreshAll,
}: DeveloperProfilePageProps) {
  const { platform = "github", handle = "" } = useParams<{
    platform?: string;
    handle?: string;
  }>();

  const [payload, setPayload] = useState<DeveloperActivityWallPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingFollow, setTogglingFollow] = useState(false);
  const [referencing, setReferencing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const isOwnerProfile = platform === "cables";

  const loadWall = useCallback(
    async (force = false) => {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/profiles/${encodeURIComponent(platform)}/${encodeURIComponent(handle)}/activity${
            force ? "?refresh=1" : ""
          }`
        );
        const body = (await res.json().catch(() => ({}))) as DeveloperActivityWallPayload & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error || "無法載入開發者個人檔案與動態牆");
        }
        setPayload(body);
      } catch (err) {
        setError(err instanceof Error ? err.message : "載入失敗");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [platform, handle]
  );

  useEffect(() => {
    loadWall(false);
  }, [loadWall]);

  const profile = payload?.profile;
  const activeSlug = blogProfile?.slug || "my-cables";

  const isFollowing = isOwnerProfile
    ? Boolean(blogProfile?.ownerFollowed)
    : Boolean(
        profile && (blogProfile?.followedProfiles ?? []).some((p) => p.id === profile.id)
      );

  const isReferenced = Boolean(
    profile && (blogProfile?.referencedProfiles ?? []).some((p) => p.id === profile.id)
  );

  const handleToggleFollow = async () => {
    if (!profile) return;
    setTogglingFollow(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/profiles/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isOwnerProfile ? { ownerAction: true } : { profile }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        following?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "更新追蹤狀態失敗");
      await onRefreshAll();
      await loadWall(false);
      setStatusMsg(
        body.following
          ? `已追蹤「${profile.displayName}」，其最新收藏、標記與 Blog 發布將同步匯入動態牆。`
          : `已取消追蹤「${profile.displayName}」。`
      );
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "追蹤操作失敗");
    } finally {
      setTogglingFollow(false);
    }
  };

  const handleReferenceIntoBlog = async () => {
    if (!profile || isOwnerProfile) return;
    setReferencing(true);
    setStatusMsg(null);
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
      if (!res.ok) throw new Error(body.error || "參考並導入失敗");
      await onRefreshAll();
      setStatusMsg(
        `已參考「${profile.displayName}」並導入 ${body.importedEntryCount ?? 0} 篇文章至 /b/${activeSlug}。`
      );
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "導入失敗");
    } finally {
      setReferencing(false);
    }
  };

  if (loading && !payload) {
    return (
      <div className="space-y-6">
        <div className="h-36 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md" />
        <div className="h-64 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-white border border-[#E9E9E7] rounded-md p-8 space-y-4">
        <p className="text-sm font-medium text-[#9B2C2C]">
          {error || "找不到指定的開發者個人檔案。"}
        </p>
        <Link
          to="/profiles"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>返回開發者個人檔案庫</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/profiles"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#787774] hover:text-[#37352F]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>返回真實創作者與開發者檔案庫</span>
        </Link>

        <button
          type="button"
          onClick={() => loadWall(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>重新抓取最新動態</span>
        </button>
      </div>

      {/* Developer Profile Header Card */}
      <header className="bg-white border border-[#E9E9E7] rounded-md p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="w-16 h-16 rounded-full border border-[#E9E9E7] object-cover shrink-0 bg-[#F7F6F3]"
              />
            ) : (
              <div className="w-16 h-16 rounded-full border border-[#E9E9E7] bg-[#37352F] text-white flex items-center justify-center text-xl font-bold shrink-0">
                {profile.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#37352F] tracking-tight">
                  {profile.displayName}
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-mono uppercase bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] text-[#5A5852]">
                  {isOwnerProfile ? "CABLES.GG 主編" : profile.platform}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-[#787774]">
                <span>@{profile.handle}</span>
                {profile.location && (
                  <span className="inline-flex items-center gap-1 font-sans">
                    <MapPin className="w-3 h-3" />
                    <span>{profile.location}</span>
                  </span>
                )}
                {profile.company && <span className="font-sans">{profile.company}</span>}
              </div>

              <p className="text-sm text-[#5A5852] leading-relaxed max-w-2xl">{profile.bio}</p>
            </div>
          </div>

          {/* Follow & Reference Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleFollow}
              disabled={togglingFollow}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-[4px] transition-colors whitespace-nowrap shrink-0 ${
                isFollowing
                  ? "bg-[#EDF5F0] text-[#22643D] border border-[#C7E0D0] hover:bg-[#E1EFE6]"
                  : "bg-[#37352F] text-white hover:bg-[#2F2D28]"
              }`}
            >
              {togglingFollow ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isFollowing ? (
                <UserCheck className="w-3.5 h-3.5" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              <span>{isFollowing ? "追蹤中（取消追蹤）" : "追蹤開發者動態"}</span>
            </button>

            {isOwnerProfile ? (
              <Link
                to={`/b/${activeSlug}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>開啟個人 Blog (/b/{activeSlug})</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleReferenceIntoBlog}
                disabled={referencing}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
              >
                {referencing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BookOpen className="w-3.5 h-3.5" />
                )}
                <span>{isReferenced ? "同步參考文章至 Blog" : "參考並導入我的 Blog"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Metrics & Real External Links Bar */}
        <div className="pt-4 border-t border-[#E9E9E7] flex flex-wrap items-center justify-between gap-4 text-xs text-[#787774]">
          <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
            <span>近期收藏：{payload.stats.bookmarks}</span>
            <span>標記與動態：{payload.stats.highlights}</span>
            <span>Blog 發布：{payload.stats.blogPosts}</span>
            {profile.followers !== null && (
              <span>追蹤人數：{profile.followers.toLocaleString()}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isOwnerProfile && (
              <a
                href={profile.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#37352F] hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>原始檔案</span>
              </a>
            )}
            {profile.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target={isOwnerProfile ? undefined : "_blank"}
                rel={isOwnerProfile ? undefined : "noopener noreferrer"}
                className="inline-flex items-center gap-1 hover:text-[#37352F] hover:underline"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>個人網站 / Blog</span>
              </a>
            )}
            {profile.rssUrl && (
              <a
                href={profile.rssUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#8F4B14] hover:underline"
              >
                <Rss className="w-3.5 h-3.5" />
                <span>RSS Feed</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {statusMsg && (
        <div className="p-3 bg-[#EDF5F0] border border-[#C7E0D0] rounded-[4px] flex items-center gap-2 text-xs text-[#22643D]">
          <Check className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Developer Activity Wall Stream */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-[#37352F]">
            個人動態牆（收藏 · 標記 · 發布到個人 Blog）
          </h2>
          <p className="text-xs text-[#787774]">
            {isOwnerProfile
              ? "即時同步主編近期於知識庫收藏、閱讀器劃線標記及發布至專屬 Blog 的完整紀錄。"
              : `即時整合 ${profile.displayName} 公開的收藏項目、標記／討論動態與個人 Blog 發布內容。`}
          </p>
        </div>

        <ActivityWallFeed
          activities={payload.activities}
          loading={refreshing}
          showActorHeader={false}
        />
      </section>
    </div>
  );
}
