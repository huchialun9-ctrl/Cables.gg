import type { CableCategory, CountryCode, RiskLevel, SourceSector } from "../types/cables";
import { COUNTRY_OPTIONS } from "../types/cables";

export function SectorTag({ sector }: { sector?: SourceSector }) {
  const isOfficial = sector === "official";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded-[3px] whitespace-nowrap shrink-0 ${
        isOfficial
          ? "bg-[#EBF2FA] text-[#2B4C7E]"
          : "bg-[#EFEFEE] text-[#5A5852]"
      }`}
    >
      {isOfficial ? "官方機構" : "民間社群"}
    </span>
  );
}

export function CategoryTag({ category }: { category: CableCategory }) {
  const styles: Record<CableCategory, string> = {
    國際焦點: "bg-[#E9F3EC] text-[#22643D]",
    財經科技: "bg-[#EBF2FA] text-[#2B4C7E]",
    資安公告: "bg-[#FBEAEA] text-[#9B2C2C]",
    自訂爬文: "bg-[#EFEFEE] text-[#37352F]",
    "API 變動": "bg-[#E6F3F7] text-[#1D5B79]",
    "Reddit 熱議": "bg-[#FAEBDD] text-[#8F4B14]",
    "GitHub 釋出": "bg-[#F3EDF8] text-[#5B3A7D]",
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded-[3px] whitespace-nowrap shrink-0 ${
        styles[category] ?? "bg-[#EFEFEE] text-[#37352F]"
      }`}
    >
      {category}
    </span>
  );
}

export function CountryTag({
  countryCode,
  countryName,
}: {
  countryCode?: CountryCode;
  countryName?: string;
}) {
  const code = countryCode || "GLOBAL";
  const label =
    countryName ||
    COUNTRY_OPTIONS.find((c) => c.code === code)?.name ||
    "全球跨國";

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded-[3px] bg-[#EFEFEE] text-[#37352F] whitespace-nowrap shrink-0">
      <span className="font-mono text-[10px] text-[#787774]">{code}</span>
      <span>{label}</span>
    </span>
  );
}

export function RiskTag({ level }: { level: RiskLevel }) {
  const config: Record<RiskLevel, { label: string; className: string }> = {
    high: {
      label: "頭條焦點",
      className: "bg-[#FBEAEA] text-[#8E352E]",
    },
    medium: {
      label: "重點報導",
      className: "bg-[#FBF3DB] text-[#8A5A00]",
    },
    low: {
      label: "一般快訊",
      className: "bg-[#E9F3EC] text-[#22643D]",
    },
  };

  const current = config[level];

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded-[3px] whitespace-nowrap shrink-0 ${current.className}`}
    >
      {current.label}
    </span>
  );
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
