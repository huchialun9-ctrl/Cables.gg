import { useEffect, useState } from "react";
import type { CableCategory } from "../types/cables";

interface SafeBannerImageProps {
  src?: string;
  alt: string;
  category?: CableCategory;
  wrapperClassName?: string;
  className?: string;
}

export function SafeBannerImage({
  src,
  alt,
  wrapperClassName = "",
  className = "",
}: SafeBannerImageProps) {
  const trimmed = src?.trim() || "";
  const isLocalFakeAsset = trimmed.startsWith("/src/assets/images/banner_");
  const validInitial = trimmed && !isLocalFakeAsset ? trimmed : "";
  const [failed, setFailed] = useState(!validInitial);

  useEffect(() => {
    setFailed(!validInitial);
  }, [validInitial]);

  if (!validInitial || failed) {
    return null;
  }

  return (
    <div className={wrapperClassName}>
      <img
        src={validInitial}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        className={className}
      />
    </div>
  );
}

type OriginBrand = "github" | "reddit" | "hackernews" | "cisa" | "cloudflare" | "generic";

function getHostname(rawUrl?: string): string {
  if (!rawUrl) return "";
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function detectOriginInfo(
  src?: string,
  alt?: string,
  url?: string,
  category?: CableCategory
): { brand: OriginBrand; faviconUrl: string; domainLabel: string } {
  const host = getHostname(url);
  const altLower = (alt || "").toLowerCase();
  const srcLower = (src || "").toLowerCase();

  // GitHub official mark (releases, github.blog, or GitHub repos)
  if (
    host === "github.com" ||
    host === "api.github.com" ||
    host === "github.blog" ||
    srcLower.includes("avatars.githubusercontent.com") ||
    altLower.includes("github") ||
    category === "GitHub 釋出"
  ) {
    return {
      brand: "github",
      faviconUrl: "https://www.google.com/s2/favicons?domain=github.com&sz=64",
      domainLabel: host || "github.com",
    };
  }

  // Reddit official mark
  if (host.includes("reddit.com") || host === "redd.it" || srcLower.includes("reddit.com")) {
    return {
      brand: "reddit",
      faviconUrl: "https://www.google.com/s2/favicons?domain=reddit.com&sz=64",
      domainLabel: host || "reddit.com",
    };
  }

  // Hacker News
  if (host === "news.ycombinator.com" || host === "hnrss.org") {
    return {
      brand: "hackernews",
      faviconUrl: "https://www.google.com/s2/favicons?domain=news.ycombinator.com&sz=64",
      domainLabel: "news.ycombinator.com",
    };
  }

  // CISA KEV / NVD Security
  if (host.includes("cisa.gov") || host === "nvd.nist.gov" || altLower.includes("cisa")) {
    return {
      brand: "cisa",
      faviconUrl: "https://www.google.com/s2/favicons?domain=cisa.gov&sz=64",
      domainLabel: "cisa.gov",
    };
  }

  // Cloudflare
  if (host.includes("cloudflare.com") || altLower.includes("cloudflare")) {
    return {
      brand: "cloudflare",
      faviconUrl: "https://www.google.com/s2/favicons?domain=cloudflare.com&sz=64",
      domainLabel: host || "cloudflare.com",
    };
  }

  const resolvedUrl =
    src && src.trim()
      ? src.trim()
      : host
        ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
        : "";

  return {
    brand: altLower.includes("reddit") && !host ? "reddit" : "generic",
    faviconUrl: resolvedUrl,
    domainLabel: host || alt || "source",
  };
}

function BrandFallbackGlyph({ brand, alt }: { brand: OriginBrand; alt: string }) {
  if (brand === "github") {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#24292F]" aria-hidden="true">
        <path d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12c0 4.64 3.01 8.57 7.18 9.96.52.1.72-.23.72-.5v-1.78c-2.92.63-3.54-1.41-3.54-1.41-.48-1.21-1.17-1.53-1.17-1.53-.96-.65.07-.64.07-.64 1.06.07 1.62 1.09 1.62 1.09.94 1.61 2.47 1.15 3.07.88.1-.68.37-1.15.67-1.41-2.33-.27-4.78-1.17-4.78-5.19 0-1.15.41-2.09 1.08-2.82-.11-.27-.47-1.34.1-2.79 0 0 .88-.28 2.89 1.08a10.03 10.03 0 0 1 5.26 0c2.01-1.36 2.89-1.08 2.89-1.08.57 1.45.21 2.52.1 2.79.67.73 1.08 1.67 1.08 2.82 0 4.03-2.46 4.92-4.8 5.18.38.33.72.97.72 1.96v2.9c0 .28.19.61.73.5A10.51 10.51 0 0 0 22.5 12c0-5.8-4.7-10.5-10.5-10.5Z" />
      </svg>
    );
  }

  if (brand === "reddit") {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10.5" fill="#FF4500" />
        <path
          fill="#FFFFFF"
          d="M18.2 12.2a1.4 1.4 0 0 0-2.4-.97 6.8 6.8 0 0 0-3.55-1.11l.61-2.87 1.99.42a1 1 0 1 0 .22-.99l-2.38-.5a.5.5 0 0 0-.59.38l-.68 3.2a6.85 6.85 0 0 0-3.61 1.11 1.4 1.4 0 1 0-1.56 2.29 2.6 2.6 0 0 0-.04.44c0 2.26 2.63 4.09 5.88 4.09s5.88-1.83 5.88-4.09c0-.15-.02-.3-.04-.44a1.4 1.4 0 0 0 .27-.96ZM9.5 13.3a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm5.55 2.64c-.69.69-2.01.74-3.05.74s-2.36-.05-3.05-.74a.36.36 0 0 1 .51-.51c.43.43 1.35.58 2.54.58s2.11-.15 2.54-.58a.36.36 0 1 1 .51.51Zm-.18-1.64a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
        />
      </svg>
    );
  }

  if (brand === "hackernews") {
    return (
      <span className="w-full h-full bg-[#FF6600] text-white text-[10px] font-bold font-mono flex items-center justify-center">
        Y
      </span>
    );
  }

  if (brand === "cisa") {
    return (
      <span className="w-full h-full bg-[#1B365D] text-white text-[9px] font-bold font-mono flex items-center justify-center">
        CS
      </span>
    );
  }

  if (brand === "cloudflare") {
    return (
      <span className="w-full h-full bg-[#F38020] text-white text-[9px] font-bold font-mono flex items-center justify-center">
        CF
      </span>
    );
  }

  return (
    <span className="text-[10px] font-mono font-semibold text-[#5A5852]">
      {alt.slice(0, 1).toUpperCase()}
    </span>
  );
}

interface SafeSourceIconProps {
  src?: string;
  alt: string;
  url?: string;
  category?: CableCategory;
  className?: string;
}

export function SafeSourceIcon({
  src,
  alt,
  url,
  category,
  className = "w-[18px] h-[18px]",
}: SafeSourceIconProps) {
  const { brand, faviconUrl, domainLabel } = detectOriginInfo(src, alt, url, category);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [faviconUrl]);

  if (!faviconUrl || failed) {
    return (
      <span
        title={`${alt} (${domainLabel})`}
        aria-label={`${alt} 來源圖示`}
        className={`inline-flex items-center justify-center rounded-[4px] bg-[#F7F6F3] border border-[#E9E9E7] overflow-hidden shrink-0 ${className}`}
      >
        <BrandFallbackGlyph brand={brand} alt={alt} />
      </span>
    );
  }

  return (
    <span
      title={`${alt} (${domainLabel})`}
      className={`inline-flex items-center justify-center rounded-[4px] bg-white border border-[#E9E9E7] p-[1.5px] overflow-hidden shrink-0 ${className}`}
    >
      <img
        src={faviconUrl}
        alt={`${alt} favicon`}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-contain rounded-[2px]"
      />
    </span>
  );
}
