import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import { ArrowRight, Globe, MapPin, RotateCcw } from "lucide-react";
import {
  COUNTRY_OPTIONS,
  type CableEntry,
  type CountryCode,
  type RegionScope,
} from "../types/cables";
import { RiskTag, SectorTag, formatShortDate } from "./NotionTags";
import { SafeSourceIcon } from "./SafeImage";
import { getEntrySector } from "../utils/blogTemplates";

export type MapRegionFilter = "ALL" | "亞太" | "北美" | "歐洲" | "全球";

interface InteractiveWorldMapProps {
  allEntries: CableEntry[];
  filteredEntries: CableEntry[];
  selectedCountry: "ALL" | "MY_PREFS" | CountryCode;
  selectedRegion: MapRegionFilter;
  onSelectCountry: (country: "ALL" | CountryCode) => void;
  onSelectRegion: (region: MapRegionFilter) => void;
}

interface CountryMarkerMeta {
  code: Exclude<CountryCode, "GLOBAL">;
  name: string;
  isoId: string;
  region: Exclude<RegionScope, "全球" | "台灣">;
  coordinates: [number, number]; // [longitude, latitude]
  labelOffset: [number, number];
  labelAnchor: "start" | "end" | "middle";
}

const TRACKED_COUNTRIES: CountryMarkerMeta[] = [
  {
    code: "US",
    name: "美國",
    isoId: "840",
    region: "北美",
    coordinates: [-98.5795, 39.8283],
    labelOffset: [0, -11],
    labelAnchor: "middle",
  },
  {
    code: "GB",
    name: "英國",
    isoId: "826",
    region: "歐洲",
    coordinates: [-2.5, 54.0],
    labelOffset: [-10, -6],
    labelAnchor: "end",
  },
  {
    code: "DE",
    name: "德國",
    isoId: "276",
    region: "歐洲",
    coordinates: [10.4515, 51.1657],
    labelOffset: [10, -4],
    labelAnchor: "start",
  },
  {
    code: "TW",
    name: "台灣",
    isoId: "158",
    region: "亞太",
    coordinates: [120.9605, 23.6978],
    labelOffset: [-9, 4],
    labelAnchor: "end",
  },
  {
    code: "JP",
    name: "日本",
    isoId: "392",
    region: "亞太",
    coordinates: [138.2529, 36.2048],
    labelOffset: [10, 2],
    labelAnchor: "start",
  },
  {
    code: "KR",
    name: "韓國",
    isoId: "410",
    region: "亞太",
    coordinates: [127.7669, 35.9078],
    labelOffset: [-8, -9],
    labelAnchor: "end",
  },
  {
    code: "SG",
    name: "新加坡",
    isoId: "702",
    region: "亞太",
    coordinates: [103.8198, 1.3521],
    labelOffset: [-9, 12],
    labelAnchor: "end",
  },
  {
    code: "AU",
    name: "澳洲",
    isoId: "036",
    region: "亞太",
    coordinates: [133.7751, -25.2744],
    labelOffset: [0, -11],
    labelAnchor: "middle",
  },
];

const ISO_TO_TRACKED_COUNTRY: Record<string, Exclude<CountryCode, "GLOBAL">> = {
  "158": "TW",
  "840": "US",
  "826": "GB",
  "392": "JP",
  "276": "DE",
  "410": "KR",
  "702": "SG",
  "036": "AU",
};

// Broader regional ISO-3166-1 numeric mapping so clicking neighboring countries filters their region
const ISO_TO_MACRO_REGION: Record<string, Exclude<MapRegionFilter, "ALL">> = {
  // 北美
  "124": "北美", // Canada
  "484": "北美", // Mexico
  "304": "北美", // Greenland
  // 歐洲
  "250": "歐洲", // France
  "380": "歐洲", // Italy
  "724": "歐洲", // Spain
  "620": "歐洲", // Portugal
  "528": "歐洲", // Netherlands
  "056": "歐洲", // Belgium
  "756": "歐洲", // Switzerland
  "040": "歐洲", // Austria
  "752": "歐洲", // Sweden
  "578": "歐洲", // Norway
  "246": "歐洲", // Finland
  "208": "歐洲", // Denmark
  "372": "歐洲", // Ireland
  "616": "歐洲", // Poland
  "203": "歐洲", // Czechia
  "804": "歐洲", // Ukraine
  "300": "歐洲", // Greece
  "642": "歐洲", // Romania
  "348": "歐洲", // Hungary
  "703": "歐洲", // Slovakia
  "100": "歐洲", // Bulgaria
  "191": "歐洲", // Croatia
  // 亞太
  "156": "亞太", // China
  "356": "亞太", // India
  "360": "亞太", // Indonesia
  "458": "亞太", // Malaysia
  "764": "亞太", // Thailand
  "704": "亞太", // Vietnam
  "608": "亞太", // Philippines
  "554": "亞太", // New Zealand
  "116": "亞太", // Cambodia
  "418": "亞太", // Laos
  "104": "亞太", // Myanmar
  "586": "亞太", // Pakistan
  "050": "亞太", // Bangladesh
  "144": "亞太", // Sri Lanka
  "496": "亞太", // Mongolia
};

const REGION_TABS: Array<{ id: MapRegionFilter; label: string }> = [
  { id: "ALL", label: "全球全覽" },
  { id: "亞太", label: "亞太地區" },
  { id: "北美", label: "北美地區" },
  { id: "歐洲", label: "歐洲地區" },
  { id: "全球", label: "跨國全球流" },
];

const REGION_VIEWBOX: Record<MapRegionFilter, string> = {
  ALL: "0 0 920 440",
  亞太: "470 110 420 285",
  北美: "65 35 340 235",
  歐洲: "375 30 235 160",
  全球: "0 0 920 440",
};

interface HoverInfo {
  title: string;
  subtitle: string;
  count: number;
  highRisk: number;
}

export function InteractiveWorldMap({
  allEntries,
  filteredEntries,
  selectedCountry,
  selectedRegion,
  onSelectCountry,
  onSelectRegion,
}: InteractiveWorldMapProps) {
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [hoveredTargetKey, setHoveredTargetKey] = useState<string | null>(null);
  const [zoomToRegion, setZoomToRegion] = useState<boolean>(false);

  const mapData = useMemo(() => {
    const topology = worldAtlas as unknown as Topology<{
      countries: GeometryCollection<{ name?: string }>;
    }>;
    const countriesGeo = feature(topology, topology.objects.countries);
    const filteredFeatures = countriesGeo.features.filter((f) => String(f.id) !== "010");

    const projection = geoNaturalEarth1().fitExtent(
      [
        [14, 14],
        [906, 426],
      ],
      {
        type: "FeatureCollection",
        features: filteredFeatures,
      }
    );

    const pathGenerator = geoPath(projection);
    const graticulePath = pathGenerator(geoGraticule10()) || "";

    const polygons = filteredFeatures.map((feat) => {
      const isoId = String(feat.id || "").padStart(3, "0");
      const name = String(feat.properties?.name || "");
      const d = pathGenerator(feat) || "";
      return {
        isoId,
        name,
        d,
        trackedCode: ISO_TO_TRACKED_COUNTRY[isoId] || null,
        macroRegion:
          ISO_TO_TRACKED_COUNTRY[isoId]
            ? TRACKED_COUNTRIES.find((c) => c.code === ISO_TO_TRACKED_COUNTRY[isoId])?.region || null
            : ISO_TO_MACRO_REGION[isoId] || null,
      };
    });

    const markers = TRACKED_COUNTRIES.map((meta) => {
      const projected = projection(meta.coordinates) || [0, 0];
      return {
        ...meta,
        x: projected[0],
        y: projected[1],
      };
    });

    return { graticulePath, polygons, markers };
  }, []);

  const statsByCountry = useMemo(() => {
    const map: Record<
      string,
      { total: number; official: number; community: number; highRisk: number }
    > = {};
    for (const c of COUNTRY_OPTIONS) {
      map[c.code] = { total: 0, official: 0, community: 0, highRisk: 0 };
    }
    for (const entry of allEntries) {
      const bucket = map[entry.countryCode] || {
        total: 0,
        official: 0,
        community: 0,
        highRisk: 0,
      };
      bucket.total += 1;
      if (getEntrySector(entry) === "official") bucket.official += 1;
      else bucket.community += 1;
      if (entry.riskLevel === "high") bucket.highRisk += 1;
      map[entry.countryCode] = bucket;
    }
    return map;
  }, [allEntries]);

  const statsByRegion = useMemo(() => {
    const map: Record<
      MapRegionFilter,
      { total: number; official: number; community: number; highRisk: number }
    > = {
      ALL: { total: 0, official: 0, community: 0, highRisk: 0 },
      亞太: { total: 0, official: 0, community: 0, highRisk: 0 },
      北美: { total: 0, official: 0, community: 0, highRisk: 0 },
      歐洲: { total: 0, official: 0, community: 0, highRisk: 0 },
      全球: { total: 0, official: 0, community: 0, highRisk: 0 },
    };

    for (const entry of allEntries) {
      const regKey: MapRegionFilter =
        entry.region === "台灣"
          ? "亞太"
          : entry.region === "亞太" || entry.region === "北美" || entry.region === "歐洲"
            ? entry.region
            : "全球";
      const isOfficial = getEntrySector(entry) === "official";
      const isHigh = entry.riskLevel === "high";

      map.ALL.total += 1;
      if (isOfficial) map.ALL.official += 1;
      else map.ALL.community += 1;
      if (isHigh) map.ALL.highRisk += 1;

      map[regKey].total += 1;
      if (isOfficial) map[regKey].official += 1;
      else map[regKey].community += 1;
      if (isHigh) map[regKey].highRisk += 1;
    }
    return map;
  }, [allEntries]);

  const activeRegionForHighlight: MapRegionFilter = useMemo(() => {
    if (selectedRegion !== "ALL") return selectedRegion;
    if (selectedCountry !== "ALL" && selectedCountry !== "MY_PREFS") {
      if (selectedCountry === "GLOBAL") return "全球";
      const found = TRACKED_COUNTRIES.find((c) => c.code === selectedCountry);
      return found?.region || "ALL";
    }
    return "ALL";
  }, [selectedCountry, selectedRegion]);

  const currentViewBox = useMemo(() => {
    if (!zoomToRegion) return REGION_VIEWBOX.ALL;
    return REGION_VIEWBOX[activeRegionForHighlight] || REGION_VIEWBOX.ALL;
  }, [zoomToRegion, activeRegionForHighlight]);

  const handlePolygonOrMarkerClick = (
    trackedCode: Exclude<CountryCode, "GLOBAL"> | null,
    macroRegion: Exclude<MapRegionFilter, "ALL"> | null
  ) => {
    if (trackedCode) {
      if (selectedCountry === trackedCode && selectedRegion === "ALL") {
        onSelectCountry("ALL");
      } else {
        onSelectRegion("ALL");
        onSelectCountry(trackedCode);
      }
      return;
    }

    if (macroRegion) {
      if (selectedRegion === macroRegion && selectedCountry === "ALL") {
        onSelectRegion("ALL");
      } else {
        onSelectCountry("ALL");
        onSelectRegion(macroRegion);
      }
      return;
    }

    onSelectCountry("GLOBAL");
  };

  const handleRegionTabClick = (regionId: MapRegionFilter) => {
    onSelectCountry("ALL");
    onSelectRegion(regionId);
    if (regionId === "ALL" || regionId === "全球") {
      setZoomToRegion(false);
    }
  };

  const activeSelectionTitle = useMemo(() => {
    if (selectedRegion !== "ALL") {
      const label = REGION_TABS.find((t) => t.id === selectedRegion)?.label || selectedRegion;
      return `${label}即時新聞與資訊流`;
    }
    if (selectedCountry === "ALL") return "全球各國即時新聞與公開資訊流";
    if (selectedCountry === "MY_PREFS") return "我的關注國家精選資訊流";
    const cName =
      COUNTRY_OPTIONS.find((c) => c.code === selectedCountry)?.name ?? selectedCountry;
    return `${cName}（${selectedCountry}）即時資訊流`;
  }, [selectedCountry, selectedRegion]);

  const previewEntries = useMemo(() => {
    return [...filteredEntries]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 5);
  }, [filteredEntries]);

  const inspectorMetrics = useMemo(() => {
    let official = 0;
    let community = 0;
    let highRisk = 0;
    for (const e of filteredEntries) {
      if (getEntrySector(e) === "official") official += 1;
      else community += 1;
      if (e.riskLevel === "high") highRisk += 1;
    }
    return {
      total: filteredEntries.length,
      official,
      community,
      highRisk,
    };
  }, [filteredEntries]);

  const databaseLink = useMemo(() => {
    if (selectedCountry !== "ALL" && selectedCountry !== "MY_PREFS") {
      return `/database?country=${selectedCountry}`;
    }
    if (selectedRegion !== "ALL") {
      return `/database?region=${encodeURIComponent(selectedRegion)}`;
    }
    return "/database";
  }, [selectedCountry, selectedRegion]);

  const isFiltered = selectedCountry !== "ALL" || selectedRegion !== "ALL";

  return (
    <section
      aria-label="互動式世界地圖與區域新聞篩選器"
      className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden"
    >
      {/* Map Header & Region Controls */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#E9E9E7] flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-[#37352F] flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#37352F] shrink-0" />
            <span>互動式全球新聞與公開情資地圖</span>
          </h2>
          <p className="text-xs text-[#787774]">
            點擊地圖上的國家區塊、城市節點或上方區域按鈕，即可即時篩選該國家／地區的新聞媒體與官方資料流。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap items-center border border-[#E9E9E7] rounded-[4px] bg-[#F7F6F3] p-0.5 text-xs">
            {REGION_TABS.map((tab) => {
              const active =
                tab.id === "ALL"
                  ? selectedCountry === "ALL" && selectedRegion === "ALL"
                  : selectedRegion === tab.id && selectedCountry === "ALL";
              const count = statsByRegion[tab.id]?.total ?? 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleRegionTabClick(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] font-medium whitespace-nowrap tabular-nums transition-colors ${
                    active
                      ? "bg-white text-[#37352F] shadow-2xs"
                      : "text-[#5A5852] hover:text-[#37352F]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="font-mono text-[10px] text-[#787774]">{count}</span>
                </button>
              );
            })}
          </div>

          {activeRegionForHighlight !== "ALL" && activeRegionForHighlight !== "全球" && (
            <button
              type="button"
              onClick={() => setZoomToRegion((prev) => !prev)}
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
            >
              {zoomToRegion ? "切回世界全覽" : `聚焦放大${activeRegionForHighlight}`}
            </button>
          )}

          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                onSelectCountry("ALL");
                onSelectRegion("ALL");
                setZoomToRegion(false);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#5A5852] hover:text-[#37352F] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>重設全部</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split: Left 8 Cols Interactive Vector Map, Right 4 Cols Regional Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#E9E9E7]">
        {/* Left: SVG Cartography Canvas */}
        <div className="lg:col-span-8 bg-[#FBFBFA] relative p-3 sm:p-4 flex flex-col justify-between">
          <div className="w-full overflow-hidden rounded-[4px] border border-[#E9E9E7] bg-[#F7F5F0]">
            <svg
              viewBox={currentViewBox}
              role="img"
              aria-label="互動式世界國家與地區情報分布地圖"
              className="w-full h-auto max-h-[380px] select-none block transition-all duration-300"
            >
              {/* Graticule Lines */}
              <path
                d={mapData.graticulePath}
                fill="none"
                stroke="#EAE6DD"
                strokeWidth={0.55}
              />

              {/* Country Polygons */}
              <g>
                {mapData.polygons.map((poly) => {
                  const isTrackedSelected =
                    poly.trackedCode !== null && selectedCountry === poly.trackedCode;
                  const isRegionSelected =
                    selectedRegion !== "ALL" &&
                    selectedRegion !== "全球" &&
                    poly.macroRegion === selectedRegion;
                  const isHovered =
                    hoveredTargetKey === `poly-${poly.isoId}` ||
                    (poly.trackedCode !== null && hoveredTargetKey === `pin-${poly.trackedCode}`);

                  let fillColor = "#EAE6DC";
                  if (isTrackedSelected) {
                    fillColor = "#37352F";
                  } else if (isRegionSelected) {
                    fillColor = poly.trackedCode ? "#57534E" : "#C9C2B6";
                  } else if (isHovered) {
                    fillColor = poly.trackedCode ? "#78716C" : "#D5CFC4";
                  } else if (poly.trackedCode) {
                    fillColor = "#CFC7B8";
                  } else if (poly.macroRegion) {
                    fillColor = "#E5E0D5";
                  }

                  const countryStat = poly.trackedCode ? statsByCountry[poly.trackedCode] : null;
                  const macroStat = poly.macroRegion ? statsByRegion[poly.macroRegion] : null;

                  return (
                    <path
                      key={poly.isoId}
                      d={poly.d}
                      fill={fillColor}
                      stroke="#FBFBFA"
                      strokeWidth={isTrackedSelected ? 0.9 : 0.55}
                      tabIndex={poly.trackedCode || poly.macroRegion ? 0 : -1}
                      role={poly.trackedCode || poly.macroRegion ? "button" : undefined}
                      aria-label={
                        poly.trackedCode
                          ? `篩選 ${COUNTRY_OPTIONS.find((c) => c.code === poly.trackedCode)?.name ?? poly.name}`
                          : poly.macroRegion
                            ? `篩選 ${poly.macroRegion}地區（${poly.name}）`
                            : poly.name
                      }
                      className={
                        poly.trackedCode || poly.macroRegion
                          ? "cursor-pointer transition-colors duration-150 focus:outline-none"
                          : "cursor-default"
                      }
                      onMouseEnter={() => {
                        setHoveredTargetKey(`poly-${poly.isoId}`);
                        if (poly.trackedCode && countryStat) {
                          const cOpt = COUNTRY_OPTIONS.find((c) => c.code === poly.trackedCode);
                          setHoverInfo({
                            title: `${cOpt?.name ?? poly.name} (${poly.trackedCode})`,
                            subtitle: `${cOpt?.region ?? ""}地區 · 官方 ${countryStat.official} / 媒體 ${countryStat.community}`,
                            count: countryStat.total,
                            highRisk: countryStat.highRisk,
                          });
                        } else if (poly.macroRegion && macroStat) {
                          setHoverInfo({
                            title: `${poly.name} → ${poly.macroRegion}地區`,
                            subtitle: `點擊即篩選${poly.macroRegion}即時新聞串流（官方 ${macroStat.official} / 媒體 ${macroStat.community}）`,
                            count: macroStat.total,
                            highRisk: macroStat.highRisk,
                          });
                        } else {
                          const gStat = statsByRegion.全球;
                          setHoverInfo({
                            title: `${poly.name || "跨國區域"} → 全球跨國串流`,
                            subtitle: "點擊切換為全球跨國綜合即時新聞",
                            count: gStat.total,
                            highRisk: gStat.highRisk,
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredTargetKey(null);
                        setHoverInfo(null);
                      }}
                      onClick={() => handlePolygonOrMarkerClick(poly.trackedCode, poly.macroRegion)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handlePolygonOrMarkerClick(poly.trackedCode, poly.macroRegion);
                        }
                      }}
                    />
                  );
                })}
              </g>

              {/* Tracked Country Interactive Nodes & Crisp Cartographic Labels */}
              <g>
                {mapData.markers.map((marker) => {
                  const stat = statsByCountry[marker.code] || {
                    total: 0,
                    official: 0,
                    community: 0,
                    highRisk: 0,
                  };
                  const isActive =
                    selectedCountry === marker.code ||
                    (selectedRegion !== "ALL" && selectedRegion === marker.region);
                  const isHovered = hoveredTargetKey === `pin-${marker.code}`;

                  return (
                    <g
                      key={marker.code}
                      transform={`translate(${marker.x}, ${marker.y})`}
                      role="button"
                      tabIndex={0}
                      aria-label={`點擊篩選 ${marker.name}（${stat.total} 筆即時資訊）`}
                      className="cursor-pointer focus:outline-none"
                      onMouseEnter={() => {
                        setHoveredTargetKey(`pin-${marker.code}`);
                        setHoverInfo({
                          title: `${marker.name} (${marker.code})`,
                          subtitle: `${marker.region}地區 · 官方 ${stat.official} / 媒體與社群 ${stat.community}`,
                          count: stat.total,
                          highRisk: stat.highRisk,
                        });
                      }}
                      onMouseLeave={() => {
                        setHoveredTargetKey(null);
                        setHoverInfo(null);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePolygonOrMarkerClick(marker.code, marker.region);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handlePolygonOrMarkerClick(marker.code, marker.region);
                        }
                      }}
                    >
                      {/* Invisible 24px touch/click hit target */}
                      <circle r={12} fill="transparent" />

                      {/* Outer ring when selected or hovered */}
                      {(isActive || isHovered) && (
                        <circle
                          r={isActive ? 9.5 : 8}
                          fill="none"
                          stroke={isActive ? "#37352F" : "#8F4B14"}
                          strokeWidth={1.2}
                          strokeOpacity={0.5}
                        />
                      )}

                      {/* Core crisp marker dot */}
                      <circle
                        r={isActive ? 5.5 : 4.5}
                        fill={
                          isActive
                            ? "#37352F"
                            : stat.highRisk > 0
                              ? "#8F4B14"
                              : "#22643D"
                        }
                        stroke="#FFFFFF"
                        strokeWidth={1.5}
                      />

                      {/* Clean label with white stroke halo for contrast */}
                      <text
                        x={marker.labelOffset[0]}
                        y={marker.labelOffset[1]}
                        textAnchor={marker.labelAnchor}
                        fontSize={zoomToRegion ? 8.5 : 10}
                        fontWeight={isActive ? 700 : 600}
                        fill={isActive ? "#1F1E1B" : "#37352F"}
                        style={{
                          paintOrder: "stroke",
                          stroke: "#F7F5F0",
                          strokeWidth: 3,
                          strokeLinejoin: "round",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        }}
                      >
                        {marker.code} · {stat.total}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Bottom Cartography Status & Legend Strip */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="min-h-[20px] text-[#5A5852]">
              {hoverInfo ? (
                <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
                  <span className="font-sans font-semibold text-[#37352F]">
                    {hoverInfo.title}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans text-[#787774]">{hoverInfo.subtitle}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#37352F] font-semibold">{hoverInfo.count} 篇</span>
                  {hoverInfo.highRisk > 0 && (
                    <span className="text-[#8F4B14]">（頭條 {hoverInfo.highRisk}）</span>
                  )}
                </div>
              ) : (
                <span className="text-[#787774]">
                  提示：點擊地圖任一國家區塊或標記節點即可直接篩選右側與全頁新聞流；再次點擊即可取消篩選。
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#787774] shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#37352F] inline-block" />
                <span>目前選取</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8F4B14] inline-block" />
                <span>含頭條焦點</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22643D] inline-block" />
                <span>即時活躍節點</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Selected Country/Region Live Stream Inspector */}
        <div className="lg:col-span-4 p-4 sm:p-5 flex flex-col justify-between gap-4 bg-white">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#787774]">
                  <MapPin className="w-3.5 h-3.5 text-[#37352F]" />
                  <span>區域即時篩選檢視</span>
                </span>
                <span className="font-mono text-xs font-semibold text-[#37352F] tabular-nums">
                  {inspectorMetrics.total} 篇資訊
                </span>
              </div>
              <h3 className="text-base font-bold text-[#37352F] leading-snug">
                {activeSelectionTitle}
              </h3>
            </div>

            {/* Clean Tabular Breakdown */}
            <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[#E9E9E7] text-center font-mono tabular-nums">
              <div>
                <div className="text-[11px] font-sans text-[#787774]">新聞與社群</div>
                <div className="text-sm font-semibold text-[#37352F] mt-0.5">
                  {inspectorMetrics.community}
                </div>
              </div>
              <div className="border-x border-[#E9E9E7]">
                <div className="text-[11px] font-sans text-[#787774]">官方公告</div>
                <div className="text-sm font-semibold text-[#22643D] mt-0.5">
                  {inspectorMetrics.official}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-sans text-[#787774]">頭條焦點</div>
                <div className="text-sm font-semibold text-[#8F4B14] mt-0.5">
                  {inspectorMetrics.highRisk}
                </div>
              </div>
            </div>

            {/* Live Top 5 Real Items for Selected Country/Region */}
            {previewEntries.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs text-[#787774]">
                  目前此篩選條件下尚無已索引文章。
                </p>
                {isFiltered && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCountry("ALL");
                      onSelectRegion("ALL");
                    }}
                    className="text-xs font-medium text-[#37352F] underline"
                  >
                    顯示全球全部國家資料
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-[#E9E9E7]">
                {previewEntries.map((item) => (
                  <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      to={`/post/${item.id}`}
                      className="block group space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[#787774]">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <SafeSourceIcon
                            src={item.sourceIcon}
                            url={item.url}
                            category={item.category}
                            alt={item.sourceName}
                            className="w-3.5 h-3.5"
                          />
                          <span className="truncate font-medium text-[#5A5852]">
                            {item.sourceName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono shrink-0">{item.countryCode}</span>
                        </span>
                        <span className="font-mono tabular-nums shrink-0">
                          {formatShortDate(item.publishedAt)}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-[#37352F] group-hover:underline line-clamp-2 leading-snug">
                        {item.title}
                      </div>

                      <div className="flex items-center gap-1.5 pt-0.5">
                        <SectorTag sector={getEntrySector(item)} />
                        <RiskTag level={item.riskLevel} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-3 border-t border-[#E9E9E7] flex items-center justify-between gap-2">
            <Link
              to={databaseLink}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] transition-colors whitespace-nowrap"
            >
              <span>進入完整資料庫查看此區</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
