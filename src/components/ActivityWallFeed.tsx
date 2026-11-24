import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  BookmarkCheck,
  ExternalLink,
  Highlighter,
} from "lucide-react";
import type { ProfileActivityItem, ProfileActivityKind } from "../types/cables";
import { formatShortDate } from "./NotionTags";

interface ActivityWallFeedProps {
  activities: ProfileActivityItem[];
  loading?: boolean;
  emptyText?: string;
  showActorHeader?: boolean;
}

const KIND_TABS: Array<{ id: "all" | ProfileActivityKind; label: string }> = [
  { id: "all", label: "全部動態" },
  { id: "bookmark", label: "近期收藏" },
  { id: "highlight", label: "標記與動態" },
  { id: "blog_post", label: "發布至 Blog" },
];

export function ActivityWallFeed({
  activities,
  loading = false,
  emptyText = "目前尚無近期收藏、標記或 Blog 發布動態。",
  showActorHeader = true,
}: ActivityWallFeedProps) {
  const [kindFilter, setKindFilter] = useState<"all" | ProfileActivityKind>("all");

  const counts = useMemo(
    () => ({
      all: activities.length,
      bookmark: activities.filter((a) => a.kind === "bookmark").length,
      highlight: activities.filter((a) => a.kind === "highlight").length,
      blog_post: activities.filter((a) => a.kind === "blog_post").length,
    }),
    [activities]
  );

  const visible = useMemo(() => {
    if (kindFilter === "all") return activities;
    return activities.filter((a) => a.kind === kindFilter);
  }, [activities, kindFilter]);

  const getKindVisual = (kind: ProfileActivityKind) => {
    switch (kind) {
      case "bookmark":
        return {
          icon: BookmarkCheck,
          badgeClass: "bg-[#EDF5F0] text-[#22643D] border-[#C7E0D0]",
          defaultLabel: "收藏",
        };
      case "highlight":
        return {
          icon: Highlighter,
          badgeClass: "bg-[#FFF6EB] text-[#8F4B14] border-[#F0D3AE]",
          defaultLabel: "標記",
        };
      case "blog_post":
        return {
          icon: BookOpen,
          badgeClass: "bg-[#EEF2F9] text-[#2B4C7E] border-[#CBD7EC]",
          defaultLabel: "發布至 Blog",
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Kind Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap items-center border border-[#E9E9E7] rounded-[4px] bg-[#F7F6F3] p-0.5 text-xs">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setKindFilter(tab.id)}
              className={`px-2.5 py-1 rounded-[3px] font-medium whitespace-nowrap tabular-nums ${
                kindFilter === tab.id
                  ? "bg-white text-[#37352F] shadow-2xs"
                  : "text-[#5A5852] hover:text-[#37352F]"
              }`}
            >
              {tab.label} ({counts[tab.id]})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md p-4"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-[#E9E9E7] rounded-md p-8 text-center text-xs text-[#787774]">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => {
            const visual = getKindVisual(item.kind);
            const Icon = visual.icon;
            const actorProfilePath =
              item.platform === "cables"
                ? "/profiles/cables/owner"
                : `/profiles/${item.platform}/${encodeURIComponent(item.actorHandle)}`;
            const isInternal = Boolean(item.internalBlogId || item.internalPostId);
            const targetHref = item.internalBlogId
              ? `/blog/${item.internalBlogId}`
              : item.internalPostId
                ? `/post/${item.internalPostId}`
                : item.url;

            return (
              <article
                key={item.id}
                className="bg-white border border-[#E9E9E7] rounded-md p-4 sm:p-5 space-y-2.5 hover:border-[#D3D1CB] transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    {showActorHeader && (
                      <Link
                        to={actorProfilePath}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-[#37352F] hover:underline shrink-0"
                      >
                        {item.actorAvatarUrl ? (
                          <img
                            src={item.actorAvatarUrl}
                            alt={item.actorName}
                            className="w-6 h-6 rounded-full border border-[#E9E9E7] object-cover"
                          />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-[#F7F6F3] border border-[#E9E9E7] flex items-center justify-center text-[11px] font-bold text-[#37352F]">
                            {item.actorName.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span>{item.actorName}</span>
                        <span className="font-mono text-[11px] font-normal text-[#787774]">
                          @{item.actorHandle}
                        </span>
                      </Link>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border rounded-[4px] ${visual.badgeClass}`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{item.metaLabel || visual.defaultLabel}</span>
                    </span>
                  </div>

                  <span className="font-mono text-[11px] text-[#9B9A97] tabular-nums shrink-0">
                    {formatShortDate(item.createdAt)}
                  </span>
                </div>

                {isInternal ? (
                  <Link
                    to={targetHref}
                    className="block text-sm font-bold text-[#37352F] hover:underline leading-snug"
                  >
                    {item.title}
                  </Link>
                ) : (
                  <a
                    href={targetHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#37352F] hover:underline leading-snug"
                  >
                    <span>{item.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#787774]" />
                  </a>
                )}

                {item.excerpt && (
                  <p className="text-xs text-[#5A5852] leading-relaxed bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] px-3 py-2">
                    {item.excerpt}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#787774]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.tags.slice(0, 4).map((tag, idx) => (
                      <span
                        key={`${tag}-${idx}`}
                        className="px-1.5 py-0.5 font-mono bg-[#F7F6F3] border border-[#E9E9E7] rounded-[3px] text-[#5A5852]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {item.internalPostId && (
                      <Link
                        to={`/post/${item.internalPostId}`}
                        className="text-[#787774] hover:text-[#37352F] hover:underline inline-flex items-center gap-1"
                      >
                        <Highlighter className="w-3 h-3" />
                        <span>進入閱讀器劃線</span>
                      </Link>
                    )}
                    {isInternal ? (
                      <Link
                        to={targetHref}
                        className="font-medium text-[#37352F] hover:underline"
                      >
                        開啟內容 →
                      </Link>
                    ) : (
                      <a
                        href={targetHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#37352F] hover:underline"
                      >
                        前往原始連結 →
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
