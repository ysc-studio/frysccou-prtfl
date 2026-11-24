import { useEffect, useRef, useState } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import { COLORS, SIGNATURE_FONTS, drawStrokes, ensureFont, makeText, normalizeStrokes } from "./core";
import type { Draft } from "./core";
import type { Key } from "./i18n";

const PAD_W = 600;
const PAD_H = 220;

type Props = {
  open: boolean;
  t: (k: Key) => string;
  onClose: () => void;
  onUse: (d: Draft) => void;
};

export function SignatureModal({ open, t, onClose, onUse }: Props) {
  const [tab, setTab] = useState<"draw" | "type">("draw");
  const [strokes, setStrokes] = useState<number[][][]>([]);
  const [color, setColor] = useState("#14248a");
  const [width, setWidth] = useState(4);
  const [name, setName] = useState("");
  const [font, setFont] = useState(SIGNATURE_FONTS[0].name);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || tab !== "draw") return;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.scale(c.width / PAD_W, c.height / PAD_H);
    drawStrokes(ctx, strokes, color, width, false, "#ffffff", 0);
  }, [strokes, color, width, tab, open]);

  if (!open) return null;

  const point = (e: RPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) * PAD_W) / r.width, ((e.clientY - r.top) * PAD_H) / r.height];
  };

  const canUse = tab === "draw" ? strokes.length > 0 : name.trim().length > 0;

  const use = () => {
    if (!canUse) return;
    if (tab === "draw") {
      const n = normalizeStrokes(strokes, width);
      const scale = Math.min(1.5, Math.max(0.1, 150 / (n.sw + width)));
      onUse({
        kind: "ink",
        strokes: n.strokes,
        sw: n.sw,
        sh: n.sh,
        scale,
        color,
        width,
        outline: false,
        outlineColor: "#ffffff",
        outlineWidth: 2,
      });
    } else {
      const d = makeText({ text: name.trim(), font, size: 34, color });
      void ensureFont(d);
      onUse(d);
    }
  };

  return (
    <div className="sg-modal" role="dialog" aria-modal="true" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sg-modal-card">
        <div className="sg-modal-head">
          <span>{t("sigTitle")}</span>
          <button type="button" className="sg-x" onClick={onClose} aria-label={t("close")}>
            ✕
          </button>
        </div>
        <div className="sg-tabs">
          <button type="button" className={tab === "draw" ? "is-on" : ""} onClick={() => setTab("draw")}>
            {t("draw")}
          </button>
          <button type="button" className={tab === "type" ? "is-on" : ""} onClick={() => setTab("type")}>
            {t("type")}
          </button>
        </div>

        {tab === "draw" ? (
          <>
            <div className="sg-pad">
              <canvas
                ref={canvasRef}
                width={PAD_W * 2}
                height={PAD_H * 2}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drawing.current = true;
                  const p = point(e);
                  setStrokes((s) => [...s, [p]]);
                }}
                onPointerMove={(e) => {
                  if (!drawing.current) return;
                  const p = point(e);
                  setStrokes((s) => {
                    const c = s.slice();
                    c[c.length - 1] = [...c[c.length - 1], p];
                    return c;
                  });
                }}
                onPointerUp={() => {
                  drawing.current = false;
                }}
                onPointerCancel={() => {
                  drawing.current = false;
                }}
              />
              {strokes.length === 0 && <span className="sg-pad-hint">{t("drawHere")}</span>}
              <span className="sg-pad-line" />
            </div>
            <div className="sg-row sg-row-wrap">
              <div className="sg-swatches">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={"sg-swatch" + (color === c ? " is-on" : "")}
                    style={{ background: c }}
                    aria-label={c}
                    onClick={() => setColor(c)}
                  />
                ))}
                <label className="sg-swatch sg-swatch-custom">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                </label>
              </div>
              <label className="sg-field sg-grow">
                <span>
                  {t("thickness")} · {width}
                </span>
                <input type="range" min={1} max={12} step={0.5} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
              </label>
            </div>
            <div className="sg-row">
              <button type="button" className="sg-chip" onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length}>
                {t("undoStroke")}
              </button>
              <button type="button" className="sg-chip" onClick={() => setStrokes([])} disabled={!strokes.length}>
                {t("clear")}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="sg-field">
              <span>{t("typeName")}</span>
              <input type="text" value={name} placeholder={t("namePlaceholder")} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <div className="sg-field">
              <span>{t("style")}</span>
              <div className="sg-fontgrid">
                {SIGNATURE_FONTS.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    className={"sg-fontbtn" + (font === f.name ? " is-on" : "")}
                    style={{ fontFamily: `"${f.name}", cursive`, color }}
                    onClick={() => setFont(f.name)}
                  >
                    {name.trim() || t("namePlaceholder")}
                  </button>
                ))}
              </div>
            </div>
            <div className="sg-swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={"sg-swatch" + (color === c ? " is-on" : "")}
                  style={{ background: c }}
                  aria-label={c}
                  onClick={() => setColor(c)}
                />
              ))}
              <label className="sg-swatch sg-swatch-custom">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </label>
            </div>
          </>
        )}

        <div className="sg-modal-foot">
          <button type="button" className="sg-btn sg-btn-ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="button" className="sg-btn" onClick={use} disabled={!canUse}>
            {t("useSig")} →
          </button>
        </div>
      </div>
    </div>
  );
}
