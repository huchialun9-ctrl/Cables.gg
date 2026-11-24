#!/usr/bin/env python3
"""
Cables.gg — 多國公開資料庫爬蟲與自動化排班管線 (0-Cost Pipeline)
讀取 data/sources.json，支援多國新聞 RSS、CISA KEV 資安資料庫、GitHub Releases 與自訂爬文，
擷取來源 Favicon 與真實網頁 og:image（無圖片時留空，不使用假圖片），
並以確定性雜湊 ID 寫回 data/database.json。
"""

import hashlib
import html
import json
import os
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DATABASE_PATH = DATA_DIR / "database.json"
SOURCES_PATH = DATA_DIR / "sources.json"


def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, payload: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def make_stable_id(seed: str) -> str:
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:12]
    return f"cbl-{digest}"


def make_favicon(url: str) -> str:
    host = (urllib.parse.urlparse(url).hostname or "cables.gg").lower()
    if "github.com" in host or host == "api.github.com":
        return "https://www.google.com/s2/favicons?domain=github.com&sz=64"
    if "reddit.com" in host:
        return "https://www.google.com/s2/favicons?domain=reddit.com&sz=64"
    return f"https://www.google.com/s2/favicons?domain={urllib.parse.quote(host)}&sz=64"


def strip_html(raw: str) -> str:
    unescaped = html.unescape(raw or "")
    text = re.sub(r"<[^>]+>", " ", unescaped)
    return re.sub(r"\s+", " ", text).strip()


def fetch_url(url: str, headers: dict | None = None, timeout: int = 12) -> bytes:
    req_headers = {"User-Agent": "CablesGG-Crawler/2.0 (+https://cables.gg)"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def resolve_real_image(candidate: str | None, base_url: str) -> str:
    if not candidate:
        return ""
    cleaned = html.unescape(candidate).strip()
    if not cleaned or cleaned.startswith("data:"):
        return ""
    abs_url = urllib.parse.urljoin(base_url, cleaned)
    if re.search(r"favicon\.(ico|png)|1x1|pixel\.|gstatic\.com/images/branding", abs_url, re.I):
        return ""
    return abs_url


def fetch_og_image(article_url: str) -> str:
    try:
        host = (urllib.parse.urlparse(article_url).hostname or "").lower()
        if host in ("news.google.com", "nvd.nist.gov", ""):
            return ""
        raw = fetch_url(
            article_url,
            headers={"Accept": "text/html,application/xhtml+xml"},
            timeout=4,
        )[:120_000].decode("utf-8", errors="ignore")
        match = (
            re.search(r'<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']', raw, re.I)
            or re.search(r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']', raw, re.I)
            or re.search(r'<meta[^>]*name=["\']twitter:image(?::src)?["\'][^>]*content=["\']([^"\']+)["\']', raw, re.I)
        )
        return resolve_real_image(match.group(1), article_url) if match else ""
    except Exception:
        return ""


def infer_sector(src: dict, url: str = "") -> str:
    explicit = src.get("sourceSector")
    if explicit in ("official", "community"):
        return explicit
    hay = f"{src.get('name', '')} {url or src.get('endpoint', '')}".lower()
    if re.search(r"(\.gov|twcert|ncdr\.nat\.gov|cisa\.gov|nist\.gov|sec\.gov|ncsc\.gov|cert\.europa|jpcert\.or\.jp|europa\.eu)", hay):
        return "official"
    return "community"


def infer_risk(title: str, summary: str, category: str) -> str:
    if category == "資安公告":
        return "high"
    hay = f"{title} {summary}".lower()
    if re.search(r"(cve-\d{4}|zero-day|0-day|critical|exploit|ransomware|breach|breaking change|deprecated|outage|緊急|重大|漏洞)", hay):
        return "high"
    if re.search(r"(security|warning|patch|migration|upgrade|tariff|inflation|政策|關稅|警告|更新|修補)", hay):
        return "medium"
    return "low"


def fetch_cisa_kev(src: dict, limit: int = 3) -> list[dict]:
    raw = fetch_url(src["endpoint"])
    payload = json.loads(raw.decode("utf-8"))
    vulns = sorted(
        payload.get("vulnerabilities", []),
        key=lambda v: v.get("dateAdded", ""),
        reverse=True,
    )[:limit]
    results = []
    for v in vulns:
        cve_id = v.get("cveID", "CVE")
        cve_url = f"https://nvd.nist.gov/vuln/detail/{cve_id}"
        title = f"[CISA KEV] {cve_id}: {v.get('vendorProject')} {v.get('product')} — {v.get('vulnerabilityName')}"
        results.append({
            "id": make_stable_id(f"{src['id']}:{cve_id}"),
            "title": title,
            "originalTitle": title,
            "category": "資安公告",
            "riskLevel": "high",
            "sourceSector": "official",
            "countryCode": src.get("countryCode", "US"),
            "countryName": src.get("countryName", "美國"),
            "region": src.get("region", "北美"),
            "originalLanguage": "EN",
            "sourceName": src["name"],
            "sourceId": src["id"],
            "sourceIcon": "https://www.google.com/s2/favicons?domain=cisa.gov&sz=64",
            "bannerImage": "",
            "version": cve_id,
            "publishedAt": f"{v.get('dateAdded', datetime.now(timezone.utc).strftime('%Y-%m-%d'))}T00:00:00Z",
            "url": cve_url,
            "heatScore": 95,
            "commentCount": 0,
            "tags": [src.get("countryCode", "US"), "資安公告", cve_id, v.get("vendorProject", "Security")],
            "aiSummary": v.get("shortDescription", ""),
            "keyChanges": [
                f"受影響廠商與產品：{v.get('vendorProject')} / {v.get('product')}",
                f"CISA 強制修補期限：{v.get('dueDate')}",
            ],
            "impactScope": f"使用 {v.get('vendorProject')} {v.get('product')} 之組織環境。",
            "migrationSteps": [v.get("requiredAction", "套用原廠修補程式。")],
            "aiEnriched": False,
            "diff": None,
            "comments": [],
        })
    return results


def fetch_github_releases(src: dict, limit: int = 3) -> list[dict]:
    token = os.environ.get("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    raw = fetch_url(src["endpoint"], headers)
    releases = json.loads(raw.decode("utf-8"))[:limit]
    results = []
    for rel in releases:
        link = rel.get("html_url") or src["endpoint"]
        tag = rel.get("tag_name") or "release"
        title = f"{src['name'].replace(' Releases', '')} {tag} — {rel.get('name') or tag}"
        summary = strip_html(rel.get("body", ""))[:320]
        results.append({
            "id": make_stable_id(f"{src['id']}:{link}:{tag}"),
            "title": title,
            "originalTitle": title,
            "category": src.get("category", "GitHub 釋出"),
            "riskLevel": infer_risk(title, summary, src.get("category", "GitHub 釋出")),
            "sourceSector": "community",
            "countryCode": src.get("countryCode", "GLOBAL"),
            "countryName": src.get("countryName", "全球跨國"),
            "region": src.get("region", "全球"),
            "originalLanguage": "EN",
            "sourceName": src["name"],
            "sourceId": src["id"],
            "sourceIcon": "https://www.google.com/s2/favicons?domain=github.com&sz=64",
            "bannerImage": fetch_og_image(link),
            "version": tag,
            "publishedAt": rel.get("published_at") or datetime.now(timezone.utc).isoformat(),
            "url": link,
            "heatScore": 82,
            "commentCount": 0,
            "tags": [src.get("countryCode", "GLOBAL"), "GitHub", tag],
            "aiSummary": summary or f"GitHub 官方發布 {tag} 版本釋出說明。",
            "keyChanges": [f"GitHub 官方釋出 {tag}"],
            "impactScope": f"使用 {src['name']} 之開發專案。",
            "migrationSteps": ["檢視 Release Notes 確認升級注意事項。"],
            "aiEnriched": False,
            "diff": None,
            "comments": [],
        })
    return results


def fetch_rss_feed(src: dict, limit: int = 3) -> list[dict]:
    raw = fetch_url(src["endpoint"])
    root = ET.fromstring(raw)
    items = []
    nodes = (
        root.findall(".//item")
        or root.findall(".//{http://purl.org/rss/1.0/}item")
        or root.findall(".//{http://www.w3.org/2005/Atom}entry")
    )
    sector = infer_sector(src)
    for entry in nodes[:limit]:
        title = strip_html(
            entry.findtext("title")
            or entry.findtext("{http://purl.org/rss/1.0/}title")
            or entry.findtext("{http://www.w3.org/2005/Atom}title")
            or ""
        )
        link = (
            entry.findtext("link")
            or entry.findtext("{http://purl.org/rss/1.0/}link")
            or ""
        ).strip()
        if not link:
            link_el = entry.find("{http://www.w3.org/2005/Atom}link")
            if link_el is not None:
                link = link_el.attrib.get("href", src["endpoint"])
        if not title:
            continue

        source_el = entry.find("source")
        publisher_name = strip_html(source_el.text) if source_el is not None and source_el.text else ""
        publisher_url = source_el.attrib.get("url", "") if source_el is not None else ""
        effective_source = publisher_name or src["name"]

        desc_raw = (
            entry.findtext("description")
            or entry.findtext("{http://purl.org/rss/1.0/}description")
            or entry.findtext("{http://www.w3.org/2005/Atom}summary")
            or ""
        )
        desc = strip_html(desc_raw)

        # Extract real image from RSS media tags or fallback to page og:image (no fake placeholders)
        rss_img = ""
        for media_tag in (
            "{http://search.yahoo.com/mrss/}content",
            "{http://search.yahoo.com/mrss/}thumbnail",
            "enclosure",
        ):
            el = entry.find(media_tag)
            if el is not None and el.attrib.get("url"):
                if media_tag == "enclosure" and not el.attrib.get("type", "").startswith("image/"):
                    continue
                rss_img = resolve_real_image(el.attrib.get("url"), link or src["endpoint"])
                if rss_img:
                    break
        if not rss_img:
            img_match = re.search(r'<img[^>]*\bsrc=["\']([^"\']+)["\']', desc_raw, re.I)
            if img_match:
                rss_img = resolve_real_image(img_match.group(1), link or src["endpoint"])
        if not rss_img and link:
            rss_img = fetch_og_image(link)

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        risk = infer_risk(title, desc, src.get("category", "國際焦點"))
        items.append({
            "id": make_stable_id(f"{src['id']}:{link}:{title}"),
            "title": title,
            "originalTitle": title,
            "category": src.get("category", "國際焦點"),
            "riskLevel": risk,
            "sourceSector": sector,
            "countryCode": src.get("countryCode", "GLOBAL"),
            "countryName": src.get("countryName", "全球跨國"),
            "region": src.get("region", "全球"),
            "originalLanguage": "ZH" if src.get("countryCode") == "TW" else "EN",
            "sourceName": effective_source,
            "sourceId": src["id"],
            "sourceIcon": make_favicon(publisher_url or link or src["endpoint"]),
            "bannerImage": rss_img,
            "version": f"{src.get('countryCode', 'GLOBAL')}-FEED",
            "publishedAt": now_str,
            "url": link or src["endpoint"],
            "heatScore": 86 if risk == "high" else (64 if risk == "medium" else 48),
            "commentCount": 0,
            "tags": [src.get("countryCode", "GLOBAL"), src.get("category", "新聞")],
            "aiSummary": desc[:320] or f"{effective_source} 公開資料流即時擷取報導：{title}",
            "keyChanges": [f"來源：{effective_source}（{src.get('countryName', '全球')}）"],
            "impactScope": f"關注 {src.get('countryName', '全球')} 公開資訊與新聞之團隊。",
            "migrationSteps": ["前往官方原文查看完整細節。"],
            "aiEnriched": src.get("countryCode") == "TW",
            "diff": None,
            "comments": [],
        })
    return items



def main() -> None:
    sources_cfg = load_json(SOURCES_PATH)
    db = load_json(DATABASE_PATH)
    existing = {entry["id"]: entry for entry in db.get("entries", [])}
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    checked = 0
    ok_count = 0
    new_count = 0
    for src in sources_cfg.get("sources", []):
        if not src.get("enabled"):
            continue
        checked += 1
        try:
            if src["type"] == "Public Gov JSON":
                candidates = fetch_cisa_kev(src)
            elif src["type"] == "GitHub Releases API":
                candidates = fetch_github_releases(src)
            else:
                candidates = fetch_rss_feed(src)

            added_here = 0
            for c in candidates:
                if c["id"] not in existing:
                    existing[c["id"]] = c
                    added_here += 1
                    new_count += 1

            ok_count += 1
            src["lastCheckedAt"] = now_iso
            src["lastStatus"] = "ok"
            src["itemsCaptured"] = src.get("itemsCaptured", 0) + added_here
        except Exception as exc:
            src["lastCheckedAt"] = now_iso
            src["lastStatus"] = f"error: {str(exc)[:40]}"

    merged = sorted(existing.values(), key=lambda x: x.get("publishedAt", ""), reverse=True)
    sources_cfg["pipeline"]["lastRunAt"] = now_iso
    sources_cfg["pipeline"]["lastRunStatus"] = "success" if ok_count > 0 else "warning"
    sources_cfg.setdefault("syncLogs", []).insert(0, {
        "id": f"log-py-{int(datetime.now(timezone.utc).timestamp())}",
        "timestamp": now_iso,
        "trigger": "GitHub Actions Python Crawler",
        "status": "success" if ok_count > 0 else "warning",
        "sourcesChecked": checked,
        "newEntries": new_count,
        "durationSeconds": 0.0,
        "commitSha": os.environ.get("GITHUB_SHA", "local-py")[:7],
        "message": f"Python 排班爬蟲檢查 {checked} 個來源（{ok_count} 成功），新增 {new_count} 筆索引（總計 {len(merged)} 筆）。",
    })
    sources_cfg["syncLogs"] = sources_cfg["syncLogs"][:30]

    db["entries"] = merged
    db["lastUpdated"] = now_iso
    db["totalRecords"] = len(merged)

    save_json(SOURCES_PATH, sources_cfg)
    save_json(DATABASE_PATH, db)
    print(f"[Cables.gg] Checked {checked} sources, added {new_count} entries (total {len(merged)}) at {now_iso}")


if __name__ == "__main__":
    main()
