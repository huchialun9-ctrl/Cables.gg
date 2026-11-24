import { useEffect, useState, type FormEvent } from "react";
import { Mail, Rss, Copy, Check, ExternalLink } from "lucide-react";
import { COUNTRY_OPTIONS, type CountryCode } from "../types/cables";

type SubscribeScope = "high_risk_only" | "all";

export function SubscribeModule() {
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState<SubscribeScope>("high_risk_only");
  const [rssCountry, setRssCountry] = useState<"ALL" | CountryCode>("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [totalSubscribers, setTotalSubscribers] = useState<number | null>(null);
  const [copiedFeed, setCopiedFeed] = useState<"high" | "all" | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/subscriptions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { totalSubscribers?: number } | null) => {
        if (active && typeof data?.totalSubscribers === "number") {
          setTotalSubscribers(data.totalSubscribers);
        }
      })
      .catch(() => {
        // Non-blocking metric fetch
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubscribe = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setSubmitError("請輸入 Email 電子郵件地址。");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, scope }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        alreadySubscribed?: boolean;
        email?: string;
        scope?: SubscribeScope;
        totalSubscribers?: number;
      };

      if (!res.ok) {
        throw new Error(body.error || "訂閱設定失敗");
      }

      if (typeof body.totalSubscribers === "number") {
        setTotalSubscribers(body.totalSubscribers);
      }

      const scopeLabel =
        body.scope === "all" ? "全部國家新聞與 Blog 精選" : "僅各國頭條與焦點新聞";
      setSuccessMessage(
        body.alreadySubscribed
          ? `已更新 ${body.email} 的訂閱偏好（${scopeLabel}）。`
          : `已成功訂閱 ${body.email}（${scopeLabel}推播通知）。`
      );
      setEmail("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "無法完成訂閱");
    } finally {
      setSubmitting(false);
    }
  };

  const getOrigin = () =>
    typeof window !== "undefined" ? window.location.origin : "https://cables.gg";

  const countrySuffix = rssCountry !== "ALL" ? `country=${rssCountry}` : "";
  const highPath = countrySuffix ? `/rss.xml?risk=high&${countrySuffix}` : "/rss.xml?risk=high";
  const allPath = countrySuffix ? `/rss.xml?${countrySuffix}` : "/rss.xml";

  const handleCopyRss = async (type: "high" | "all", path: string) => {
    const fullUrl = `${getOrigin()}${path}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedFeed(type);
      setTimeout(() => setCopiedFeed(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const selectedCountryName =
    rssCountry === "ALL"
      ? "全國家"
      : COUNTRY_OPTIONS.find((c) => c.code === rssCountry)?.name || rssCountry;

  const rssFeeds: Array<{
    key: "high" | "all";
    label: string;
    description: string;
    path: string;
  }> = [
    {
      key: "high",
      label: `${selectedCountryName}頭條焦點專用 Feed`,
      description: "精選各國主流頭條報導、重要政策與即時焦點發布",
      path: highPath,
    },
    {
      key: "all",
      label: `${selectedCountryName}全媒體整合 Feed`,
      description: "即時同步各國主流新聞媒體、官方資訊與 Blog 整理文章",
      path: allPath,
    },
  ];

  return (
    <section
      aria-label="訂閱各國新聞推播"
      className="bg-white border border-[#E9E9E7] rounded-md p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-[#37352F]">訂閱各國新聞推播與 Blog 更新</h2>
          <p className="text-xs text-[#787774]">
            輸入 Email 接收跨國媒體即時頭條與個人 Blog 精簡更新，或依國家複製動態 RSS Feed 連結。
          </p>
        </div>
        {totalSubscribers !== null && (
          <div className="text-xs font-mono text-[#787774] tabular-nums shrink-0">
            目前已有 {totalSubscribers} 位用戶訂閱
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 pt-4 border-t border-[#E9E9E7]">
        {/* Email Subscription Form */}
        <form onSubmit={handleSubscribe} className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#37352F]">
            <Mail className="w-3.5 h-3.5 text-[#787774]" />
            <span>Email 推播通知</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@company.com"
              aria-label="訂閱 Email 地址"
              className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] placeholder:text-[#9B9A97] focus:outline-none focus:border-[#37352F] transition-colors"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-50 active:scale-[0.99] transition-all duration-150 whitespace-nowrap shrink-0"
            >
              {submitting ? "送出中..." : "訂閱通知"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="text-xs text-[#787774]">通知範圍：</span>
            <button
              type="button"
              onClick={() => setScope("high_risk_only")}
              className={`px-2.5 py-1 text-xs rounded-[4px] border transition-colors whitespace-nowrap ${
                scope === "high_risk_only"
                  ? "bg-[#EFEFEE] border-[#D3D1CB] text-[#37352F] font-medium"
                  : "bg-white border-[#E9E9E7] text-[#5A5852] hover:bg-[#EFEFEE]"
              }`}
            >
              僅各國頭條與焦點新聞
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`px-2.5 py-1 text-xs rounded-[4px] border transition-colors whitespace-nowrap ${
                scope === "all"
                  ? "bg-[#EFEFEE] border-[#D3D1CB] text-[#37352F] font-medium"
                  : "bg-white border-[#E9E9E7] text-[#5A5852] hover:bg-[#EFEFEE]"
              }`}
            >
              全部國家新聞與 Blog 精選
            </button>
          </div>

          {submitError && (
            <p className="text-xs text-[#9B2C2C] bg-[#FDF6F6] border border-[#F5C2C2] rounded-[4px] px-3 py-2">
              {submitError}
            </p>
          )}
          {successMessage && (
            <p className="text-xs text-[#22643D] bg-[#EDF5F0] border border-[#C7E0D0] rounded-[4px] px-3 py-2">
              {successMessage}
            </p>
          )}
        </form>

        {/* RSS Feed Links */}
        <div className="space-y-3 lg:border-l lg:border-[#E9E9E7] lg:pl-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#37352F]">
              <Rss className="w-3.5 h-3.5 text-[#8F4B14]" />
              <span>RSS Feed 即時推播連結</span>
            </div>

            <select
              value={rssCountry}
              onChange={(e) => setRssCountry(e.target.value as "ALL" | CountryCode)}
              aria-label="選擇 RSS 國家篩選"
              className="px-2 py-1 text-xs bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] focus:outline-none focus:border-[#37352F]"
            >
              <option value="ALL">全部國家 Feed</option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="divide-y divide-[#E9E9E7] border border-[#E9E9E7] rounded-[4px] bg-[#FBFBFA]">
            {rssFeeds.map((feed) => (
              <div
                key={feed.key}
                className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#37352F]">{feed.label}</div>
                  <div className="text-[11px] text-[#787774] truncate">{feed.description}</div>
                  <div className="mt-0.5 text-[11px] font-mono text-[#9B9A97] truncate">
                    {feed.path}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyRss(feed.key, feed.path)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white text-[#37352F] border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE] active:scale-[0.99] transition-all duration-150 whitespace-nowrap"
                  >
                    {copiedFeed === feed.key ? (
                      <>
                        <Check className="w-3 h-3 text-[#22643D]" />
                        <span>已複製</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>複製連結</span>
                      </>
                    )}
                  </button>
                  <a
                    href={feed.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white text-[#5A5852] border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE] hover:text-[#37352F] transition-colors whitespace-nowrap"
                    aria-label={`開啟 ${feed.label}`}
                  >
                    <span>XML</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
