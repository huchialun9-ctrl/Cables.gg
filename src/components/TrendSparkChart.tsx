import { useMemo, useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import type { CableEntry } from "../types/cables";

interface TrendSparkChartProps {
  entries: CableEntry[];
}

interface DailyPoint {
  dateKey: string;
  label: string;
  total: number;
  high: number;
  medium: number;
  low: number;
}

export function TrendSparkChart({ entries }: TrendSparkChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const dailyData = useMemo<DailyPoint[]>(() => {
    // Anchor 7-day window to the latest published date in dataset (fallback 2026-11-22)
    let anchorDate = new Date("2026-11-22T00:00:00Z");
    if (entries.length > 0) {
      const latestMs = Math.max(...entries.map((e) => new Date(e.publishedAt).getTime()));
      if (!Number.isNaN(latestMs)) {
        const d = new Date(latestMs);
        anchorDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      }
    }

    const days: DailyPoint[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const current = new Date(anchorDate);
      current.setUTCDate(anchorDate.getUTCDate() - offset);
      const yyyy = current.getUTCFullYear();
      const mm = String(current.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(current.getUTCDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;
      days.push({
        dateKey,
        label: `${mm}/${dd}`,
        total: 0,
        high: 0,
        medium: 0,
        low: 0,
      });
    }

    const byKey = new Map(days.map((d) => [d.dateKey, d]));
    for (const entry of entries) {
      const key = entry.publishedAt.slice(0, 10);
      const bucket = byKey.get(key);
      if (!bucket) continue;
      bucket.total += 1;
      if (entry.riskLevel === "high") bucket.high += 1;
      else if (entry.riskLevel === "medium") bucket.medium += 1;
      else bucket.low += 1;
    }

    return days;
  }, [entries]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || dailyData.length === 0) return;

    const width = 440;
    const height = 144;
    const margin = { top: 12, right: 14, bottom: 24, left: 26 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scalePoint<string>()
      .domain(dailyData.map((d) => d.label))
      .range([0, innerWidth])
      .padding(0.15);

    const maxCount = Math.max(3, d3.max(dailyData, (d) => d.total) ?? 3);
    const y = d3
      .scaleLinear()
      .domain([0, maxCount])
      .nice()
      .range([innerHeight, 0]);

    // Subtle horizontal gridlines (Notion hairline #E9E9E7)
    const ticks = y.ticks(Math.min(4, maxCount)).filter((t) => Number.isInteger(t));
    g.selectAll(".grid-line")
      .data(ticks)
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "#E9E9E7")
      .attr("stroke-width", 1);

    // Y axis integer labels
    g.selectAll(".y-label")
      .data(ticks)
      .enter()
      .append("text")
      .attr("x", -8)
      .attr("y", (d) => y(d) + 3)
      .attr("text-anchor", "end")
      .attr("fill", "#9B9A97")
      .attr("font-size", "10px")
      .attr("font-family", "JetBrains Mono, monospace")
      .text((d) => String(d));

    // X axis date labels
    g.selectAll(".x-label")
      .data(dailyData)
      .enter()
      .append("text")
      .attr("x", (d) => x(d.label) ?? 0)
      .attr("y", innerHeight + 17)
      .attr("text-anchor", "middle")
      .attr("fill", "#787774")
      .attr("font-size", "10px")
      .attr("font-family", "JetBrains Mono, monospace")
      .text((d) => d.label);

    // Line generators
    const totalLine = d3
      .line<DailyPoint>()
      .x((d) => x(d.label) ?? 0)
      .y((d) => y(d.total))
      .curve(d3.curveMonotoneX);

    const mediumLine = d3
      .line<DailyPoint>()
      .x((d) => x(d.label) ?? 0)
      .y((d) => y(d.medium))
      .curve(d3.curveMonotoneX);

    const highLine = d3
      .line<DailyPoint>()
      .x((d) => x(d.label) ?? 0)
      .y((d) => y(d.high))
      .curve(d3.curveMonotoneX);

    // Subtle area under total curve
    const totalArea = d3
      .area<DailyPoint>()
      .x((d) => x(d.label) ?? 0)
      .y0(innerHeight)
      .y1((d) => y(d.total))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(dailyData)
      .attr("fill", "#F4F2EE")
      .attr("fill-opacity", 0.7)
      .attr("d", totalArea);

    // Medium risk dashed line (#8A5A00)
    g.append("path")
      .datum(dailyData)
      .attr("fill", "none")
      .attr("stroke", "#8A5A00")
      .attr("stroke-width", 1.25)
      .attr("stroke-dasharray", "3 3")
      .attr("d", mediumLine);

    // Total changes solid line (#37352F)
    g.append("path")
      .datum(dailyData)
      .attr("fill", "none")
      .attr("stroke", "#37352F")
      .attr("stroke-width", 1.75)
      .attr("d", totalLine);

    // High risk solid line (#9B2C2C)
    g.append("path")
      .datum(dailyData)
      .attr("fill", "none")
      .attr("stroke", "#9B2C2C")
      .attr("stroke-width", 1.5)
      .attr("d", highLine);

    // Active hover vertical guide
    if (hoveredIndex !== null && dailyData[hoveredIndex]) {
      const targetX = x(dailyData[hoveredIndex].label) ?? 0;
      g.append("line")
        .attr("x1", targetX)
        .attr("x2", targetX)
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "#D3D1CB")
        .attr("stroke-width", 1);
    }

    // Data point dots for Total
    g.selectAll(".dot-total")
      .data(dailyData)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.label) ?? 0)
      .attr("cy", (d) => y(d.total))
      .attr("r", (_d, i) => (hoveredIndex === i ? 4 : 2.5))
      .attr("fill", "#37352F");

    // Data point dots for High Risk
    g.selectAll(".dot-high")
      .data(dailyData)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.label) ?? 0)
      .attr("cy", (d) => y(d.high))
      .attr("r", (_d, i) => (hoveredIndex === i ? 3.5 : 2.25))
      .attr("fill", "#9B2C2C");

    // Invisible hover columns for crisp pointer interaction
    const step = innerWidth / Math.max(1, dailyData.length - 1);
    g.selectAll(".hover-zone")
      .data(dailyData)
      .enter()
      .append("rect")
      .attr("x", (d) => (x(d.label) ?? 0) - step / 2)
      .attr("y", 0)
      .attr("width", step)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mouseenter", (_event, d) => {
        const idx = dailyData.findIndex((item) => item.dateKey === d.dateKey);
        if (idx !== -1) setHoveredIndex(idx);
      })
      .on("mouseleave", () => {
        setHoveredIndex(null);
      });
  }, [dailyData, hoveredIndex]);

  const activePoint =
    hoveredIndex !== null && dailyData[hoveredIndex]
      ? dailyData[hoveredIndex]
      : dailyData[dailyData.length - 1];

  return (
    <div className="bg-white border border-[#E9E9E7] rounded-md p-4 flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-xs font-semibold text-[#37352F]">近 7 天收錄資訊與頭條趨勢</div>

        {/* Clean Notion legend */}
        <div className="flex items-center gap-3 text-[11px] text-[#787774]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#37352F] inline-block" />
            <span>總收錄</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#9B2C2C] inline-block" />
            <span>頭條焦點</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 border-t border-dashed border-[#8A5A00] inline-block" />
            <span>重點報導</span>
          </span>
        </div>
      </div>

      <div className="w-full">
        <svg
          ref={svgRef}
          viewBox="0 0 440 144"
          className="w-full h-auto block overflow-visible"
          role="img"
          aria-label="近 7 天國際新聞與資訊收錄數量趨勢折線圖"
        />
      </div>

      {activePoint && (
        <div className="mt-2 pt-2 border-t border-[#E9E9E7] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-[#787774]">
          <span>
            {hoveredIndex !== null ? activePoint.dateKey : `${activePoint.dateKey} (最新)`}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[#37352F]">總計 {activePoint.total}</span>
            <span className="text-[#8E352E]">頭條 {activePoint.high}</span>
            <span className="text-[#8A5A00]">重點 {activePoint.medium}</span>
            <span className="text-[#22643D]">快訊 {activePoint.low}</span>
          </div>
        </div>
      )}
    </div>
  );
}
