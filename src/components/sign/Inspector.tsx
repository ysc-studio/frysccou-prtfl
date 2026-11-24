import type { RefObject } from "react";
import { CopyIcon, TrashIcon } from "./Icons";
import { COLORS, FONTS } from "./core";
import type { Item } from "./core";
import type { Patch } from "./Page";
import type { Key } from "./i18n";

type Props = {
  item: Item | null;
  t: (k: Key) => string;
  textRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (patch: Patch, key: string) => void;
  onDuplicate: () => void;
  onAllPages: () => void;
  onDelete: () => void;
};

export function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="sg-swatches">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={"sg-swatch" + (value.toLowerCase() === c ? " is-on" : "")}
          style={{ background: c }}
          aria-label={c}
          onClick={() => onPick(c)}
        />
      ))}
      <label className="sg-swatch sg-swatch-custom" title="custom">
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} />
      </label>
    </div>
  );
}

export function Inspector({ item, t, textRef, onChange, onDuplicate, onAllPages, onDelete }: Props) {
  if (!item) return <p className="sg-muted">{t("selectHint")}</p>;
  const set = (patch: Patch, key: string) => onChange(patch, key);
  return (
    <div className="sg-inspector">
      {item.kind === "text" && (
        <>
          <label className="sg-field">
            <span>{t("content")}</span>
            <textarea
              ref={textRef}
              rows={2}
              value={item.text}
              onChange={(e) => set({ text: e.target.value }, "text")}
            />
          </label>
          <label className="sg-field">
            <span>{t("font")}</span>
            <select value={item.font} onChange={(e) => set({ font: e.target.value }, "font")}>
              <optgroup label={t("fontText")}>
                {FONTS.filter((f) => f.group === "text").map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t("fontSig")}>
                {FONTS.filter((f) => f.group === "signature").map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="sg-field">
            <span>
              {t("size")} · {Math.round(item.size)}
            </span>
            <input
              type="range"
              min={6}
              max={120}
              step={1}
              value={Math.min(120, item.size)}
              onChange={(e) => set({ size: Number(e.target.value) }, "size")}
            />
          </label>
          <div className="sg-row">
            <button
              type="button"
              className={"sg-chip" + (item.bold ? " is-on" : "")}
              onClick={() => set({ bold: !item.bold }, "bold" + Date.now())}
            >
              <b>B</b> {t("bold")}
            </button>
            <button
              type="button"
              className={"sg-chip" + (item.italic ? " is-on" : "")}
              onClick={() => set({ italic: !item.italic }, "italic" + Date.now())}
            >
              <i>I</i> {t("italic")}
            </button>
          </div>
        </>
      )}
      {item.kind === "ink" && (
        <label className="sg-field">
          <span>
            {t("thickness")} · {item.width.toFixed(1)}
          </span>
          <input
            type="range"
            min={0.5}
            max={16}
            step={0.5}
            value={item.width}
            onChange={(e) => set({ width: Number(e.target.value) }, "width")}
          />
        </label>
      )}
      <div className="sg-field">
        <span>{t("color")}</span>
        <Swatches value={item.color} onPick={(c) => set({ color: c }, "color")} />
      </div>
      <label className="sg-check">
        <input type="checkbox" checked={item.outline} onChange={(e) => set({ outline: e.target.checked }, "outline" + Date.now())} />
        <span>{t("outline")}</span>
      </label>
      {item.outline && (
        <>
          <div className="sg-field">
            <span>{t("outline")} · {t("color")}</span>
            <Swatches value={item.outlineColor} onPick={(c) => set({ outlineColor: c }, "ocolor")} />
          </div>
          <label className="sg-field">
            <span>
              {t("outlineWidth")} · {item.outlineWidth.toFixed(1)}
            </span>
            <input
              type="range"
              min={0.25}
              max={8}
              step={0.25}
              value={item.outlineWidth}
              onChange={(e) => set({ outlineWidth: Number(e.target.value) }, "owidth")}
            />
          </label>
        </>
      )}
      <div className="sg-row sg-row-wrap">
        <button type="button" className="sg-chip" onClick={onDuplicate}>
          <CopyIcon />
          {t("duplicate")}
        </button>
        <button type="button" className="sg-chip" onClick={onAllPages}>
          {t("allPages")}
        </button>
        <button type="button" className="sg-chip sg-danger" onClick={onDelete}>
          <TrashIcon />
          {t("delete")}
        </button>
      </div>
    </div>
  );
}
