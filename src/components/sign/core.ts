export type Base = { id: string; page: number; x: number; y: number };

export type TextData = {
  kind: "text";
  text: string;
  font: string;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  outline: boolean;
  outlineColor: string;
  outlineWidth: number;
};

export type InkData = {
  kind: "ink";
  strokes: number[][][];
  sw: number;
  sh: number;
  scale: number;
  color: string;
  width: number;
  outline: boolean;
  outlineColor: string;
  outlineWidth: number;
};

export type Draft = TextData | InkData;
export type Item = Base & Draft;

export type PageInfo = { w: number; h: number; view: number[]; rotate: number };

export type FontDef = { name: string; group: "text" | "signature" };

export const FONTS: FontDef[] = [
  { name: "Bricolage Grotesque", group: "text" },
  { name: "Inter", group: "text" },
  { name: "Playfair Display", group: "text" },
  { name: "Lora", group: "text" },
  { name: "Courier Prime", group: "text" },
  { name: "Martian Mono", group: "text" },
  { name: "Caveat", group: "signature" },
  { name: "Dancing Script", group: "signature" },
  { name: "Great Vibes", group: "signature" },
  { name: "Allura", group: "signature" },
  { name: "Sacramento", group: "signature" },
  { name: "Homemade Apple", group: "signature" },
  { name: "Mrs Saint Delafield", group: "signature" },
];

export const SIGNATURE_FONTS = FONTS.filter((f) => f.group === "signature");

export const COLORS = ["#111111", "#14248a", "#0b6b3a", "#b91c1c", "#6d28d9", "#c2410c"];

export const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;1,400;1,700&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Lora:ital,wght@0,400;0,700;1,400;1,700&family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=Caveat:wght@400;700&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Allura&family=Sacramento&family=Homemade+Apple&family=Mrs+Saint+Delafield&display=swap";

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function fontSpec(d: TextData, size: number) {
  return `${d.italic ? "italic " : ""}${d.bold ? "700" : "400"} ${size}px "${d.font}", sans-serif`;
}

export function ensureFont(d: TextData) {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  return document.fonts.load(fontSpec(d, 40), d.text || "Aa").then(() => undefined).catch(() => undefined);
}

let measureCanvas: HTMLCanvasElement | null = null;

function measureCtx() {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  return measureCanvas.getContext("2d")!;
}

export function measureItem(d: Draft): { w: number; h: number } {
  if (d.kind === "ink") {
    const pad = (d.width + (d.outline ? d.outlineWidth * 2 : 0)) / 2;
    return { w: (d.sw + pad * 2) * d.scale, h: (d.sh + pad * 2) * d.scale };
  }
  const ctx = measureCtx();
  ctx.font = fontSpec(d, d.size);
  const lines = (d.text || " ").split("\n");
  let max = 0;
  for (const l of lines) max = Math.max(max, ctx.measureText(l || " ").width);
  const ow = d.outline ? d.outlineWidth : 0;
  const padX = d.size * 0.2 + ow;
  const padY = d.size * 0.3 + ow;
  return { w: max + padX * 2, h: lines.length * d.size * 1.25 + padY * 2 };
}

export function strokePath(ctx: CanvasRenderingContext2D, pts: number[][]) {
  ctx.beginPath();
  if (pts.length === 1) {
    ctx.arc(pts[0][0], pts[0][1], ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    return;
  }
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
}

export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: number[][][],
  color: string,
  width: number,
  outline: boolean,
  outlineColor: string,
  outlineWidth: number,
) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (outline) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = width + outlineWidth * 2;
    for (const s of strokes) if (s.length) strokePath(ctx, s);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  for (const s of strokes) if (s.length) strokePath(ctx, s);
}

export function renderItem(d: Draft, pxPerPt: number): HTMLCanvasElement {
  const { w, h } = measureItem(d);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(w * pxPerPt));
  canvas.height = Math.max(1, Math.ceil(h * pxPerPt));
  paintItem(canvas, d, pxPerPt, w, h);
  return canvas;
}

export function paintItem(canvas: HTMLCanvasElement, d: Draft, pxPerPt: number, w: number, h: number) {
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(canvas.width / w, canvas.height / h);
  if (d.kind === "ink") {
    const pad = (d.width + (d.outline ? d.outlineWidth * 2 : 0)) / 2;
    ctx.scale(d.scale, d.scale);
    ctx.translate(pad, pad);
    drawStrokes(ctx, d.strokes, d.color, d.width, d.outline, d.outlineColor, d.outlineWidth);
    return;
  }
  ctx.font = fontSpec(d, d.size);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  const ow = d.outline ? d.outlineWidth : 0;
  const padX = d.size * 0.2 + ow;
  const padY = d.size * 0.3 + ow;
  const lh = d.size * 1.25;
  const lines = (d.text || " ").split("\n");
  lines.forEach((line, i) => {
    const y = padY + lh * i + lh / 2;
    if (d.outline) {
      ctx.lineWidth = d.outlineWidth * 2;
      ctx.strokeStyle = d.outlineColor;
      ctx.strokeText(line, padX, y);
    }
    ctx.fillStyle = d.color;
    ctx.fillText(line, padX, y);
  });
}

export function strokesBounds(strokes: number[][][]) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of strokes)
    for (const p of s) {
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
  return { x0, y0, x1, y1 };
}

export function normalizeStrokes(strokes: number[][][], width: number) {
  const b = strokesBounds(strokes);
  const moved = strokes.map((s) => s.map((p) => [p[0] - b.x0, p[1] - b.y0]));
  return { strokes: moved, sw: Math.max(b.x1 - b.x0, 1), sh: Math.max(b.y1 - b.y0, 1) };
}

export function makeText(over: Partial<TextData> = {}): TextData {
  return {
    kind: "text",
    text: "Text",
    font: "Bricolage Grotesque",
    size: 16,
    color: "#111111",
    bold: false,
    italic: false,
    outline: false,
    outlineColor: "#ffffff",
    outlineWidth: 1.5,
    ...over,
  };
}
