import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Settings,
  Cable,
  Menu,
  X,
  ArrowUpRight,
  Newspaper,
  Search,
  BookOpen,
  Workflow,
  MapPin,
  BookmarkCheck,
  Users,
  Globe,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { CableCategory, CableEntry } from "../types/cables";
import { CategoryTag } from "./NotionTags";
import { SafeSourceIcon } from "./SafeImage";
import { NotionCommandPalette } from "./NotionCommandPalette";

interface LayoutProps {
  children: ReactNode;
  breadcrumb: string;
  highRiskEntries?: CableEntry[];
  allEntries?: CableEntry[];
  blogSlug?: string;
}

export function Layout({
  children,
  breadcrumb,
  highRiskEntries = [],
  allEntries = [],
  blogSlug = "my-cables",
}: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navGroups = [
    {
      key: "core",
      title: "核心瀏覽與知識庫",
      items: [
        { path: "/", label: "總覽儀表板", icon: LayoutDashboard },
        { path: "/database", label: "資料庫清單", icon: Database },
        { path: "/database?bookmarked=1", label: "個人知識庫", icon: BookmarkCheck },
      ],
    },
    {
      key: "automation",
      title: "自動化引進與導入",
      items: [
        { path: "/automation", label: "自動化引進與導入", icon: Workflow },
        { path: "/settings", label: "資料串流與爬文設定", icon: Settings },
      ],
    },
    {
      key: "blog",
      title: "個人 Blog 與檔案",
      items: [
        { path: `/b/${blogSlug}`, label: `我的專屬 Blog (/b/${blogSlug})`, icon: Globe },
        { path: "/blog", label: "Blog 設定與排版管理", icon: BookOpen },
        { path: "/profiles", label: "真實作者個人檔案", icon: Users },
      ],
    },
  ];

  const categoryShortcuts: Array<{ label: CableCategory }> = [
    { label: "國際焦點" },
    { label: "財經科技" },
    { label: "資安公告" },
    { label: "自訂爬文" },
    { label: "API 變動" },
    { label: "GitHub 釋出" },
    { label: "Reddit 熱議" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/database?bookmarked=1") {
      return location.pathname === "/database" && location.search.includes("bookmarked=1");
    }
    if (path === "/database") {
      return location.pathname === "/database" && !location.search.includes("bookmarked=1");
    }
    if (path.startsWith("/b/")) {
      return location.pathname === "/b" || location.pathname.startsWith("/b/");
    }
    return location.pathname.startsWith(path);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#F7F6F3] text-[#37352F] select-none">
      {/* Brand Workspace Switcher Header */}
      <div className="h-12 px-3 flex items-center justify-between border-b border-[#E9E9E7]">
        <Link
          to="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2 px-1.5 py-1 rounded-[4px] text-[#37352F] font-semibold text-sm tracking-tight hover:bg-[#EFEFEE] transition-colors whitespace-nowrap shrink-0"
        >
          <span className="w-5 h-5 rounded-[4px] bg-[#37352F] text-white flex items-center justify-center">
            <Cable className="w-3 h-3" />
          </span>
          <span>Cables.gg</span>
          <span className="text-[10px] font-normal text-[#787774] px-1 py-0.5 rounded-[3px] bg-[#EFEFEE]">
            Workspace
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-[4px] text-[#787774] hover:bg-[#EFEFEE] hover:text-[#37352F]"
          aria-label="關閉選單"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Workspace Navigation */}
      <div className="px-2 py-3 space-y-4 flex-1 overflow-y-auto">
        {/* Notion Quick Find (Cmd+K / Ctrl+K) Trigger */}
        <button
          type="button"
          onClick={() => {
            setCmdOpen(true);
            setMobileOpen(false);
          }}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs bg-white border border-[#E9E9E7] rounded-[4px] text-[#787774] hover:bg-[#EFEFEE] hover:text-[#37352F] transition-colors"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 shrink-0 text-[#9B9A97]" />
            <span className="truncate">快速搜尋與跳轉...</span>
          </span>
          <kbd className="text-[10px] font-mono px-1 py-0.5 bg-[#F7F6F3] border border-[#E9E9E7] rounded-[3px] text-[#9B9A97] shrink-0">
            ⌘K
          </kbd>
        </button>

        {navGroups.map((group) => {
          const isCollapsed = Boolean(collapsedGroups[group.key]);
          return (
            <div key={group.key}>
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center gap-1 px-1.5 py-1 mb-0.5 rounded-[4px] text-[11px] font-medium text-[#787774] hover:bg-[#EFEFEE] hover:text-[#37352F] transition-colors text-left"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 shrink-0 text-[#9B9A97]" />
                ) : (
                  <ChevronDown className="w-3 h-3 shrink-0 text-[#9B9A97]" />
                )}
                <span className="truncate">{group.title}</span>
              </button>
              {!isCollapsed && (
                <nav className="space-y-0.5" aria-label={group.title}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] text-[13px] transition-colors duration-150 whitespace-nowrap ${
                          active
                            ? "bg-[#EFEFEE] text-[#37352F] font-medium"
                            : "text-[#5A5852] hover:bg-[#EFEFEE] hover:text-[#37352F]"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0 text-[#787774]" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>
          );
        })}

        {/* Category Quick Filters (Collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => toggleGroup("categories")}
            className="w-full flex items-center gap-1 px-1.5 py-1 mb-0.5 rounded-[4px] text-[11px] font-medium text-[#787774] hover:bg-[#EFEFEE] hover:text-[#37352F] transition-colors text-left"
          >
            {collapsedGroups.categories ? (
              <ChevronRight className="w-3 h-3 shrink-0 text-[#9B9A97]" />
            ) : (
              <ChevronDown className="w-3 h-3 shrink-0 text-[#9B9A97]" />
            )}
            <span>分類索引檢視</span>
          </button>
          {!collapsedGroups.categories && (
            <div className="space-y-0.5">
              {categoryShortcuts.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    navigate(`/database?category=${encodeURIComponent(item.label)}`);
                    setMobileOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1 rounded-[4px] text-left hover:bg-[#EFEFEE] transition-colors duration-150 active:scale-[0.99]"
                >
                  <CategoryTag category={item.label} />
                  <ArrowUpRight className="w-3 h-3 text-[#9B9A97]" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Headline News Quick Access */}
        {highRiskEntries.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => toggleGroup("headlines")}
              className="w-full flex items-center gap-1 px-1.5 py-1 mb-0.5 rounded-[4px] text-[11px] font-medium text-[#787774] hover:bg-[#EFEFEE] hover:text-[#37352F] transition-colors text-left"
            >
              {collapsedGroups.headlines ? (
                <ChevronRight className="w-3 h-3 shrink-0 text-[#9B9A97]" />
              ) : (
                <ChevronDown className="w-3 h-3 shrink-0 text-[#9B9A97]" />
              )}
              <Newspaper className="w-3 h-3 text-[#787774]" />
              <span>即時頭條精選</span>
            </button>
            {!collapsedGroups.headlines && (
              <div className="space-y-0.5">
                {highRiskEntries.slice(0, 3).map((entry) => (
                  <Link
                    key={entry.id}
                    to={`/post/${entry.id}`}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-2 py-1.5 rounded-[4px] text-xs leading-snug transition-colors duration-150 ${
                      location.pathname === `/post/${entry.id}`
                        ? "bg-[#EFEFEE] text-[#37352F] font-medium"
                        : "text-[#5A5852] hover:bg-[#EFEFEE] hover:text-[#37352F]"
                    }`}
                  >
                    <div className="line-clamp-2">{entry.title}</div>
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-[#9B9A97] truncate">
                      <SafeSourceIcon
                        src={entry.sourceIcon}
                        url={entry.url}
                        category={entry.category}
                        alt={entry.sourceName}
                        className="w-3.5 h-3.5"
                      />
                      <span className="truncate">
                        {entry.countryName} · {entry.sourceName}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quiet Pipeline Footer */}
      <div className="px-3 py-3 border-t border-[#E9E9E7] space-y-2 text-xs text-[#787774]">
        <button
          type="button"
          onClick={() => {
            navigate("/?setup=1");
            setMobileOpen(false);
          }}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] transition-colors"
        >
          <MapPin className="w-3.5 h-3.5 text-[#22643D]" />
          <span>國家定位與資源精靈</span>
        </button>
        <div className="px-1">
          <div className="font-medium text-[#37352F]">跨國新聞媒體整合平台</div>
          <div className="mt-0.5 text-[11px]">多國翻譯 · n8n · Blog RSS</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#FBFBFA] text-[#37352F]">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:block w-[248px] shrink-0 border-r border-[#E9E9E7] sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#37352F]/25"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-[264px] max-w-[85vw] h-full border-r border-[#E9E9E7] z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="h-12 border-b border-[#E9E9E7] bg-white/95 backdrop-blur-xs sticky top-0 z-30 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 rounded-[4px] text-[#5A5852] hover:bg-[#EFEFEE] hover:text-[#37352F]"
              aria-label="開啟側邊欄"
            >
              <Menu className="w-4 h-4" />
            </button>
            <nav aria-label="麵包屑" className="flex items-center gap-2 text-sm min-w-0">
              <Link
                to="/"
                className="text-[#787774] hover:text-[#37352F] transition-colors whitespace-nowrap shrink-0"
              >
                Cables.gg
              </Link>
              <span className="text-[#D3D1CB]" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-[#37352F] truncate">{breadcrumb}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#787774] bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE] hover:text-[#37352F] transition-colors whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span>快速搜尋</span>
              <kbd className="text-[10px] font-mono text-[#9B9A97]">⌘K</kbd>
            </button>
            {location.pathname === "/database" ? (
              <Link
                to="/settings#ingest"
                className="px-3 py-1.5 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] active:scale-[0.99] transition-all duration-150 whitespace-nowrap shrink-0"
              >
                自訂網址爬文
              </Link>
            ) : (
              <Link
                to="/database"
                className="px-3 py-1.5 text-xs font-medium bg-white text-[#37352F] border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE] active:scale-[0.99] transition-all duration-150 whitespace-nowrap shrink-0"
              >
                瀏覽完整資料庫
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
          {children}
        </main>
      </div>

      {/* Notion Quick Find Command Palette */}
      <NotionCommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        entries={allEntries}
        blogSlug={blogSlug}
      />
    </div>
  );
}
