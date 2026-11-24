import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { CopyIcon, TrashIcon } from "./Icons";
import { measureItem, paintItem } from "./core";
import type { Item, PageInfo, TextData, InkData, Base } from "./core";

export type Patch = Partial<Base & Omit<TextData, "kind"> & Omit<InkData, "kind">>;

type ItemViewProps = {
  item: Item;
  scale: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Patch) => void;
  onBegin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  labels: { del: string; dup: string };
};

function ItemView({ item, scale, selected, onSelect, onChange, onBegin, onEdit, onDelete, onDuplicate, labels }: ItemViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const move = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const size = useRef<{ sx: number; w: number; v: number } | null>(null);
  const { w, h } = measureItem(item);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.max(1, Math.ceil(w * scale * dpr));
    c.height = Math.max(1, Math.ceil(h * scale * dpr));
    paintItem(c, item, scale * dpr, w, h);
  });

  return (
    <div
      className={"sg-item" + (selected ? " is-selected" : "")}
      style={{ left: item.x * scale, top: item.y * scale, width: w * scale, height: h * scale }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(item.id);
        onBegin();
        e.currentTarget.setPointerCapture(e.pointerId);
        move.current = { sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y };
      }}
      onPointerMove={(e) => {
        const m = move.current;
        if (!m) return;
        onChange(item.id, { x: m.ox + (e.clientX - m.sx) / scale, y: m.oy + (e.clientY - m.sy) / scale });
      }}
      onPointerUp={() => {
        move.current = null;
      }}
      onPointerCancel={() => {
        move.current = null;
      }}
      onDoubleClick={() => {
        if (item.kind === "text") onEdit();
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />
      {selected && (
        <div
          className={"sg-itembar" + (item.y * scale < 46 ? " is-below" : "")}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="sg-ibtn" title={labels.dup} aria-label={labels.dup} onClick={onDuplicate}>
            <CopyIcon />
          </button>
          <button type="button" className="sg-ibtn is-danger" title={labels.del} aria-label={labels.del} onClick={onDelete}>
            <TrashIcon />
          </button>
        </div>
      )}
      {selected && (
        <span
          className="sg-handle"
          onPointerDown={(e) => {
            e.stopPropagation();
            onBegin();
            e.currentTarget.setPointerCapture(e.pointerId);
            size.current = { sx: e.clientX, w: w * scale, v: item.kind === "text" ? item.size : item.scale };
          }}
          onPointerMove={(e) => {
            const s = size.current;
            if (!s) return;
            const f = Math.max(0.15, (s.w + (e.clientX - s.sx)) / s.w);
            if (item.kind === "text") onChange(item.id, { size: Math.min(300, Math.max(6, s.v * f)) });
            else onChange(item.id, { scale: Math.min(6, Math.max(0.05, s.v * f)) });
          }}
          onPointerUp={() => {
            size.current = null;
          }}
          onPointerCancel={() => {
            size.current = null;
          }}
        />
      )}
    </div>
  );
}

type PageProps = {
  doc: PDFDocumentProxy;
  index: number;
  info: PageInfo;
  scale: number;
  items: Item[];
  selectedId: string | null;
  placing: boolean;
  fontVersion: number;
  onPlace: (page: number, x: number, y: number) => void;
  onBackground: () => void;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Patch) => void;
  onBegin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  labels: { del: string; dup: string };
  onJobStart: () => void;
  onJobEnd: () => void;
  drawMode: boolean;
  drawColor: string;
  drawWidth: number;
  onDrawn: (page: number, pts: number[][]) => void;
};

export function PdfPage(props: PageProps) {
  const { doc, index, info, scale, items, selectedId, placing, onPlace, onBackground } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(index < 2);
  const [live, setLive] = useState<number[][]>([]);
  const liveRef = useRef<number[][] | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let task: RenderTask | null = null;
    let dead = false;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      props.onJobEnd();
    };
    props.onJobStart();
    (async () => {
      const page = await doc.getPage(index + 1);
      if (dead) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: scale * dpr });
      const buffer = document.createElement("canvas");
      buffer.width = Math.floor(vp.width);
      buffer.height = Math.floor(vp.height);
      task = page.render({ canvasContext: buffer.getContext("2d")!, viewport: vp });
      try {
        await task.promise;
      } catch {
        return;
      }
      if (dead) return;
      const c = canvasRef.current;
      if (!c) return;
      c.width = buffer.width;
      c.height = buffer.height;
      c.getContext("2d")!.drawImage(buffer, 0, 0);
    })().finally(end);
    return () => {
      dead = true;
      task?.cancel();
      end();
    };
  }, [doc, index, scale, visible]);

  return (
    <div className="sg-page-wrap">
      <div className="sg-page-label">
        {index + 1}
      </div>
      <div ref={wrapRef} className="sg-page" style={{ width: info.w * scale, height: info.h * scale }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        <div
          className={"sg-overlay" + (placing ? " is-placing" : "") + (props.drawMode ? " is-drawing" : "")}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const pt = [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
            if (props.drawMode) {
              e.currentTarget.setPointerCapture(e.pointerId);
              liveRef.current = [pt];
              setLive([pt]);
              return;
            }
            if (e.target !== e.currentTarget) return;
            if (placing) onPlace(index, pt[0], pt[1]);
            else onBackground();
          }}
          onPointerMove={(e) => {
            if (!liveRef.current) return;
            const r = e.currentTarget.getBoundingClientRect();
            liveRef.current.push([(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]);
            setLive(liveRef.current.slice());
          }}
          onPointerUp={() => {
            const pts = liveRef.current;
            liveRef.current = null;
            setLive([]);
            if (pts && pts.length) props.onDrawn(index, pts);
          }}
          onPointerCancel={() => {
            liveRef.current = null;
            setLive([]);
          }}
        >
          {live.length > 0 && (
            <svg className="sg-live" width={info.w * scale} height={info.h * scale} aria-hidden="true">
              {live.length === 1 ? (
                <circle cx={live[0][0] * scale} cy={live[0][1] * scale} r={(props.drawWidth * scale) / 2} fill={props.drawColor} />
              ) : (
                <polyline
                  points={live.map((q) => `${q[0] * scale},${q[1] * scale}`).join(" ")}
                  fill="none"
                  stroke={props.drawColor}
                  strokeWidth={props.drawWidth * scale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          )}
          {items.map((it) => (
            <ItemView
              key={it.id}
              item={it}
              scale={scale}
              selected={it.id === selectedId}
              onSelect={props.onSelect}
              onChange={props.onChange}
              onBegin={props.onBegin}
              onEdit={props.onEdit}
              onDelete={props.onDelete}
              onDuplicate={props.onDuplicate}
              labels={props.labels}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
