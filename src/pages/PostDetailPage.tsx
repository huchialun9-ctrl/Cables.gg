import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  CheckCircle2,
  Eraser,
  ExternalLink,
  Highlighter,
  Languages,
  Loader2,
  MessageSquare,
  MousePointer,
  PenTool,
  RotateCcw,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import type {
  CableEntry,
  FullArticleBlock,
  HighlightColor,
  ReaderHighlight,
  ReaderStroke,
  ReaderStrokePoint,
} from "../types/cables";
import { formatDateTime } from "../components/NotionTags";
import { SafeBannerImage, SafeSourceIcon } from "../components/SafeImage";
import { getEntrySector } from "../utils/blogTemplates";

interface PostDetailPageProps {
  onCommentAdded: () => void;
}

type ToolMode = "select" | "pen" | "highlighter";
type FontSizeMode = "sm" | "md" | "lg";

const HIGHLIGHT_COLORS: Array<{
  id: HighlightColor;
  label: string;
  bgClass: string;
  swatchHex: string;
}> = [
  { id: "yellow", label: "黃色重點", bgClass: "bg-[#FEF08A]/80", swatchHex: "#FDE047" },
  { id: "green", label: "薄荷綠", bgClass: "bg-[#BBF7D0]/85", swatchHex: "#86EFAC" },
  { id: "blue", label: "天空藍", bgClass: "bg-[#BAE6FD]/85", swatchHex: "#7DD3FC" },
  { id: "pink", label: "暖粉紅", bgClass: "bg-[#FBCFE8]/85", swatchHex: "#F9A8D4" },
];

const PEN_COLORS = [
  { hex: "#1C1917", label: "深墨黑" },
  { hex: "#B91C1C", label: "紅筆批註" },
  { hex: "#1D4ED8", label: "藍筆標記" },
  { hex: "#15803D", label: "綠筆註記" },
];

const BRUSH_HIGHLIGHTER_COLORS = [
  { hex: "#FACC15", label: "螢光黃" },
  { hex: "#4ADE80", label: "螢光綠" },
  { hex: "#38BDF8", label: "螢光藍" },
  { hex: "#F472B6", label: "螢光粉" },
];

function renderHighlightedParagraph(
  text: string,
  highlights: ReaderHighlight[],
  onRemoveHighlight: (id: string) => void
) {
  if (!highlights.length) return text;

  // Locate first non-overlapping match for each highlighted snippet
  const ranges: Array<{
    start: number;
    end: number;
    hl: ReaderHighlight;
  }> = [];

  for (const hl of highlights) {
    const idx = text.indexOf(hl.text);
    if (idx === -1) continue;
    const end = idx + hl.text.length;
    const overlaps = ranges.some((r) => !(end <= r.start || idx >= r.end));
    if (!overlaps) {
      ranges.push({ start: idx, end, hl });
    }
  }

  if (ranges.length === 0) return text;
  ranges.sort((a, b) => a.start - b.start);

  const nodes: Array<string | ReactNode> = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      nodes.push(text.slice(cursor, range.start));
    }
    const colorMeta =
      HIGHLIGHT_COLORS.find((c) => c.id === range.hl.color) || HIGHLIGHT_COLORS[0];
    nodes.push(
      <mark
        key={range.hl.id}
        title={range.hl.note ? `筆記：${range.hl.note}（點擊可移除標記）` : "點擊可移除此重點標記"}
        onClick={(e) => {
          e.stopPropagation();
          onRemoveHighlight(range.hl.id);
        }}
        className={`${colorMeta.bgClass} text-[#1C1917] px-0.5 rounded-[2px] cursor-pointer hover:opacity-80 transition-opacity`}
      >
        {text.slice(range.start, range.end)}
      </mark>
    );
    cursor = range.end;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

export function PostDetailPage({ onCommentAdded }: PostDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [entry, setEntry] = useState<CableEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Full-article reader state
  const [blocks, setBlocks] = useState<FullArticleBlock[]>([]);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleSourceMode, setArticleSourceMode] = useState<
    "live_full_article" | "rss_expanded_fallback"
  >("live_full_article");
  const [translating, setTranslating] = useState(false);
  const [translationMsg, setTranslationMsg] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(true);
  const [fontSize, setFontSize] = useState<FontSizeMode>("md");

  // Reader interactive tools: select/highlight vs pen vs highlighter brush
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[1].hex);
  const [penWidth, setPenWidth] = useState<number>(3);
  const [brushColor, setBrushColor] = useState<string>(BRUSH_HIGHLIGHTER_COLORS[0].hex);
  const [brushWidth, setBrushWidth] = useState<number>(18);

  // Saved annotations
  const [highlights, setHighlights] = useState<ReaderHighlight[]>([]);
  const [strokes, setStrokes] = useState<ReaderStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<ReaderStroke | null>(null);

  // Text selection popover state
  const [selectionPopup, setSelectionPopup] = useState<{
    paragraphIndex: number;
    text: string;
    top: number;
    left: number;
  } | null>(null);
  const [highlightNote, setHighlightNote] = useState("");

  // Knowledge base bookmark & Blog share state
  const [bookmarked, setBookmarked] = useState(false);
  const [sharedToBlog, setSharedToBlog] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Reading progress & completion confirmation modal
  const [readingProgress, setReadingProgress] = useState(0);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const completionPromptedRef = useRef(false);
  const hasScrolledRef = useRef(false);

  // Simple reading note form
  const [noteInput, setNoteInput] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // DOM refs for progress & canvas drawing
  const articlePaperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<ReaderStrokePoint[]>([]);
  const activeStrokeMetaRef = useRef<{
    id: string;
    tool: "pen" | "highlighter";
    color: string;
    width: number;
  } | null>(null);
  const persistTimeoutRef = useRef<number | null>(null);

  // Dismiss popup or modal on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectionPopup(null);
        setShowCompletionModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Load entry + full-length article
  useEffect(() => {
    let active = true;
    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = null;
    }
    completionPromptedRef.current = false;
    hasScrolledRef.current = false;
    isDrawingRef.current = false;
    currentPointsRef.current = [];
    activeStrokeMetaRef.current = null;
    setActiveStroke(null);
    setBlocks([]);
    setHighlights([]);
    setStrokes([]);
    setNoteInput("");
    setHighlightNote("");
    setArticleSourceMode("live_full_article");
    setReadingProgress(0);
    setShowCompletionModal(false);
    setSelectionPopup(null);
    setTranslationMsg(null);
    setActionToast(null);

    async function loadEntryAndArticle() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/database/${encodeURIComponent(id)}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "找不到指定的文章項目");
        }
        const data = (await res.json()) as CableEntry;
        if (!active) return;

        setEntry(data);
        setBookmarked(Boolean(data.bookmarked));
        setSharedToBlog(Boolean(data.sharedToBlog));

        // Restore localStorage backup if server copy is empty
        let initialHighlights = data.readerHighlights || [];
        let initialStrokes = data.readerStrokes || [];
        try {
          const cached = localStorage.getItem(`cables_reader_${data.id}`);
          if (cached) {
            const parsed = JSON.parse(cached) as {
              highlights?: ReaderHighlight[];
              strokes?: ReaderStroke[];
            };
            if (initialHighlights.length === 0 && parsed.highlights?.length) {
              initialHighlights = parsed.highlights;
            }
            if (initialStrokes.length === 0 && parsed.strokes?.length) {
              initialStrokes = parsed.strokes;
            }
          }
        } catch {
          // Ignore storage error
        }
        setHighlights(initialHighlights);
        setStrokes(initialStrokes);

        if (data.fullArticleBlocks && data.fullArticleBlocks.length >= 3) {
          setBlocks(data.fullArticleBlocks);
          setArticleSourceMode(data.fullArticleSourceMode || "live_full_article");
        } else {
          // Fetch full-length article live from source URL
          setArticleLoading(true);
          fetch(`/api/database/${encodeURIComponent(id)}/full-article`)
            .then((r) => (r.ok ? r.json() : null))
            .then(
              (
                fullData: {
                  blocks?: FullArticleBlock[];
                  sourceMode?: "live_full_article" | "rss_expanded_fallback";
                } | null
              ) => {
                if (!active || !fullData?.blocks) return;
                setBlocks(fullData.blocks);
                if (fullData.sourceMode) setArticleSourceMode(fullData.sourceMode);
              }
            )
            .catch(() => {
              // Graceful fallback handled below
            })
            .finally(() => {
              if (active) setArticleLoading(false);
            });
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "載入文章失敗");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadEntryAndArticle();
    return () => {
      active = false;
      if (persistTimeoutRef.current) {
        window.clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    };
  }, [id]);

  // Persist reader highlights & strokes to localStorage + debounced backend
  const persistAnnotations = useCallback(
    (nextHighlights: ReaderHighlight[], nextStrokes: ReaderStroke[]) => {
      if (!entry) return;
      try {
        localStorage.setItem(
          `cables_reader_${entry.id}`,
          JSON.stringify({ highlights: nextHighlights, strokes: nextStrokes })
        );
      } catch {
        // Ignore storage error
      }
      if (persistTimeoutRef.current) {
        window.clearTimeout(persistTimeoutRef.current);
      }
      persistTimeoutRef.current = window.setTimeout(() => {
        fetch(`/api/database/${encodeURIComponent(entry.id)}/reader-actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            readerHighlights: nextHighlights,
            readerStrokes: nextStrokes,
          }),
        }).catch(() => {
          // Non-blocking sync
        });
      }, 450);
    },
    [entry]
  );

  // Scroll reading progress tracker + automatic completion dialog trigger
  useEffect(() => {
    const updateProgress = () => {
      const el = articlePaperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const articleTopAbs = rect.top + window.scrollY;
      const articleHeight = Math.max(el.offsetHeight, 1);

      if (window.scrollY > 40) {
        hasScrolledRef.current = true;
      }

      const scrolledBottom = window.scrollY + viewportHeight - articleTopAbs;
      const rawPct = Math.round((scrolledBottom / articleHeight) * 100);
      const clamped = Math.max(0, Math.min(100, rawPct));
      setReadingProgress(clamped);

      if (clamped >= 96 && hasScrolledRef.current && !completionPromptedRef.current) {
        completionPromptedRef.current = true;
        setShowCompletionModal(true);
      }
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [blocks, loading]);

  // Redraw canvas whenever strokes, activeStroke, or paper dimensions change
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = articlePaperRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const allStrokes = activeStroke ? [...strokes, activeStroke] : strokes;
    for (const stroke of allStrokes) {
      if (stroke.points.length < 1) continue;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.globalAlpha = stroke.tool === "highlighter" ? 0.34 : 0.92;
      ctx.globalCompositeOperation =
        stroke.tool === "highlighter" ? "multiply" : "source-over";

      ctx.beginPath();
      const firstX = stroke.points[0].x * width;
      const firstY = stroke.points[0].y * height;
      ctx.moveTo(firstX, firstY);

      if (stroke.points.length === 1) {
        ctx.lineTo(firstX + 0.1, firstY + 0.1);
      } else {
        for (let i = 1; i < stroke.points.length - 1; i += 1) {
          const xc = ((stroke.points[i].x + stroke.points[i + 1].x) / 2) * width;
          const yc = ((stroke.points[i].y + stroke.points[i + 1].y) / 2) * height;
          ctx.quadraticCurveTo(
            stroke.points[i].x * width,
            stroke.points[i].y * height,
            xc,
            yc
          );
        }
        const last = stroke.points[stroke.points.length - 1];
        ctx.lineTo(last.x * width, last.y * height);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [strokes, activeStroke]);

  useEffect(() => {
    redrawCanvas();
    const container = articlePaperRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => redrawCanvas());
    ro.observe(container);
    return () => ro.disconnect();
  }, [redrawCanvas, blocks, fontSize, showTranslated]);

  // Pointer drawing handlers on canvas
  const getNormalizedPoint = (e: ReactPointerEvent<HTMLCanvasElement>): ReaderStrokePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (toolMode === "select") return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    currentPointsRef.current = [pt];

    const strokeTool = toolMode === "highlighter" ? "highlighter" : "pen";
    const meta = {
      id: `stk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tool: strokeTool as "pen" | "highlighter",
      color: strokeTool === "highlighter" ? brushColor : penColor,
      width: strokeTool === "highlighter" ? brushWidth : penWidth,
    };
    activeStrokeMetaRef.current = meta;
    setActiveStroke({
      ...meta,
      points: [pt],
    });
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || toolMode === "select") return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;
    currentPointsRef.current.push(pt);
    const meta = activeStrokeMetaRef.current;
    if (meta) {
      setActiveStroke({
        ...meta,
        points: [...currentPointsRef.current],
      });
    }
  };

  const finishStroke = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const meta = activeStrokeMetaRef.current;
    const finalPoints = [...currentPointsRef.current];
    if (meta && finalPoints.length >= 1) {
      const completed: ReaderStroke = {
        ...meta,
        points: finalPoints,
      };
      const next = [...strokes, completed];
      setStrokes(next);
      persistAnnotations(highlights, next);
    }
    activeStrokeMetaRef.current = null;
    setActiveStroke(null);
    currentPointsRef.current = [];
  };

  const handleUndoStroke = () => {
    if (strokes.length === 0) return;
    const next = strokes.slice(0, -1);
    setStrokes(next);
    persistAnnotations(highlights, next);
  };

  const handleClearStrokes = () => {
    setStrokes([]);
    persistAnnotations(highlights, []);
  };

  // Text selection highlighter detection
  const handleArticleTextMouseUp = () => {
    if (toolMode !== "select") return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectionPopup(null);
      return;
    }

    const rawText = sel.toString().trim();
    if (rawText.length < 2) {
      setSelectionPopup(null);
      return;
    }

    const range = sel.getRangeAt(0);
    let node: Node | null = range.commonAncestorContainer;
    let paraEl: HTMLElement | null = null;
    while (node) {
      if (node instanceof HTMLElement && node.dataset.paraIdx !== undefined) {
        paraEl = node;
        break;
      }
      node = node.parentNode;
    }

    if (!paraEl) {
      setSelectionPopup(null);
      return;
    }

    const paragraphIndex = Number(paraEl.dataset.paraIdx);
    const rect = range.getBoundingClientRect();
    const paperRect = articlePaperRef.current?.getBoundingClientRect();
    if (!paperRect) return;

    const maxTop = Math.max(8, paperRect.height - 140);
    const maxLeft = Math.max(12, paperRect.width - 292);
    setSelectionPopup({
      paragraphIndex,
      text: rawText.slice(0, 320),
      top: Math.max(8, Math.min(maxTop, rect.top - paperRect.top - 58)),
      left: Math.max(12, Math.min(maxLeft, rect.left - paperRect.left)),
    });
  };

  const handleAddHighlight = (color: HighlightColor) => {
    if (!selectionPopup) return;
    const item: ReaderHighlight = {
      id: `hl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      paragraphIndex: selectionPopup.paragraphIndex,
      text: selectionPopup.text,
      color,
      note: highlightNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const next = [...highlights, item];
    setHighlights(next);
    persistAnnotations(next, strokes);
    setSelectionPopup(null);
    setHighlightNote("");
    window.getSelection()?.removeAllRanges();
  };

  const handleRemoveHighlight = (hlId: string) => {
    const next = highlights.filter((h) => h.id !== hlId);
    setHighlights(next);
    persistAnnotations(next, strokes);
  };

  // Bookmark to Personal Knowledge Base / Share to Blog
  const handleReaderStateUpdate = async (patch: {
    bookmarked?: boolean;
    sharedToBlog?: boolean;
    toastText: string;
  }) => {
    if (!entry) return;
    setSavingAction(true);
    try {
      const res = await fetch(
        `/api/database/${encodeURIComponent(entry.id)}/reader-actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookmarked: patch.bookmarked,
            sharedToBlog: patch.sharedToBlog,
          }),
        }
      );
      if (res.ok) {
        const updated = (await res.json()) as CableEntry;
        setEntry(updated);
        setBookmarked(Boolean(updated.bookmarked));
        setSharedToBlog(Boolean(updated.sharedToBlog));
        setActionToast(patch.toastText);
        onCommentAdded();
      }
    } finally {
      setSavingAction(false);
    }
  };

  // Full-article translation via Gemini
  const handleTranslateFullArticle = async () => {
    if (!entry) return;
    setTranslating(true);
    setTranslationMsg(null);
    try {
      const res = await fetch(
        `/api/database/${encodeURIComponent(entry.id)}/full-article?translate=1`
      );
      const data = (await res.json().catch(() => ({}))) as {
        blocks?: FullArticleBlock[];
        sourceMode?: "live_full_article" | "rss_expanded_fallback";
        translationWarning?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "全文翻譯失敗");
      }
      if (data.blocks) {
        setBlocks(data.blocks);
        setShowTranslated(true);
      }
      if (data.translationWarning) {
        setTranslationMsg(data.translationWarning);
      } else {
        setTranslationMsg("已完成完整文章繁體中文翻譯對照。");
      }
    } catch (err) {
      setTranslationMsg(err instanceof Error ? err.message : "無法完成全文翻譯");
    } finally {
      setTranslating(false);
    }
  };

  // Add simple personal reading note
  const handleSavePersonalNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!entry || !noteInput.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(
        `/api/database/${encodeURIComponent(entry.id)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            author: "我的筆記",
            role: "閱讀心得",
            content: noteInput.trim(),
          }),
        }
      );
      if (res.ok) {
        const created = await res.json();
        setEntry((prev) =>
          prev
            ? {
                ...prev,
                comments: [...prev.comments, created],
                commentCount: prev.comments.length + 1,
              }
            : prev
        );
        setNoteInput("");
        onCommentAdded();
      }
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (commentId: string) => {
    if (!entry) return;
    const res = await fetch(
      `/api/database/${encodeURIComponent(entry.id)}/comments/${encodeURIComponent(commentId)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setEntry((prev) =>
        prev
          ? {
              ...prev,
              comments: prev.comments.filter((c) => c.id !== commentId),
              commentCount: Math.max(0, prev.comments.length - 1),
            }
          : prev
      );
      onCommentAdded();
    }
  };

  const displayBlocks = useMemo(() => {
    if (blocks.length > 0) return blocks;
    if (!entry) return [];
    const fallback: FullArticleBlock[] = [];
    if (entry.aiSummary) fallback.push({ type: "paragraph", text: entry.aiSummary });
    for (const k of entry.keyChanges || []) {
      fallback.push({ type: "paragraph", text: k });
    }
    if (entry.impactScope) {
      fallback.push({ type: "heading", text: "延伸背景與影響範圍" });
      fallback.push({ type: "paragraph", text: entry.impactScope });
    }
    return fallback;
  }, [blocks, entry]);

  const hasTranslations = useMemo(
    () => displayBlocks.some((b) => Boolean(b.translatedText)),
    [displayBlocks]
  );

  const fontSizeClass =
    fontSize === "sm"
      ? "text-[15px] leading-[1.78]"
      : fontSize === "lg"
        ? "text-[19px] leading-[1.9]"
        : "text-[17px] leading-[1.85]";

  if (loading) {
    return (
      <div className="max-w-[820px] mx-auto space-y-6">
        <div className="h-10 bg-[#F4F2EE] rounded" />
        <div className="h-56 w-full bg-[#F4F2EE] rounded-md" />
        <div className="h-96 bg-white border border-[#E9E9E7] rounded-md" />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="max-w-[820px] mx-auto bg-white border border-[#E9E9E7] rounded-md p-8 space-y-4">
        <p className="text-sm font-medium text-[#9B2C2C]">{error || "找不到該篇文章"}</p>
        <Link
          to="/database"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] hover:bg-[#EFEFEE]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>返回資料庫清單</span>
        </Link>
      </div>
    );
  }

  const sector = getEntrySector(entry);
  const sectorLabel = sector === "official" ? "官方機構" : "新聞媒體";
  const priorityLabel =
    entry.riskLevel === "high"
      ? "頭條焦點"
      : entry.riskLevel === "medium"
        ? "重點報導"
        : "一般快訊";

  return (
    <div className="max-w-[860px] mx-auto space-y-6 pb-16">
      {/* Sticky Reading Progress Bar & Reader Toolbar */}
      <div className="sticky top-12 z-20 -mx-2 sm:mx-0 bg-white/95 backdrop-blur-xs border border-[#E9E9E7] rounded-md overflow-hidden">
        {/* Compositor-animated progress track */}
        <div className="h-1 w-full bg-[#EFEFEE] overflow-hidden">
          <div
            className={`h-full w-full transition-colors duration-200 ${
              readingProgress >= 96 ? "bg-[#22643D]" : "bg-[#37352F]"
            }`}
            style={{
              transform: `scaleX(${readingProgress / 100})`,
              transformOrigin: "left",
            }}
          />
        </div>

        <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          {/* Left: Back + Progress readout */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate("/database");
                }
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#5A5852] hover:text-[#37352F] whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">返回</span>
            </button>

            <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-[#37352F] whitespace-nowrap shrink-0">
              <span>閱讀進度</span>
              <span
                className={
                  readingProgress >= 96 ? "font-semibold text-[#22643D]" : "font-semibold"
                }
              >
                {readingProgress}%
              </span>
            </div>
          </div>

          {/* Center: Highlighter & Freehand Pen Tools */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center p-0.5 bg-[#F4F2EE] border border-[#E9E9E7] rounded-[4px]">
              <button
                type="button"
                onClick={() => setToolMode("select")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-[3px] transition-colors whitespace-nowrap shrink-0 ${
                  toolMode === "select"
                    ? "bg-white text-[#37352F] font-medium shadow-2xs"
                    : "text-[#5A5852] hover:text-[#37352F]"
                }`}
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span>選字畫重點</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setToolMode("highlighter");
                  setSelectionPopup(null);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-[3px] transition-colors whitespace-nowrap shrink-0 ${
                  toolMode === "highlighter"
                    ? "bg-white text-[#37352F] font-medium shadow-2xs"
                    : "text-[#5A5852] hover:text-[#37352F]"
                }`}
              >
                <Highlighter className="w-3.5 h-3.5 text-[#A16207]" />
                <span>螢光畫筆</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setToolMode("pen");
                  setSelectionPopup(null);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-[3px] transition-colors whitespace-nowrap shrink-0 ${
                  toolMode === "pen"
                    ? "bg-white text-[#37352F] font-medium shadow-2xs"
                    : "text-[#5A5852] hover:text-[#37352F]"
                }`}
              >
                <PenTool className="w-3.5 h-3.5 text-[#B91C1C]" />
                <span>手繪畫筆</span>
              </button>
            </div>

            {toolMode === "pen" && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]">
                {PEN_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setPenColor(c.hex)}
                    title={c.label}
                    aria-label={c.label}
                    className={`w-4 h-4 rounded-full border transition-transform ${
                      penColor === c.hex
                        ? "border-[#37352F] scale-110 ring-1 ring-[#37352F]"
                        : "border-[#D3D1CB]"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
                <select
                  value={penWidth}
                  onChange={(e) => setPenWidth(Number(e.target.value))}
                  aria-label="畫筆粗細"
                  className="text-[11px] bg-transparent text-[#37352F] focus:outline-none pl-1"
                >
                  <option value={2}>細筆</option>
                  <option value={3}>中筆</option>
                  <option value={6}>粗筆</option>
                </select>
              </div>
            )}

            {toolMode === "highlighter" && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px]">
                {BRUSH_HIGHLIGHTER_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setBrushColor(c.hex)}
                    title={c.label}
                    aria-label={c.label}
                    className={`w-4 h-4 rounded-full border transition-transform ${
                      brushColor === c.hex
                        ? "border-[#37352F] scale-110 ring-1 ring-[#37352F]"
                        : "border-[#D3D1CB]"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
                <select
                  value={brushWidth}
                  onChange={(e) => setBrushWidth(Number(e.target.value))}
                  aria-label="螢光筆粗細"
                  className="text-[11px] bg-transparent text-[#37352F] focus:outline-none pl-1"
                >
                  <option value={12}>窄刷</option>
                  <option value={18}>標準</option>
                  <option value={26}>寬刷</option>
                </select>
              </div>
            )}

            {strokes.length > 0 && (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUndoStroke}
                  title="復原上一筆"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-[#E9E9E7] rounded-[4px] text-[#5A5852] hover:bg-[#EFEFEE] whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">復原</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearStrokes}
                  title="清除全部畫筆"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-[#E9E9E7] rounded-[4px] text-[#5A5852] hover:text-[#9B2C2C] hover:bg-[#FDF6F6] whitespace-nowrap shrink-0"
                >
                  <Eraser className="w-3 h-3" />
                  <span className="hidden sm:inline">清除</span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Bookmark + Share to Blog */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={savingAction}
              onClick={() =>
                handleReaderStateUpdate({
                  bookmarked: !bookmarked,
                  toastText: !bookmarked
                    ? "已將本篇文章收藏至個人知識庫。"
                    : "已從個人知識庫移除收藏。",
                })
              }
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-[4px] border transition-colors whitespace-nowrap shrink-0 ${
                bookmarked
                  ? "bg-[#EDF5F0] border-[#C7E0D0] text-[#22643D]"
                  : "bg-white border-[#E9E9E7] text-[#37352F] hover:bg-[#EFEFEE]"
              }`}
            >
              {bookmarked ? (
                <BookmarkCheck className="w-3.5 h-3.5" />
              ) : (
                <Bookmark className="w-3.5 h-3.5" />
              )}
              <span>{bookmarked ? "已收藏知識庫" : "收藏知識庫"}</span>
            </button>

            <button
              type="button"
              disabled={savingAction}
              onClick={() =>
                handleReaderStateUpdate({
                  sharedToBlog: true,
                  toastText: "已分享發佈至個人 Blog！",
                })
              }
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-[4px] border transition-colors whitespace-nowrap shrink-0 ${
                sharedToBlog
                  ? "bg-[#37352F] border-[#37352F] text-white"
                  : "bg-white border-[#E9E9E7] text-[#37352F] hover:bg-[#EFEFEE]"
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{sharedToBlog ? "已分享至 Blog" : "分享至 Blog"}</span>
            </button>
          </div>
        </div>
      </div>

      {actionToast && (
        <div className="px-4 py-2.5 bg-[#EDF5F0] border border-[#C7E0D0] rounded-[4px] flex flex-wrap items-center justify-between gap-2 text-xs text-[#22643D]">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{actionToast}</span>
          </span>
          <div className="flex items-center gap-3">
            {bookmarked && (
              <Link to="/database?bookmarked=1" className="underline hover:opacity-80">
                查看個人知識庫
              </Link>
            )}
            {sharedToBlog && (
              <Link to={`/blog/${entry.id}`} className="underline hover:opacity-80">
                前往個人 Blog 文章
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Main Editorial Reading Paper (with Highlight Selection + Canvas Overlay) */}
      <article
        ref={articlePaperRef}
        onMouseUp={handleArticleTextMouseUp}
        onTouchEnd={handleArticleTextMouseUp}
        className="relative bg-white border border-[#E9E9E7] rounded-md px-5 sm:px-10 py-7 sm:py-10 space-y-6 select-text"
      >
        {/* Freehand Pen & Highlighter Canvas Overlay */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          className={`absolute inset-0 w-full h-full z-10 rounded-md ${
            toolMode === "select"
              ? "pointer-events-none"
              : "pointer-events-auto cursor-crosshair touch-none"
          }`}
          aria-label="文章手繪畫筆與螢光標記畫布"
        />

        {/* Floating Text Highlight Palette (Appears on text selection in select mode) */}
        {selectionPopup && toolMode === "select" && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ top: selectionPopup.top, left: selectionPopup.left }}
            className="absolute z-30 bg-[#37352F] text-white rounded-[6px] shadow-lg px-3 py-2 flex flex-col gap-2 w-[280px]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-[#E9E9E7]">
                為選取段落畫上重點
              </span>
              <button
                type="button"
                onClick={() => setSelectionPopup(null)}
                className="text-[#9B9A97] hover:text-white"
                aria-label="關閉畫重點工具列"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={highlightNote}
              onChange={(e) => setHighlightNote(e.target.value)}
              placeholder="選填重點備註..."
              className="w-full px-2 py-1 text-xs bg-[#2A2823] border border-[#5A5852] rounded-[4px] text-white placeholder:text-[#9B9A97] focus:outline-none focus:border-white"
            />
            <div className="flex items-center justify-between gap-1.5">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleAddHighlight(c.id)}
                  className="flex-1 py-1 text-[11px] font-medium rounded-[4px] text-[#1C1917] hover:opacity-90 transition-opacity whitespace-nowrap"
                  style={{ backgroundColor: c.swatchHex }}
                >
                  {c.label.slice(0, 2)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quiet Editorial Metadata Header (Unboxed, Zero-Pill) */}
        <header className="space-y-4 border-b border-[#E9E9E7] pb-6 relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#787774]">
              <span className="inline-flex items-center gap-1.5 font-medium text-[#37352F]">
                <SafeSourceIcon
                  src={entry.sourceIcon}
                  url={entry.url}
                  category={entry.category}
                  alt={entry.sourceName}
                />
                <span>{entry.sourceName}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{entry.countryName}</span>
              <span aria-hidden="true">·</span>
              <span>{sectorLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{entry.category}</span>
              <span aria-hidden="true">·</span>
              <span>{priorityLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{formatDateTime(entry.publishedAt)}</span>
            </div>

            {/* Clean Font Size & Translation Controls */}
            <div className="flex flex-wrap items-center gap-2 relative z-20">
              <div className="inline-flex items-center border border-[#E9E9E7] rounded-[4px] bg-[#F7F6F3] p-0.5 text-[11px]">
                {(
                  [
                    { id: "sm", label: "小" },
                    { id: "md", label: "中" },
                    { id: "lg", label: "大" },
                  ] as const
                ).map((sz) => (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => setFontSize(sz.id)}
                    className={`px-2 py-0.5 rounded-[3px] whitespace-nowrap ${
                      fontSize === sz.id
                        ? "bg-white text-[#37352F] font-medium shadow-2xs"
                        : "text-[#787774] hover:text-[#37352F]"
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>

              {entry.originalLanguage !== "ZH" && (
                <button
                  type="button"
                  disabled={translating}
                  onClick={handleTranslateFullArticle}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] disabled:opacity-50 whitespace-nowrap"
                >
                  {translating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Languages className="w-3.5 h-3.5 text-[#5B3A7D]" />
                  )}
                  <span>{translating ? "翻譯全文中..." : "繁中翻譯全文"}</span>
                </button>
              )}

              {hasTranslations && (
                <button
                  type="button"
                  onClick={() => setShowTranslated((v) => !v)}
                  className="px-2.5 py-1 text-xs bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] text-[#5A5852] hover:text-[#37352F] whitespace-nowrap"
                >
                  {showTranslated ? "切換原文" : "顯示中文譯文"}
                </button>
              )}

              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] whitespace-nowrap"
              >
                <span>原文網頁</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1C1917] leading-snug text-balance">
            {entry.title}
          </h1>

          {entry.originalTitle && entry.originalTitle !== entry.title && (
            <p className="text-xs font-mono text-[#787774] leading-relaxed">
              原文標題：{entry.originalTitle}
            </p>
          )}

          {translationMsg && (
            <div className="p-2.5 bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] text-xs text-[#5A5852]">
              {translationMsg}
            </div>
          )}
        </header>

        {/* Real Source Banner Image (only if source provided a genuine image) */}
        <SafeBannerImage
          src={entry.bannerImage}
          alt={entry.title}
          category={entry.category}
          wrapperClassName="w-full h-48 sm:h-72 bg-[#F4F2EE] border border-[#E9E9E7] rounded-[4px] overflow-hidden"
          className="w-full h-full object-cover"
        />

        {/* Tool Hint Bar when Drawing Mode Active */}
        {toolMode !== "select" && (
          <div className="px-3 py-2 bg-[#FAF8F5] border border-[#E9E9E7] rounded-[4px] text-xs text-[#5A5852] flex items-center justify-between gap-2 relative z-20">
            <span>
              {toolMode === "highlighter"
                ? "螢光畫筆已啟用：直接在文章段落上拖曳即可刷出透明螢光標記。"
                : "手繪畫筆已啟用：可直接於文章頁面手寫批註、圈選或畫線。"}
            </span>
            <button
              type="button"
              onClick={() => setToolMode("select")}
              className="text-xs font-medium text-[#37352F] underline whitespace-nowrap shrink-0"
            >
              切回選字閱讀
            </button>
          </div>
        )}

        {/* Full-Length Article Reader Body */}
        <div className="space-y-5 max-w-prose mx-auto">
          {articleLoading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-xs text-[#787774]">
              <Loader2 className="w-5 h-5 animate-spin text-[#37352F]" />
              <span>正在從原始媒體載入完整文章內容...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] font-mono text-[#9B9A97] pb-1">
                <span>
                  {articleSourceMode === "live_full_article"
                    ? "完整報導正文閱讀模式"
                    : "完整公開資料內容模式"}
                </span>
                <span>共 {displayBlocks.length} 個段落 · 選取文字即可畫重點</span>
              </div>

              {displayBlocks.map((block, idx) => {
                const blockText =
                  showTranslated && block.translatedText
                    ? block.translatedText
                    : block.text;
                const paraHighlights = highlights.filter(
                  (h) => h.paragraphIndex === idx
                );

                if (block.type === "heading") {
                  return (
                    <h2
                      key={idx}
                      id={`para-${idx}`}
                      data-para-idx={idx}
                      className="text-lg sm:text-xl font-bold text-[#1C1917] pt-4 pb-1 border-b border-[#EFEFEE]"
                    >
                      {renderHighlightedParagraph(
                        blockText,
                        paraHighlights,
                        handleRemoveHighlight
                      )}
                    </h2>
                  );
                }

                if (block.type === "quote") {
                  return (
                    <blockquote
                      key={idx}
                      id={`para-${idx}`}
                      data-para-idx={idx}
                      className="my-5 py-4 px-5 border-y border-[#E9E9E7] bg-[#FAF9F6] text-[#292524] italic text-base sm:text-lg leading-relaxed"
                    >
                      {renderHighlightedParagraph(
                        blockText,
                        paraHighlights,
                        handleRemoveHighlight
                      )}
                    </blockquote>
                  );
                }

                return (
                  <p
                    key={idx}
                    id={`para-${idx}`}
                    data-para-idx={idx}
                    className={`${fontSizeClass} text-[#292524] tracking-[0.01em]`}
                  >
                    {renderHighlightedParagraph(
                      blockText,
                      paraHighlights,
                      handleRemoveHighlight
                    )}
                  </p>
                );
              })}

              {entry.keyChanges.length > 0 && articleSourceMode === "live_full_article" && (
                <div className="mt-8 pt-6 border-t border-[#E9E9E7] space-y-2.5">
                  <h3 className="text-sm font-semibold text-[#37352F]">本篇整理摘要重點</h3>
                  <ul className="space-y-2 text-sm text-[#5A5852] leading-relaxed">
                    {entry.keyChanges.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-mono text-xs text-[#9B9A97] mt-0.5 tabular-nums">
                          {String(i + 1).padStart(2, "0")}.
                        </span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Clean End-of-Article Reader Action Bar */}
        <footer className="pt-8 mt-8 border-t border-[#E9E9E7] flex flex-wrap items-center justify-between gap-3 relative z-20">
          <div className="text-xs text-[#787774]">
            閱讀進度{" "}
            <span className="font-mono font-semibold text-[#37352F] tabular-nums">
              {readingProgress}%
            </span>
            {highlights.length > 0 && ` · 已畫重點 ${highlights.length} 處`}
            {strokes.length > 0 && ` · 手繪筆跡 ${strokes.length} 筆`}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCompletionModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] whitespace-nowrap"
            >
              <Check className="w-3.5 h-3.5" />
              <span>完成閱讀 · 收藏或分享至 Blog</span>
            </button>

            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] whitespace-nowrap"
            >
              <span>前往原始網站</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </footer>
      </article>

      {/* Clean Saved Highlights & Personal Notes Section (No confusing dev jargon) */}
      <section
        aria-label="我的畫重點與個人閱讀筆記"
        className="bg-white border border-[#E9E9E7] rounded-md p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[#37352F] flex items-center gap-2">
            <Highlighter className="w-4 h-4 text-[#A16207]" />
            <span>我的畫重點標記與閱讀筆記</span>
          </h2>
          <span className="text-xs font-mono text-[#787774] tabular-nums">
            重點 {highlights.length} 則 · 手繪 {strokes.length} 筆
          </span>
        </div>

        {highlights.length === 0 ? (
          <p className="text-xs text-[#787774]">
            提示：在上方文章中直接拖曳選取任何句子，即可跳出黃／綠／藍／粉四色螢光畫重點；或切換上方「螢光畫筆 / 手繪畫筆」直接在頁面手寫圈註。
          </p>
        ) : (
          <div className="divide-y divide-[#E9E9E7] border border-[#E9E9E7] rounded-[4px]">
            {highlights.map((hl) => {
              const c = HIGHLIGHT_COLORS.find((x) => x.id === hl.color) || HIGHLIGHT_COLORS[0];
              return (
                <div
                  key={hl.id}
                  className="p-3.5 flex items-start justify-between gap-3 hover:bg-[#FBFBFA]"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.swatchHex }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          document
                            .getElementById(`para-${hl.paragraphIndex}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" })
                        }
                        className="text-left text-sm text-[#1C1917] leading-relaxed hover:underline"
                      >
                        「{hl.text}」
                      </button>
                    </div>
                    {hl.note && (
                      <p className="text-xs text-[#5A5852] pl-4">筆記：{hl.note}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveHighlight(hl.id)}
                    aria-label="移除重點標記"
                    className="text-[#9B9A97] hover:text-[#9B2C2C] p-1 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Simple Personal Note Box */}
        <div className="pt-4 border-t border-[#E9E9E7] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#37352F]">
            <MessageSquare className="w-3.5 h-3.5 text-[#787774]" />
            <span>閱讀心得記錄（{entry.comments.length}）</span>
          </div>

          {entry.comments.length > 0 && (
            <div className="space-y-2">
              {entry.comments.map((cmt) => (
                <div
                  key={cmt.id}
                  className="p-3 bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm text-[#37352F] whitespace-pre-wrap">{cmt.content}</p>
                    <div className="text-[11px] font-mono text-[#787774]">
                      {cmt.author} · {formatDateTime(cmt.createdAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(cmt.id)}
                    className="text-[#9B9A97] hover:text-[#9B2C2C] p-1 shrink-0"
                    aria-label="刪除筆記"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSavePersonalNote} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="寫下你對這篇文章的閱讀心得或重點想法..."
              className="flex-1 px-3 py-2 text-sm bg-[#FBFBFA] border border-[#E9E9E7] rounded-[4px] text-[#37352F] focus:outline-none focus:border-[#37352F]"
            />
            <button
              type="submit"
              disabled={submittingNote || !noteInput.trim()}
              className="px-4 py-2 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {submittingNote ? "儲存中..." : "儲存閱讀心得"}
            </button>
          </form>
        </div>
      </section>

      {/* Reading Completion Confirmation Modal */}
      {showCompletionModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="completion-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/45 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md bg-white border border-[#E9E9E7] rounded-md p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#22643D]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>閱讀進度 100% 完成</span>
                </div>
                <h2
                  id="completion-modal-title"
                  className="text-lg font-bold text-[#1C1917] leading-snug"
                >
                  要將這篇文章收藏或分享嗎？
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCompletionModal(false)}
                className="p-1 text-[#787774] hover:text-[#37352F] rounded-[4px]"
                aria-label="關閉確認視窗"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-[#F7F6F3] border border-[#E9E9E7] rounded-[4px] space-y-1.5">
              <div className="text-sm font-semibold text-[#37352F] line-clamp-2">
                {entry.title}
              </div>
              <div className="text-xs text-[#787774] font-mono tabular-nums">
                {entry.sourceName} · 已畫重點 {highlights.length} 處 · 手繪標記 {strokes.length} 筆
              </div>
            </div>

            <p className="text-xs text-[#5A5852] leading-relaxed">
              您可以選擇將本文永久收藏至「個人知識庫」以便日後查閱筆記，或是立即發佈分享至您的「個人 Blog」頁面與訂閱 RSS。
            </p>

            <div className="space-y-2">
              <button
                type="button"
                disabled={savingAction}
                onClick={async () => {
                  await handleReaderStateUpdate({
                    bookmarked: true,
                    sharedToBlog: true,
                    toastText: "已同時收藏至個人知識庫並分享發佈至 Blog！",
                  });
                  setShowCompletionModal(false);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium bg-[#37352F] text-white rounded-[4px] hover:bg-[#2F2D28] disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5" />
                <span>同時收藏至個人知識庫並分享至 Blog</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={savingAction}
                  onClick={async () => {
                    await handleReaderStateUpdate({
                      bookmarked: true,
                      toastText: "已收藏至個人知識庫！",
                    });
                    setShowCompletionModal(false);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] disabled:opacity-60 whitespace-nowrap"
                >
                  <BookmarkCheck className="w-3.5 h-3.5 text-[#22643D]" />
                  <span>{bookmarked ? "已在知識庫" : "收藏至知識庫"}</span>
                </button>

                <button
                  type="button"
                  disabled={savingAction}
                  onClick={async () => {
                    await handleReaderStateUpdate({
                      sharedToBlog: true,
                      toastText: "已分享發佈至個人 Blog！",
                    });
                    setShowCompletionModal(false);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-[#E9E9E7] rounded-[4px] text-[#37352F] hover:bg-[#EFEFEE] disabled:opacity-60 whitespace-nowrap"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#5B3A7D]" />
                  <span>{sharedToBlog ? "已分享至 Blog" : "分享至 Blog"}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowCompletionModal(false)}
                className="w-full py-2 text-xs text-[#787774] hover:text-[#37352F] transition-colors"
              >
                先不用，繼續留在文章頁面
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
