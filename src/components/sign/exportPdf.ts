import { PDFDocument, degrees } from "pdf-lib";
import { ensureFont, measureItem, renderItem } from "./core";
import type { Item, PageInfo } from "./core";

const EXPORT_DENSITY = 4;

function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("png"));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
}

function cacheKey(it: Item) {
  const { id, page, x, y, ...rest } = it;
  return JSON.stringify(rest);
}

function place(info: PageInfo, x: number, y: number, w: number, h: number) {
  const [x0, y0, x1, y1] = info.view;
  const W = x1 - x0;
  const H = y1 - y0;
  const r = (((info.rotate % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  if (r === 90) return { x: y + h + x0, y: x + y0, angle: 90 };
  if (r === 180) return { x: W - x + x0, y: y + h + y0, angle: 180 };
  if (r === 270) return { x: W - y - h + x0, y: H - x + y0, angle: 270 };
  return { x: x + x0, y: H - y - h + y0, angle: 0 };
}

export async function exportSigned(bytes: Uint8Array, pages: PageInfo[], items: Item[]): Promise<Uint8Array> {
  for (const it of items) if (it.kind === "text") await ensureFont(it);

  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pdfPages = pdf.getPages();
  const cache = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();

  for (const it of items) {
    const page = pdfPages[it.page];
    const info = pages[it.page];
    if (!page || !info) continue;
    const key = cacheKey(it);
    let img = cache.get(key);
    if (!img) {
      img = await pdf.embedPng(await canvasToPng(renderItem(it, EXPORT_DENSITY)));
      cache.set(key, img);
    }
    const { w, h } = measureItem(it);
    const p = place(info, it.x, it.y, w, h);
    page.drawImage(img, { x: p.x, y: p.y, width: w, height: h, rotate: degrees(p.angle) });
  }

  return pdf.save();
}
