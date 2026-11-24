import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import type { DatabasePayload, SourceSector } from "../types/cables";
import { CategoryTag, CountryTag, RiskTag, SectorTag, formatShortDate } from "../components/NotionTags";
import { SafeBannerImage, SafeSourceIcon } from "../components/SafeImage";
import { getCondensedDigest, getEntrySector } from "../utils/blogTemplates";

interface EmbedPageProps {
  db: DatabasePayload | null;
  loading: boolean;
}

export function EmbedPage({ db, loading }: EmbedPageProps) {
  const [searchParams] = useSearchParams();
  const entryId = searchParams.get("id");
  const country = (searchParams.get("country") || "ALL").toUpperCase();
  const sector = (searchParams.get("sector") || "all") as "all" | SourceSector;
  const category = searchParams.get("category") || "all";
  const theme = searchParams.get("theme") === "dark" ? "dark" : "light";
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit")) || 5), 15);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const entries = useMemo(() => {
    const list = db?.entries ?? [];
    if (entryId) {
      return list.filter((e) => e.id === entryId);
    }
    return list
      .filter((entry) => {
        if (country !== "ALL" && entry.countryCode !== country) return false;
        if (category !== "all" && entry.category !== category) return false;
        if (sector !== "all" && getEntrySector(entry) !== sector) return false;
        return true;
      })
      .slice(0, limit);
  }, [db?.entries, entryId, country, sector, category, limit]);

  const isDark = theme === "dark";

  if (loading && !db) {
    return (
      <div className={`min-h-screen p-4 ${isDark ? "bg-[#18181B] text-[#F4F4F5]" : "bg-white text-[#37352F]"}`}>
        <div className="text-xs opacity-60">載入 Cables.gg 嵌入重點情報中...</div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen p-4 sm:p-5 ${
        isDark ? "bg-[#18181B] text-[#F4F4F5]" : "bg-[#FFFFFF] text-[#37352F]"
      }`}
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Embed Header */}
        <div
          className={`flex items-center justify-between gap-2 pb-3 border-b ${
            isDark ? "border-[#27272A]" : "border-[#E9E9E7]"
          }`}
        >
          <div className="text-xs font-semibold tracking-tight">
            Cables.gg 重點精選情報串流
          </div>
          <a
            href={`${origin}/blog`}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 text-[11px] hover:underline ${
              isDark ? "text-[#A1A1AA]" : "text-[#787774]"
            }`}
          >
            <span>查看完整 Blog</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {entries.length === 0 ? (
          <div className="py-8 text-center text-xs opacity-70">目前沒有符合嵌入條件的情報條目。</div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const digest = getCondensedDigest(entry);
              const entrySector = getEntrySector(entry);
              return (
                <article
                  key={entry.id}
                  className={`rounded-md border p-4 space-y-2.5 ${
                    isDark
                      ? "bg-[#202024] border-[#27272A]"
                      : "bg-[#FBFBFA] border-[#E9E9E7]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SectorTag sector={entrySector} />
                    <CountryTag countryCode={entry.countryCode} countryName={entry.countryName} />
                    <CategoryTag category={entry.category} />
                    <RiskTag level={entry.riskLevel} />
                    <span
                      className={`ml-auto font-mono text-[11px] tabular-nums ${
                        isDark ? "text-[#A1A1AA]" : "text-[#787774]"
                      }`}
                    >
                      {formatShortDate(entry.publishedAt)}
                    </span>
                  </div>

                  {entryId && (
                    <SafeBannerImage
                      src={entry.bannerImage}
                      alt={digest.headline}
                      category={entry.category}
                      wrapperClassName="w-full h-40 rounded-[4px] overflow-hidden border border-[#E9E9E7]"
                      className="w-full h-full object-cover"
                    />
                  )}

                  <a
                    href={`${origin}/blog/${entry.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-bold text-sm leading-snug hover:underline"
                  >
                    {digest.headline}
                  </a>

                  <p className={`text-xs leading-relaxed ${isDark ? "text-[#D4D4D8]" : "text-[#5A5852]"}`}>
                    {digest.lead}
                  </p>

                  <ul
                    className={`text-xs space-y-1 p-2.5 rounded-[4px] border ${
                      isDark
                        ? "bg-[#18181B] border-[#27272A]"
                        : "bg-white border-[#E9E9E7]"
                    }`}
                  >
                    {digest.keyPoints.slice(0, 2).map((pt, idx) => (
                      <li key={idx} className="leading-snug flex items-start gap-1.5">
                        <span className="font-mono opacity-60 tabular-nums">{idx + 1}.</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>

                  <div
                    className={`flex items-center justify-between gap-2 pt-1 text-[11px] ${
                      isDark ? "text-[#A1A1AA]" : "text-[#787774]"
                    }`}
                  >
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
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      來源原文 ↗
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
