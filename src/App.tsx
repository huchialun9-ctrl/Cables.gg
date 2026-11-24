import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useBlogProfile, useDatabase, useSources } from "./hooks/useCablesData";
import { HomePage } from "./pages/HomePage";
import { DatabasePage } from "./pages/DatabasePage";
import { PostDetailPage } from "./pages/PostDetailPage";
import { SettingsPage } from "./pages/SettingsPage";
import { BlogPage } from "./pages/BlogPage";
import { AutomationPage } from "./pages/AutomationPage";
import { EmbedPage } from "./pages/EmbedPage";
import { CustomBlogPage } from "./pages/CustomBlogPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { DeveloperProfilePage } from "./pages/DeveloperProfilePage";

function AppShell() {
  const location = useLocation();
  const { data: db, loading: dbLoading, error: dbError, refetch: refetchDb } = useDatabase();
  const { data: sources, refetch: refetchSources } = useSources();
  const { data: blogProfile, refetch: refetchBlogProfile } = useBlogProfile();

  const refreshAll = async () => {
    await Promise.all([refetchDb(), refetchSources(), refetchBlogProfile()]);
  };

  if (location.pathname === "/embed") {
    return <EmbedPage db={db} loading={dbLoading} />;
  }

  const highRiskEntries = (db?.entries ?? []).filter((e) => e.riskLevel === "high");
  const activeSlug = blogProfile?.slug || "my-cables";

  const getBreadcrumb = () => {
    if (location.pathname === "/") return "總覽儀表板";
    if (location.pathname.startsWith("/database")) {
      return location.search.includes("bookmarked=1") ? "個人知識庫" : "資料庫清單";
    }
    if (location.pathname.startsWith("/post/")) return "文章深度閱讀器";
    if (location.pathname === "/b" || location.pathname.startsWith("/b/")) {
      return blogProfile?.blogTitle || "我的專屬 Blog";
    }
    if (location.pathname === "/profiles") return "真實創作者個人檔案";
    if (location.pathname.startsWith("/profiles/")) return "開發者個人檔案與動態牆";
    if (location.pathname === "/blog") return "Blog 設定與管理";
    if (location.pathname.startsWith("/blog/")) return "個人 Blog 文章";
    if (location.pathname.startsWith("/automation")) return "自動化引進與導入中心";
    if (location.pathname.startsWith("/settings")) return "資料串流與爬文設定";
    return "總覽儀表板";
  };

  return (
    <Layout
      breadcrumb={getBreadcrumb()}
      highRiskEntries={highRiskEntries}
      allEntries={db?.entries ?? []}
      blogSlug={activeSlug}
    >
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              db={db}
              sources={sources}
              loading={dbLoading}
              error={dbError}
              onRetry={refetchDb}
              onRefresh={refreshAll}
            />
          }
        />
        <Route
          path="/database"
          element={
            <DatabasePage
              db={db}
              loading={dbLoading}
              error={dbError}
              onRetry={refetchDb}
              onRefresh={refreshAll}
            />
          }
        />
        <Route
          path="/post/:id"
          element={<PostDetailPage onCommentAdded={refreshAll} />}
        />
        <Route
          path="/b"
          element={
            <CustomBlogPage
              db={db}
              blogProfile={blogProfile}
              loading={dbLoading}
              onRefreshAll={refreshAll}
            />
          }
        />
        <Route
          path="/b/:slug"
          element={
            <CustomBlogPage
              db={db}
              blogProfile={blogProfile}
              loading={dbLoading}
              onRefreshAll={refreshAll}
            />
          }
        />
        <Route
          path="/profiles"
          element={<ProfilesPage blogProfile={blogProfile} onRefreshAll={refreshAll} />}
        />
        <Route
          path="/profiles/:platform/:handle"
          element={<DeveloperProfilePage blogProfile={blogProfile} onRefreshAll={refreshAll} />}
        />
        <Route
          path="/blog"
          element={
            <BlogPage
              db={db}
              blogProfile={blogProfile}
              loading={dbLoading}
              onRefreshAll={refreshAll}
            />
          }
        />
        <Route
          path="/blog/:id"
          element={
            <BlogPage
              db={db}
              blogProfile={blogProfile}
              loading={dbLoading}
              onRefreshAll={refreshAll}
            />
          }
        />
        <Route
          path="/automation"
          element={
            <AutomationPage
              db={db}
              sources={sources}
              blogProfile={blogProfile}
              onRefreshAll={refreshAll}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <SettingsPage db={db} sources={sources} onRefreshAll={refreshAll} />
          }
        />
        <Route
          path="*"
          element={
            <HomePage
              db={db}
              sources={sources}
              loading={dbLoading}
              error={dbError}
              onRetry={refetchDb}
              onRefresh={refreshAll}
            />
          }
        />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
