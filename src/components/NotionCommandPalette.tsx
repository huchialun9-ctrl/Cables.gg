import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookmarkCheck,
  BookOpen,
  Compass,
  Database,
  FileText,
  Globe,
  LayoutDashboard,
  Search,
  Settings,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { COUNTRY_OPTIONS, type CableEntry } from "../types/cables";
import { formatShortDate } from "./NotionTags";
import { SafeSourceIcon } from "./SafeImage";

interface NotionCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  entries: CableEntry[];
  blogSlug: string;
}

interface PaletteItem {
  id: string;
  group: "pages" | "regions" | "entries" | "search";
  label: string;
  sublabel?: string;
  meta?: string;
  to: string;
  icon: "dashboard" | "database" | "bookmark" | "blog" | "profiles" | "workflow" | "settings" | "globe" | "entry" | "search";
  entry?: CableEntry;
}

export function NotionCommandPalette({
  open,
  onClose,
  entries,
  blogSlug,
}: NotionCommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(id);
  }, [open]);

  const workspacePages: PaletteItem[] = useMemo(
    () => [
      {
        id: "page-home",
        group: "pages",
        label: "總覽儀表板 · 世界新聞地圖",
        sublabel: "全球即時資訊與互動式國家地區篩選",
        to: "/",
        icon: "dashboard",
      },
      {
        id: "page-db",
        group: "pages",
        label: "跨國新聞與公開資訊資料庫",
        sublabel: "支援表格清單、圖卡畫廊與狀態看板檢視",
        to: "/database",
        icon: "database",
      },
      {
        id: "page-bookmarks",
        group: "pages",
        label: "個人知識庫（已收藏文章與畫重點）",
        sublabel: "查看已收藏文章與閱讀器劃線標記",
        to: "/database?bookmarked=1",
        icon: "bookmark",
      },
      {
        id: "page-my-blog",
        group: "pages",
        label: `我的專屬 Blog (/b/${blogSlug})`,
        sublabel: "查看發佈文章、主編動態牆與參考創作者",
        to: `/b/${blogSlug}`,
        icon: "blog",
      },
      {
        id: "page-blog-cfg",
        group: "pages",
        label: "Blog 設定與模板管理",
        sublabel: "自訂路由代稱、版型風格與 RSS / JSON Feed",
        to: "/blog",
        icon: "blog",
      },
      {
        id: "page-profiles",
        group: "pages",
        label: "真實開發者個人檔案與動態牆",
        sublabel: "瀏覽 GitHub / DEV.to 創作者近期收藏與標記",
        to: "/profiles",
        icon: "profiles",
      },
      {
        id: "page-automation",
        group: "pages",
        label: "自動化引進與 n8n 工作流",
        sublabel: "設定 Webhook 觸發與導出模板",
        to: "/automation",
        icon: "workflow",
      },
      {
        id: "page-settings",
        group: "pages",
        label: "資料串流、排班與爬文設定",
        sublabel: "管理 9 大國家資料來源與排班表",
        to: "/settings",
        icon: "settings",
      },
    ],
    [blogSlug]
  );

  const regionItems: PaletteItem[] = useMemo(
    () => [
      {
        id: "reg-apac",
        group: "regions",
        label: "亞太地區即時資訊",
        sublabel: "台灣、日本、韓國、新加坡、澳洲媒體與公告",
        to: "/database?region=%E4%BA%9E%E5%A4%AA",
        icon: "globe",
      },
      {
        id: "reg-na",
        group: "regions",
        label: "北美地區即時資訊",
        sublabel: "美國 mainstream 媒體與官方機構資訊",
        to: "/database?region=%E5%8C%97%E7%BE%8E",
        icon: "globe",
      },
      {
        id: "reg-eu",
        group: "regions",
        label: "歐洲地區即時資訊",
        sublabel: "英國、德國新聞媒體與資安公告",
        to: "/database?region=%E6%AD%90%E6%B4%B2",
        icon: "globe",
      },
      ...COUNTRY_OPTIONS.map((c) => ({
        id: `country-${c.code}`,
        group: "regions" as const,
        label: `${c.name} (${c.code}) 媒體與公開資料庫`,
        sublabel: `${c.region}地區即時來源索引`,
        to: `/database?country=${encodeURIComponent(c.code)}`,
        icon: "globe" as const,
      })),
    ],
    []
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const recentEntries: PaletteItem[] = entries.slice(0, 5).map((entry) => ({
        id: `entry-${entry.id}`,
        group: "entries",
        label: entry.title,
        sublabel: `${entry.countryName} · ${entry.sourceName}`,
        meta: formatShortDate(entry.publishedAt),
        to: `/post/${entry.id}`,
        icon: "entry",
        entry,
      }));
      return [...workspacePages, ...recentEntries];
    }

    const matchedPages = workspacePages.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        (p.sublabel || "").toLowerCase().includes(q)
    );
    const matchedRegions = regionItems
      .filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          (r.sublabel || "").toLowerCase().includes(q)
      )
      .slice(0, 4);

    const matchedEntries: PaletteItem[] = entries
      .filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.originalTitle || "").toLowerCase().includes(q) ||
          e.sourceName.toLowerCase().includes(q) ||
          e.countryName.toLowerCase().includes(q) ||
          e.countryCode.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 8)
      .map((entry) => ({
        id: `entry-${entry.id}`,
        group: "entries",
        label: entry.title,
        sublabel: `${entry.countryName} · ${entry.sourceName} · ${entry.category}`,
        meta: formatShortDate(entry.publishedAt),
        to: `/post/${entry.id}`,
        icon: "entry",
        entry,
      }));

    const searchRow: PaletteItem = {
      id: "full-search",
      group: "search",
      label: `在完整資料庫中搜尋「${query.trim()}」`,
      sublabel: "開啟資料庫並套用關鍵字篩選",
      to: `/database?q=${encodeURIComponent(query.trim())}`,
      icon: "search",
    };

    return [...matchedEntries, ...matchedPages, ...matchedRegions, searchRow];
  }, [query, entries, workspacePages, regionItems]);

  useEffect(() => {
    setActiveIndex((prev) => {
      if (results.length === 0) return 0;
      return Math.min(prev, results.length - 1);
    });
  }, [results.length]);

  const handleSelect = (item: PaletteItem) => {
    onClose();
    navigate(item.to);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        results.length > 0 ? (prev - 1 + results.length) % results.length : 0
      );
      return;
    }
    if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    }
  };

  if (!open) return null;

  const renderIcon = (item: PaletteItem) => {
    if (item.entry) {
      return (
        <SafeSourceIcon
          src={item.entry.sourceIcon}
          url={item.entry.url}
          category={item.entry.category}
          alt={item.entry.sourceName}
          className="w-4 h-4 shrink-0"
        />
      );
    }
    const cls = "w-4 h-4 text-[#787774] shrink-0";
    switch (item.icon) {
      case "dashboard":
        return <LayoutDashboard className={cls} />;
      case "database":
        return <Database className={cls} />;
      case "bookmark":
        return <BookmarkCheck className={cls} />;
      case "blog":
        return <BookOpen className={cls} />;
      case "profiles":
        return <Users className={cls} />;
      case "workflow":
        return <Workflow className={cls} />;
      case "settings":
        return <Settings className={cls} />;
      case "globe":
        return <Globe className={cls} />;
      case "search":
        return <Search className={cls} />;
      default:
        return <FileText className={cls} />;
    }
  };

  const groupLabel: Record<PaletteItem["group"], string> = {
    entries: query.trim() ? "符合文章與新聞索引" : "最新收錄文章",
    pages: "工作區頁面",
    regions: "國家與地區檢視",
    search: "全文檢索",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="快速搜尋與跳轉工作區"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-[#37352F]/25"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[600px] bg-white border border-[#E9E9E7] rounded-[8px] shadow-[0_14px_38px_rgba(55,53,47,0.16)] overflow-hidden flex flex-col"
      >
        {/* Top Search Bar */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E9E9E7]">
          <Search className="w-4 h-4 text-[#787774] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="搜尋文章標題、國家、來源媒體或跳轉工作區頁面..."
            className="flex-1 text-sm text-[#37352F] placeholder:text-[#9B9A97] bg-transparent focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 text-[#9B9A97] hover:text-[#37352F] rounded-[4px]"
              aria-label="清空搜尋"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-[#787774] bg-[#F7F6F3] border border-[#E9E9E7] rounded-[3px]">
            ESC
          </kbd>
        </div>

        {/* Result List */}
        <div className="max-h-[400px] overflow-y-auto py-2 px-1.5">
          {results.length === 0 ? (
            <div className="py-10 text-center space-y-1.5 text-xs text-[#787774]">
              <Compass className="w-5 h-5 mx-auto text-[#9B9A97]" />
              <p>找不到符合「{query}」的頁面或索引文章</p>
            </div>
          ) : (
            results.map((item, idx) => {
              const showHeader = idx === 0 || results[idx - 1].group !== item.group;
              const isSelected = idx === activeIndex;

              return (
                <div key={item.id}>
                  {showHeader && (
                    <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-[#9B9A97]">
                      {groupLabel[item.group]}
                    </div>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(item)}
                    className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-[4px] text-left transition-colors ${
                      isSelected ? "bg-[#F2F1EE]" : "hover:bg-[#F7F6F3]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {renderIcon(item)}
                      <div className="min-w-0">
                        <div className="text-sm text-[#37352F] font-medium truncate">
                          {item.label}
                        </div>
                        {item.sublabel && (
                          <div className="text-[11px] text-[#787774] truncate">
                            {item.sublabel}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[11px] text-[#9B9A97] font-mono tabular-nums">
                      {item.meta && <span>{item.meta}</span>}
                      {isSelected && <ArrowRight className="w-3.5 h-3.5 text-[#37352F]" />}
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Quiet Notion Footer Shortcut Hints */}
        <div className="px-4 py-2 bg-[#FBFBFA] border-t border-[#E9E9E7] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#9B9A97]">
          <div className="flex items-center gap-3">
            <span>↑↓ 切換項目</span>
            <span>↵ 前往開啟</span>
            <span>ESC 關閉</span>
          </div>
          <span className="font-mono tabular-nums">全站共 {entries.length} 筆索引</span>
        </div>
      </div>
    </div>
  );
}
