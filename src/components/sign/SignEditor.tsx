import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { FONT_LINK, ensureFont, makeText, measureItem, normalizeStrokes, renderItem, strokesBounds, uid } from "./core";
import type { Draft, Item, PageInfo } from "./core";
import { exportSigned } from "./exportPdf";
import { makeT, useLang } from "./i18n";
import { DrawIcon, DateIcon, SigIcon, TextIcon, TrashIcon, UploadIcon } from "./Icons";
import { Inspector, Swatches } from "./Inspector";
import { PdfPage } from "./Page";
import type { Patch } from "./Page";
import { SignatureModal } from "./SignatureModal";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const MAX_BYTES = 60 * 1024 * 1024;
const TERMS_KEY = "ysc-sign-terms";

type Done = { blob: Blob; name: string };

function SigPreview({ draft }: { draft: Draft }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const src = renderItem(draft, 1.5);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const k = Math.min(c.width / src.width, c.height / src.height, 1.5);
    const w = src.width * k;
    const h = src.height * k;
    ctx.drawImage(src, (c.width - w) / 2, (c.height - h) / 2, w, h);
  });
  return <canvas ref={ref} width={240} height={72} className="sg-sigprev" />;
}

export default function SignEditor() {
  const lang = useLang();
  const t = useMemo(() => makeT(lang), [lang]);

  const [accepted, setAccepted] = useState(false);
  const [chosen, setChosen] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<Draft | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState("#111111");
  const [drawWidth, setDrawWidth] = useState(2.5);
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewerW, setViewerW] = useState(800);
  const [sigOpen, setSigOpen] = useState(false);
  const [mySigs, setMySigs] = useState<{ id: string; draft: Draft }[]>([]);
  const [fontVersion, setFontVersion] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [dirty, setDirty] = useState(false);
  const [openProg, setOpenProg] = useState<{ done: number; total: number } | null>(null);
  const [jobs, setJobs] = useState({ done: 0, total: 0 });

  const bytesRef = useRef<Uint8Array | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const past = useRef<Item[][]>([]);
  const lastSnap = useRef({ key: "", time: 0 });
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const selRef = useRef<string | null>(null);
  selRef.current = selectedId;
  const docRef = useRef<PDFDocumentProxy | null>(null);

  useEffect(() => {
    try {
      setAccepted(localStorage.getItem(TERMS_KEY) === "1");
    } catch {}
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_LINK;
    document.head.appendChild(link);
    const bump = () => setFontVersion((v) => v + 1);
    document.fonts?.addEventListener("loadingdone", bump);
    return () => document.fonts?.removeEventListener("loadingdone", bump);
  }, []);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewerW(el.clientWidth));
    ro.observe(el);
    setViewerW(el.clientWidth);
    return () => ro.disconnect();
  }, [doc]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const maxW = useMemo(() => pages.reduce((m, p) => Math.max(m, p.w), 1), [pages]);
  const scale = useMemo(() => Math.max(0.2, Math.min(2.4, (viewerW - 32) / maxW)) * zoom, [viewerW, maxW, zoom]);

  const onJobStart = useCallback(() => setJobs((j) => ({ ...j, total: j.total + 1 })), []);
  const onJobEnd = useCallback(
    () =>
      setJobs((j) => {
        const done = j.done + 1;
        return done >= j.total ? { done: 0, total: 0 } : { ...j, done };
      }),
    [],
  );

  const snap = useCallback((key: string) => {
    const now = Date.now();
    if (lastSnap.current.key === key && now - lastSnap.current.time < 1200) {
      lastSnap.current.time = now;
      return;
    }
    lastSnap.current = { key, time: now };
    past.current.push(itemsRef.current);
    if (past.current.length > 100) past.current.shift();
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    lastSnap.current = { key: "", time: 0 };
    setItems(prev);
    setSelectedId((id) => (id && prev.some((i) => i.id === id) ? id : null));
  }, []);

  const patchItem = useCallback((id: string, patch: Patch) => {
    setDirty(true);
    setDone(null);
    setItems((arr) => arr.map((i) => (i.id === id ? ({ ...i, ...patch } as Item) : i)));
    if (patch.font) {
      const cur = itemsRef.current.find((i) => i.id === id);
      if (cur && cur.kind === "text") void ensureFont({ ...cur, font: patch.font }).then(() => setFontVersion((v) => v + 1));
    }
  }, []);

  const removeSelected = useCallback(() => {
    const id = selRef.current;
    if (!id) return;
    snap("del" + Date.now());
    setItems((arr) => arr.filter((i) => i.id !== id));
    setSelectedId(null);
    setDirty(true);
  }, [snap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      if (e.key === "Escape") {
        setPending(null);
        setDrawMode(false);
        if (!typing) setSelectedId(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        undo();
        return;
      }
      if (typing) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const d: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (d[e.key]) {
        e.preventDefault();
        const id = selRef.current;
        const cur = id ? itemsRef.current.find((i) => i.id === id) : null;
        if (id && cur) {
          snap("nudge" + id);
          patchItem(id, { x: cur.x + d[e.key][0], y: cur.y + d[e.key][1] });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, removeSelected, snap, patchItem]);

  const selectFile = (file: File) => {
    setError("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError(t("notPdf"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t("tooBig"));
      return;
    }
    setChosen(file);
  };

  const openFile = async (file: File) => {
    if (!accepted) return;
    setError("");
    setLoading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const loaded = await pdfjs.getDocument({ data: bytes.slice() }).promise;
      const infos: PageInfo[] = [];
      setOpenProg({ done: 0, total: loaded.numPages });
      for (let i = 1; i <= loaded.numPages; i++) {
        const p = await loaded.getPage(i);
        setOpenProg({ done: i, total: loaded.numPages });
        const vp = p.getViewport({ scale: 1 });
        infos.push({ w: vp.width, h: vp.height, view: p.view as number[], rotate: p.rotate });
      }
      bytesRef.current = bytes;
      void docRef.current?.destroy();
      docRef.current = loaded;
      setDoc(loaded);
      setPages(infos);
      setItems([]);
      setSelectedId(null);
      setPending(null);
      setDone(null);
      setDirty(false);
      past.current = [];
      setZoom(1);
      setFileName(file.name);
    } catch {
      setError(t("loadFail"));
    } finally {
      setLoading(false);
      setOpenProg(null);
    }
  };

  const reset = () => {
    if (dirty && !window.confirm(t("leave"))) return;
    void docRef.current?.destroy();
    docRef.current = null;
    setDoc(null);
    bytesRef.current = null;
    setPages([]);
    setItems([]);
    setSelectedId(null);
    setPending(null);
    setDone(null);
    setDirty(false);
    setFileName("");
  };

  const arm = (d: Draft, key: string) => {
    setArmedKey(key);
    setDrawMode(false);
    void (d.kind === "text" ? ensureFont(d) : Promise.resolve()).then(() => setFontVersion((v) => v + 1));
    setSelectedId(null);
    setPending(d);
  };

  const armDate = () => {
    const text = new Date().toLocaleDateString(lang === "es" ? "es-AR" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    arm(makeText({ text, size: 14 }), "date");
  };

  const place = (page: number, cx: number, cy: number) => {
    if (!pending) return;
    const { w, h } = measureItem(pending);
    const info = pages[page];
    const x = Math.min(Math.max(0, cx - w / 2), Math.max(0, info.w - w));
    const y = Math.min(Math.max(0, cy - h / 2), Math.max(0, info.h - h));
    const item = { ...pending, id: uid(), page, x, y } as Item;
    snap("add" + item.id);
    setItems((arr) => [...arr, item]);
    setSelectedId(item.id);
    setPending(null);
    setDirty(true);
    setDone(null);
    if (item.kind === "text" && item.text === "Text") setTimeout(() => textRef.current?.select(), 30);
  };

  const startDraw = () => {
    setPending(null);
    setSelectedId(null);
    setDrawMode((m) => !m);
  };

  const onDrawn = (page: number, pts: number[][]) => {
    const n = normalizeStrokes([pts], drawWidth);
    const b = strokesBounds([pts]);
    const half = drawWidth / 2;
    const item: Item = {
      id: uid(),
      page,
      x: b.x0 - half,
      y: b.y0 - half,
      kind: "ink",
      strokes: n.strokes,
      sw: n.sw,
      sh: n.sh,
      scale: 1,
      color: drawColor,
      width: drawWidth,
      outline: false,
      outlineColor: "#ffffff",
      outlineWidth: 2,
    };
    snap("draw" + item.id);
    setItems((arr) => [...arr, item]);
    setDirty(true);
    setDone(null);
  };

  const useSignature = (d: Draft) => {
    setSigOpen(false);
    const id = uid();
    setMySigs((s) => [...s, { id, draft: d }]);
    arm(d, "sig:" + id);
  };

  const duplicate = () => {
    const cur = items.find((i) => i.id === selectedId);
    if (!cur) return;
    snap("dup" + Date.now());
    const copy = { ...cur, id: uid(), x: cur.x + 12, y: cur.y + 12 } as Item;
    setItems((arr) => [...arr, copy]);
    setSelectedId(copy.id);
    setDirty(true);
  };

  const copyToAll = () => {
    const cur = items.find((i) => i.id === selectedId);
    if (!cur) return;
    snap("all" + Date.now());
    const extra: Item[] = [];
    pages.forEach((_, idx) => {
      if (idx !== cur.page) extra.push({ ...cur, id: uid(), page: idx } as Item);
    });
    setItems((arr) => [...arr, ...extra]);
    setDirty(true);
  };

  const download = async () => {
    if (!bytesRef.current || !items.length) return;
    setExporting(true);
    setError("");
    try {
      const out = await exportSigned(bytesRef.current, pages, items);
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const base = fileName.replace(/\.pdf$/i, "") || "document";
      const name = `${base}-signed.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setDone({ blob, name });
      setDirty(false);
    } catch {
      setError(t("exportFail"));
    } finally {
      setExporting(false);
    }
  };

  const armed = pending ? armedKey : null;
  const selected = items.find((i) => i.id === selectedId) ?? null;

  if (!doc) {
    return (
      <div className="sg-drop-wrap">
        <label
          className={"sg-drop" + (dragOver ? " is-over" : "") + (loading ? " is-loading" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) selectFile(f);
          }}
        >
          <input
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) selectFile(f);
              e.target.value = "";
            }}
          />
          <span className="sg-drop-icon"><UploadIcon /></span>
          <span className="sg-drop-title">{loading ? t("loading") : chosen ? chosen.name : t("dropTitle")}</span>
          <span className="sg-drop-sub">{chosen ? t("chosenSub") : t("dropSub")}</span>
          {loading && (
            <span className="sg-bar" aria-hidden="true">
              <span style={{ width: `${openProg ? Math.round((openProg.done / openProg.total) * 100) : 4}%` }} />
            </span>
          )}
          <span className={"sg-btn" + (chosen ? " sg-btn-ghost" : "")}>{chosen ? t("changeFile") : t("choose")}</span>
        </label>
        <label className="sg-check sg-accept">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => {
              setAccepted(e.target.checked);
              try {
                localStorage.setItem(TERMS_KEY, e.target.checked ? "1" : "0");
              } catch {}
            }}
          />
          <span>
            {t("acceptPre")}{" "}
            <a href="/sign/terms" target="_blank" rel="noopener">
              {t("acceptLink")}
            </a>
          </span>
        </label>
        <button type="button" className="sg-btn sg-continue" disabled={!chosen || !accepted || loading} onClick={() => chosen && void openFile(chosen)}>
          {t("continue")} →
        </button>
        {chosen && !accepted && <p className="sg-muted sg-center">{t("needAccept")}</p>}
        <p className="sg-privacy">◆ {t("privacyNote")}</p>
        {error && <p className="sg-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="sg-work">
      <aside className="sg-side">
        <div className="sg-side-head">
          <span className="sg-file" title={fileName}>
            {fileName}
          </span>
          <button type="button" className="sg-chip" onClick={reset}>
            {t("newFile")}
          </button>
        </div>

        <div className="sg-tools">
          <button type="button" className="sg-tool" onClick={() => setSigOpen(true)}>
            <SigIcon />
            {t("signature")}
          </button>
          <button type="button" className={"sg-tool" + (drawMode ? " is-armed" : "")} aria-pressed={drawMode} onClick={startDraw}>
            <DrawIcon />
            {t("drawTool")}
          </button>
          <button type="button" className={"sg-tool" + (armed === "text" ? " is-armed" : "")} aria-pressed={armed === "text"} onClick={() => arm(makeText(), "text")}>
            <TextIcon />
            {t("text")}
          </button>
          <button type="button" className={"sg-tool" + (armed === "date" ? " is-armed" : "")} aria-pressed={armed === "date"} onClick={armDate}>
            <DateIcon />
            {t("date")}
          </button>
        </div>

        {drawMode && (
          <div className="sg-armed" role="status" aria-live="polite">
            <strong>{t("drawTitle")}</strong>
            <p>{t("drawBody")}</p>
            <Swatches value={drawColor} onPick={setDrawColor} />
            <label className="sg-field" style={{ width: "100%" }}>
              <span>
                {t("thickness")} · {drawWidth.toFixed(1)}
              </span>
              <input type="range" min={0.5} max={10} step={0.5} value={drawWidth} onChange={(e) => setDrawWidth(Number(e.target.value))} />
            </label>
            <button type="button" className="sg-btn" onClick={() => setDrawMode(false)}>
              {t("drawDone")}
            </button>
          </div>
        )}

        {pending && (
          <div className="sg-armed" role="status" aria-live="polite">
            <strong>{t("armedTitle")}</strong>
            <p>{t("armedBody")}</p>
            <button type="button" className="sg-chip" onClick={() => setPending(null)}>
              {t("cancel")} · Esc
            </button>
          </div>
        )}

        <div className="sg-row sg-row-wrap sg-viewbar">
          <button type="button" className="sg-chip" onClick={undo}>
            ↶ {t("undo")}
          </button>
          <span className="sg-zoom">
            <button type="button" className="sg-chip" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} aria-label="−">
              −
            </button>
            <button type="button" className="sg-chip" onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" className="sg-chip" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))} aria-label="+">
              +
            </button>
          </span>
        </div>

        {mySigs.length > 0 && (
          <div className="sg-block">
            <div className="sg-label">{t("mySignatures")}</div>
            <div className="sg-sigs">
              {mySigs.map((s) => (
                <div key={s.id} className={"sg-sigrow" + (armed === "sig:" + s.id ? " is-armed" : "")}>
                  <button type="button" className="sg-sigbtn" aria-pressed={armed === "sig:" + s.id} onClick={() => arm(s.draft, "sig:" + s.id)}>
                    <SigPreview draft={s.draft} />
                    {armed === "sig:" + s.id && <span className="sg-sigbadge">✓ {t("selectedBadge")}</span>}
                  </button>
                  <button
                    type="button"
                    className="sg-x"
                    aria-label={t("remove")}
                    onClick={() => setMySigs((arr) => arr.filter((a) => a.id !== s.id))}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sg-block">
          <div className="sg-label">{t("properties")}</div>
          <Inspector
            item={selected}
            t={t}
            textRef={textRef}
            onChange={(patch, key) => {
              if (selected) {
                snap(key + selected.id);
                patchItem(selected.id, patch);
              }
            }}
            onDuplicate={duplicate}
            onAllPages={copyToAll}
            onDelete={removeSelected}
          />
        </div>

        <div className="sg-block sg-download">
          <button type="button" className="sg-btn sg-btn-block" onClick={download} disabled={!items.length || exporting}>
            {exporting ? t("exporting") : `↓ ${t("download")}`}
          </button>
          {!items.length && <p className="sg-muted">{t("emptyNote")}</p>}
          {error && <p className="sg-error">{error}</p>}
          {done && (
            <div className="sg-done">
              <strong>✓ {t("doneTitle")}</strong>
              <p>{t("doneBody")}</p>
            </div>
          )}
        </div>
      </aside>

      <div className="sg-viewer" ref={viewerRef}>
        {jobs.total > 0 && (
          <div className="sg-loader" role="status">
            <div className="sg-loader-top">
              <span>{t("renderingPages")}</span>
              <b>{Math.round((jobs.done / jobs.total) * 100)}%</b>
            </div>
            <span className="sg-bar" aria-hidden="true">
              <span style={{ width: `${Math.round((jobs.done / jobs.total) * 100)}%` }} />
            </span>
            <small>{t("renderingNote")}</small>
          </div>
        )}
        {pending && <div className="sg-hint">{t("placeHint")}</div>}
        {drawMode && <div className="sg-hint">{t("drawHint")}</div>}
        <div className="sg-pages">
          {pages.map((info, i) => (
            <PdfPage
              key={i}
              doc={doc}
              index={i}
              info={info}
              scale={scale}
              items={items.filter((it) => it.page === i)}
              selectedId={selectedId}
              placing={!!pending}
              fontVersion={fontVersion}
              onPlace={place}
              onBackground={() => setSelectedId(null)}
              onSelect={setSelectedId}
              onChange={patchItem}
              onBegin={() => snap("drag" + Date.now())}
              onEdit={() => textRef.current?.focus()}
              onDelete={removeSelected}
              onDuplicate={duplicate}
              labels={{ del: t("delete"), dup: t("duplicate") }}
              drawMode={drawMode}
              drawColor={drawColor}
              drawWidth={drawWidth}
              onDrawn={onDrawn}
              onJobStart={onJobStart}
              onJobEnd={onJobEnd}
            />
          ))}
        </div>
      </div>

      <SignatureModal open={sigOpen} t={t} onClose={() => setSigOpen(false)} onUse={useSignature} />
    </div>
  );
}
