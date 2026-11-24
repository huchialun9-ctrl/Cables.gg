import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Check,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  RefreshCw,
  Rss,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type {
  BlogProfileConfig,
  CreatorPlatform,
  ProfileActivityItem,
  RealCreatorProfile,
} from "../types/cables";
import { formatShortDate } from "../components/NotionTags";
import { ActivityWallFeed } from "../components/ActivityWallFeed";

interface ProfilesPageProps {
  blogProfile: BlogProfileConfig | null;
  onRefreshAll: () => Promise<void>;
}

export function ProfilesPage({ blogProfile, onRefreshAll }: ProfilesPageProps) {
  const [activeTab, setActiveTab] = useState<"directory" | "activity">("directory");
  const [profiles, setProfiles] = useState<RealCreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<"all" | CreatorPlatform>("all");

  // Aggregated Activity Wall state
  const [wallActivities, setWallActivities] = useState<ProfileActivityItem[]>([]);
  const [wallLoading, setWallLoading] = useState(false);
  const [wallRefreshing, setWallRefreshing] = useState(false);

  // Live creator lookup state
  const [lookupPlatform, setLookupPlatform] = useState<CreatorPlatform>("github");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookedUpProfile, setLookedUpProfile] = useState<RealCreatorProfile | null>(null);

  // Reference & follow action states
  const [referenceNotes, setReferenceNotes] = useState<Record<string, string>>({});
  const [referencingId, setReferencingId] = useState<string | null>(null);
  const [followingId, setFollowingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadDirectory = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/profiles/discover${force ? "?refresh=1" : ""}`);
      if (res.ok) {
        const body = (await res.json()) as { profiles: RealCreatorProfile[] };
        setProfiles(body.profiles || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadActivityWall = useCallback(async (force = false) => {
    if (force) setWallRefreshing(true);
    else setWallLoading(true);
    try {
      const res = await fetch(`/api/profiles/activity-wall${force ? "?refresh=1" : ""}`);
      if (res.ok) {
        const body = (await res.json()) as { activities?: ProfileActivityItem[] };
        setWallActivities(body.activities || []);
      }
    } finally {
      setWallLoading(false);
      setWallRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory(false);
  }, []);

  useEffect(() => {
    if (activeTab === "activity") {
      loadActivityWall(false);
    }
  }, [activeTab, loadActivityWall]);

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setLookingUp(true);
    setLookupError(null);
    setLookedUpProfile(null);
    try {
      const res = await fetch("/api/profiles/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: lookupPlatform,
          query: lookupQuery.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        profile?: RealCreatorProfile;
        error?: string;
      };
      if (!res.ok || !body.profile) {
        throw new Error(body.error || "查詢外部真實個人檔案失敗");
      }
      setLookedUpProfile(body.profile);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "查詢失敗");
    } finally {
      setLookingUp(false);
    }
  };

  const handleToggleFollow = async (profile: RealCreatorProfile) => {
    setFollowingId(profile.id);
    setStatusMessage(null);
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
      if (!res.ok) throw new Error(body.error || "更新追蹤狀態失敗");
      await onRefreshAll();
      if (activeTab === "activity") {
        await loadActivityWall(false);
      }
      setStatusMessage(
        body.following
          ? `已追蹤「${profile.displayName}」，該開發者近期收藏、標記與 Blog 發布將同步匯入動態牆。`
          : `已取消追蹤「${profile.displayName}」。`
      );
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "追蹤操作失敗");
    } finally {
      setFollowingId(null);
    }
  };

  const handleUnfollowById = async (id: string, displayName: string) => {
    setFollowingId(id);
    try {
      const res = await fetch(`/api/profiles/follow/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await onRefreshAll();
        if (activeTab === "activity") {
          await loadActivityWall(false);
        }
        setStatusMessage(`已取消追蹤「${displayName}」。`);
      }
    } finally {
      setFollowingId(null);
    }
  };

  const handleReferenceProfile = async (profile: RealCreatorProfile) => {
    setReferencingId(profile.id);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/profiles/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          referenceNote: referenceNotes[profile.id] || "",
          subscribeFeed: true,
          importArticles: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        importedEntryCount?: number;
        subscribedSourceId?: string | null;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || "參考並導入個人檔案失敗");
      }
      await onRefreshAll();
      setStatusMessage(
        `已參考「${profile.displayName}」並導入 ${body.importedEntryCount ?? 0} 篇真實文章至 /b/${
          blogProfile?.slug || "my-cables"
        }${body.subscribedSourceId ? "（已自動追蹤該作者 RSS 訂閱源）" : ""}。`
      );
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "參考失敗");
    } finally {
      setReferencingId(null);
    }
  };

  const handleRemoveReference = async (id: string) => {
    const res = await fetch(`/api/profiles/reference/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await onRefreshAll();
    }
  };

  const referencedIds = new Set((blogProfile?.referencedProfiles ?? []).map((p) => p.id));
  const followedProfiles = blogProfile?.followedProfiles ?? [];
  const followedIds = new Set(followedProfiles.map((p) => p.id));

  const filteredProfiles = profiles.filter((p) =>
    platformFilter === "all" ? true : p.platform === platformFilter
  );

  const renderProfileCard = (profile: RealCreatorProfile) => {
    const isReferenced = referencedIds.has(profile.id);
    const isFollowed = followedIds.has(profile.id);
    const isWorking = referencingId === profile.id;
    const isFollowingBusy = followingId === profile.id;
    const profileWallRoute = `/profiles/${encodeURIComponent(profile.platform)}/${encodeURIComponent(
      profile.handle
    )}`;

    return (
      <article
        key={profile.id}
        className="bg-white border border-[#E9E9E7] rounded-md p-5 flex flex-col justify-between gap-4 hover:border-[#D3D1CB] transition-colors"
      >
        <div className="space-y-3.5">
          {/* Author Identity */}
          <div className="flex items-start justify-between gap-3">
            <Link to={profileWallRoute} className="flex items-center gap-3 min-w-0 group">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="w-11 h-11 rounded-full object-cover border border-[#E9E9E7] bg-[#F7F6F3] shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full border border-[#E9E9E7] bg-[#F7F6F3] flex items-center justify-center text-sm font-semibold text-[#37352F] shrink-0">
                  {profile.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#37352F] truncate group-hover:underline">
                    {profile.displayName}
                  </h3>
                  <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-[#F7F6F3] border border-[#E9E9E7] rounded-[3px] text-[#5A5852] shrink-0">
                    {profile.platform}
                  </span>
                </div>
                <div className="text-xs font-mono text-[#787774] truncate">
                  @{profile.handle}
                  {profile.location ? ` · ${profile.location}` : ""}
                </div>
              </div>
            </Link>

            <a
              href={profile.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-[#787774] hover:text-[#37352F] rounded-[4px] hover:bg-[#F7F6F3] shrink-0"
              title="前往真實原始個人檔案"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <p className="text-xs text-[#5A5852] leading-relaxed line-clamp-2">{profile.bio}</p>

          {/* Metrics & Links */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-[#787774] tabular-nums">
            {profile.followers !== null && (
              <span>{profile.followers.toLocaleString()} followers</span>
            )}
            {profile.publicRepos !== null && <span>{profile.publicRepos} repos</span>}
            {profile.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#37352F] hover:underline truncate max-w-[180px]"
              >
                <Globe className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {profile.websiteUrl.replace(/^https?:\/\/(www\.)?/, "")}
                </span>
              </a>
            )}
            {profile.rssUrl && (
              <span className="inline-flex items-center gap-1 text-[#8F4B14]">
                <Rss className="w-3 h-3" />
                <span>含真實 RSS/Feed</span>
              </span>
            )}
          </div>

          {/* Live Recent Articles / Projects */}
          {profile.articles.length > 0 && (
            <div className="bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] p-3 space-y-2">
              <div className="text-[11px] font-medium text-[#787774]">
                最新公開發表與專案（即時抓取）
              </div>
              <ul className="space-y-1.5">
                {profile.articles.slice(0, 2).map((art, i) => (
                  <li key={`${art.url}-${i}`} className="text-xs leading-snug">
                    <a
                      href={art.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#37352F] hover:underline line-clamp-1"
                    >
                      {art.title}
                    </a>
                    <div className="text-[11px] text-[#787774] line-clamp-1 mt-0.5">
                      {formatShortDate(art.publishedAt)} · {art.summary}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Follow, Activity Wall & Reference Actions */}
        <div className="pt-3 border-t border-[#E9E9E7] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleToggleFollow(profile)}
              disabled={isFollowingBusy}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-[4px] transition-colors whitespace-nowrap shrink-0 ${
                isFollowed
                  ? "bg-[#EDF5F0] text-[#22643D] border border-[#C7E0D0] hover:bg-[#E1EFE6]"
                  : "bg-white border border-[#E9E9E7] text-[#37352F] hover:bg-[#EFEFEE]"
              }`}
            >
              {isFollowingBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isFollowed ? (
                <UserCheck className="w-3.5 h-3.5" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              <span>{isFollowed ? "追蹤中" : "追蹤動態"}</span>
            </button>

            <Link
              to={profileWallRoute}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#FBFBFA] border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>查看動態牆</span>
            </Link>
          </div>

          <input
            type="text"
            value={referenceNotes[profile.id] || ""}
            onChange={(e) =>
              setReferenceNotes((prev) => ({ ...prev, [profile.id]: e.target.value }))
            }
            placeholder="選填：寫下參考該作者的簡短筆記（將顯示於您的 Blog）..."
            className="w-full px-2.5 py-1.5 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] placeholder:text-[#9B9A97] focus:outline-none focus:border-[#37352F]"
          />
          <button
            type="button"
            onClick={() => handleReferenceProfile(profile)}
            disabled={isWorking}
            className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[4px] transition-colors whitespace-nowrap shrink-0 ${
              isReferenced
                ? "bg-[#EDF5F0] text-[#22643D] border border-[#C7E0D0] hover:bg-[#E1EFE6]"
                : "bg-[#37352F] text-white hover:bg-[#2F2D28]"
            }`}
          >
            {isWorking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isReferenced ? (
              <UserCheck className="w-3.5 h-3.5" />
            ) : (
              <UserPlus className="w-3.5 h-3.5" />
            )}
            <span>
              {isReferenced
                ? "已參考並導入（點擊重新同步最新文章）"
                : "參考並導入我的專屬 Blog"}
            </span>
          </button>
        </div>
      </article>
    );
  };

  const activeSlug = blogProfile?.slug || "my-cables";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#E9E9E7] pb-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#787774]">
            <Users className="w-3.5 h-3.5" />
            <span>功能二延伸 · 真實創作者檔案與動態牆</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#37352F]">
            真實開發者個人檔案、動態牆與追蹤中心
          </h1>
          <p className="text-sm text-[#787774] max-w-2xl">
            即時連結 GitHub、DEV Community 與獨立技術 Blog RSS，查看開發者近期的收藏（Starred）、標記與公開動態、以及發布到個人
            Blog 的最新內容，並支援一鍵追蹤與參考導入。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to="/profiles/cables/owner"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>查看主編動態牆</span>
          </Link>

          <Link
            to={`/b/${activeSlug}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>前往我的 Blog (/b/{activeSlug})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Primary View Switcher: Directory vs Aggregated Activity Wall */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center border border-[#E9E9E7] rounded-[4px] bg-[#F7F6F3] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("directory")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] font-medium whitespace-nowrap ${
              activeTab === "directory"
                ? "bg-white text-[#37352F] shadow-2xs"
                : "text-[#5A5852] hover:text-[#37352F]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>探索與搜尋真實開發者</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] font-medium whitespace-nowrap ${
              activeTab === "activity"
                ? "bg-white text-[#37352F] shadow-2xs"
                : "text-[#5A5852] hover:text-[#37352F]"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>動態牆串流（收藏 · 標記 · Blog 發布）</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            activeTab === "activity" ? loadActivityWall(true) : loadDirectory(true)
          }
          disabled={activeTab === "activity" ? wallRefreshing : refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] text-[#37352F] rounded-[4px] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${
              (activeTab === "activity" ? wallRefreshing : refreshing) ? "animate-spin" : ""
            }`}
          />
          <span>{activeTab === "activity" ? "重新同步動態牆" : "重新抓取即時作者清單"}</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-3.5 bg-[#EDF5F0] border border-[#C7E0D0] rounded-md flex flex-wrap items-center justify-between gap-2 text-xs text-[#22643D]">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <Link to={`/b/${activeSlug}`} className="font-semibold underline whitespace-nowrap">
            立即在 /b/{activeSlug} 查看 →
          </Link>
        </div>
      )}

      {activeTab === "activity" ? (
        <div className="space-y-6">
          {/* Followed Developers Strip */}
          <section className="bg-white border border-[#E9E9E7] rounded-md p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#37352F] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#22643D]" />
                <span>
                  追蹤中的開發者與主編（{followedProfiles.length + 1} 位，動態即時匯流）
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab("directory")}
                className="text-xs font-medium text-[#37352F] hover:underline whitespace-nowrap"
              >
                + 探索更多真實開發者
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to="/profiles/cables/owner"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE]"
              >
                <span className="w-5 h-5 rounded-full bg-[#37352F] text-white flex items-center justify-center text-[10px] font-bold">
                  {(blogProfile?.ownerName || "C").slice(0, 1).toUpperCase()}
                </span>
                <span className="font-medium text-[#37352F]">
                  {blogProfile?.ownerName || "Cables.gg 主編"}
                </span>
                <span className="font-mono text-[11px] text-[#787774]">主編動態</span>
              </Link>

              {followedProfiles.map((fp) => (
                <div
                  key={fp.id}
                  className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]"
                >
                  <Link
                    to={`/profiles/${encodeURIComponent(fp.platform)}/${encodeURIComponent(
                      fp.handle
                    )}`}
                    className="inline-flex items-center gap-2 hover:underline"
                  >
                    {fp.avatarUrl && (
                      <img
                        src={fp.avatarUrl}
                        alt={fp.displayName}
                        className="w-5 h-5 rounded-full object-cover border border-[#E9E9E7]"
                      />
                    )}
                    <span className="font-medium text-[#37352F]">{fp.displayName}</span>
                    <span className="font-mono text-[11px] text-[#787774]">@{fp.handle}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleUnfollowById(fp.id, fp.displayName)}
                    disabled={followingId === fp.id}
                    className="p-1 text-[#9B9A97] hover:text-[#9B2C2C]"
                    aria-label={`取消追蹤 ${fp.displayName}`}
                    title="取消追蹤"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <ActivityWallFeed
            activities={wallActivities}
            loading={wallLoading || wallRefreshing}
            emptyText="尚未彙整到動態項目，請嘗試追蹤更多真實開發者或於文章閱讀器進行收藏與劃線標記。"
          />
        </div>
      ) : (
        <>
          {/* Live Lookup Any Real GitHub / Dev.to / RSS Creator */}
          <section className="bg-white border border-[#E9E9E7] rounded-md p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[#37352F] flex items-center gap-1.5">
                <Search className="w-4 h-4" />
                <span>即時搜尋真實外部創作者或公開 Blog（無假資料）</span>
              </h2>
              <p className="text-xs text-[#787774]">
                輸入任何真實 GitHub 帳號（如 <code className="font-mono">torvalds</code>、
                <code className="font-mono">sindresorhus</code>）、DEV.to 帳號或獨立個人 Blog 的 RSS/Atom 網址即時查閱動態牆、追蹤並參考導入。
              </p>
            </div>

            <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={lookupPlatform}
                onChange={(e) => setLookupPlatform(e.target.value as CreatorPlatform)}
                aria-label="選擇查詢平台"
                className="px-3 py-2 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F]"
              >
                <option value="github">GitHub 真實開發者帳號</option>
                <option value="devto">DEV.to 作者帳號</option>
                <option value="rss">獨立 Blog RSS / Atom 網址</option>
              </select>

              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder={
                  lookupPlatform === "rss"
                    ? "例如：https://martinfowler.com/feed.atom"
                    : lookupPlatform === "devto"
                      ? "例如：ben"
                      : "例如：torvalds 或 karpathy"
                }
                className="sm:col-span-2 px-3 py-2 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] focus:outline-none focus:border-[#37352F]"
              />

              <button
                type="submit"
                disabled={lookingUp || !lookupQuery.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {lookingUp ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>即時抓取個人檔案</span>
              </button>
            </form>

            {lookupError && <p className="text-xs text-[#9B2C2C]">{lookupError}</p>}

            {lookedUpProfile && (
              <div className="pt-2">
                <div className="text-xs font-medium text-[#22643D] mb-2">
                  即時查詢結果（真實公開資料）
                </div>
                {renderProfileCard(lookedUpProfile)}
              </div>
            )}
          </section>

          {/* Currently Referenced Profiles Summary */}
          {(blogProfile?.referencedProfiles ?? []).length > 0 && (
            <section className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden">
              <div className="px-5 py-3 bg-[#F7F6F3] border-b border-[#E9E9E7] flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-[#37352F] flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#22643D]" />
                  <span>
                    已參考至我的專屬 Blog (/b/{activeSlug}) 的創作者（
                    {blogProfile?.referencedProfiles.length ?? 0} 位）
                  </span>
                </div>
                <Link
                  to={`/b/${activeSlug}`}
                  className="text-xs font-medium text-[#37352F] hover:underline whitespace-nowrap"
                >
                  在專屬 Blog 檢視 →
                </Link>
              </div>
              <div className="divide-y divide-[#E9E9E7]">
                {(blogProfile?.referencedProfiles ?? []).map((ref) => (
                  <div
                    key={ref.id}
                    className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {ref.avatarUrl && (
                        <img
                          src={ref.avatarUrl}
                          alt={ref.displayName}
                          className="w-8 h-8 rounded-full border border-[#E9E9E7] object-cover shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <Link
                          to={`/profiles/${encodeURIComponent(ref.platform)}/${encodeURIComponent(
                            ref.handle
                          )}`}
                          className="font-semibold text-[#37352F] hover:underline flex items-center gap-2"
                        >
                          <span>{ref.displayName}</span>
                          <span className="font-mono text-[11px] font-normal text-[#787774]">
                            @{ref.handle}
                          </span>
                        </Link>
                        <div className="text-[#787774] truncate max-w-xl">
                          {ref.referenceNote
                            ? `筆記：${ref.referenceNote}`
                            : `已導入 ${ref.importedEntryIds.length} 篇文章至您的 Blog`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        to={`/profiles/${encodeURIComponent(ref.platform)}/${encodeURIComponent(
                          ref.handle
                        )}`}
                        className="px-2.5 py-1 bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE] text-[#37352F]"
                      >
                        動態牆
                      </Link>
                      <a
                        href={ref.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE] text-[#37352F]"
                      >
                        原始檔案
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveReference(ref.id)}
                        className="p-1.5 text-[#9B9A97] hover:text-[#9B2C2C]"
                        aria-label={`移除參考 ${ref.displayName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Real Directory Filter + Grid */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[#37352F] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#787774]" />
                <span>公開活躍開發者與技術寫作者（即時連線取得）</span>
              </h2>

              <div className="inline-flex items-center border border-[#E9E9E7] rounded-[4px] bg-[#F7F6F3] p-0.5 text-xs">
                {[
                  { id: "all", label: `全部 (${profiles.length})` },
                  { id: "github", label: "GitHub 開源作者" },
                  { id: "devto", label: "DEV Community 作者" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPlatformFilter(tab.id as "all" | CreatorPlatform)}
                    className={`px-2.5 py-1 rounded-[3px] font-medium whitespace-nowrap ${
                      platformFilter === tab.id
                        ? "bg-white text-[#37352F] shadow-2xs"
                        : "text-[#5A5852] hover:text-[#37352F]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-64 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md p-5"
                  />
                ))}
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="bg-white border border-[#E9E9E7] rounded-md p-10 text-center text-xs text-[#787774]">
                目前無法連線取得公開創作者目錄，請使用上方搜尋框即時查詢 GitHub 帳號或 RSS 網址。
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProfiles.map(renderProfileCard)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
