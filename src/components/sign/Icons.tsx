const A = "var(--acc)";

export function SigIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 14.5C4.5 5.5 8.5 5.5 9 11.5S12 18 14 11 17.5 8 18.5 12.5L21.5 11" stroke={A} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      {[2.5, 6.5, 10.5, 14.5, 18.5].map((x) => (
        <rect key={x} x={x} y="19" width="2" height="2" fill="currentColor" opacity=".55" />
      ))}
    </svg>
  );
}

export function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {[2.5, 6.5, 10.5, 14.5, 18.5].map((x) => (
        <rect key={x} x={x} y="3" width="3" height="3" fill={A} />
      ))}
      {[7, 11, 15, 19].map((y) => (
        <rect key={y} x="10.5" y={y} width="3" height="3" fill="currentColor" opacity=".7" />
      ))}
    </svg>
  );
}

export function DateIcon() {
  const cells = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const on = r === 1 && c === 2;
      cells.push(<rect key={r + "" + c} x={3 + c * 7} y={3 + r * 7} width="4.5" height="4.5" fill={on ? A : "currentColor"} opacity={on ? 1 : 0.4} />);
    }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {cells}
    </svg>
  );
}

export function UploadIcon() {
  const sq = (x: number, y: number, fill: string, o = 1) => <rect key={x + "-" + y} x={x} y={y} width="3" height="3" fill={fill} opacity={o} />;
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" fill="none" aria-hidden="true">
      {sq(22.5, 6, A)}
      {sq(18.5, 10, A)}
      {sq(26.5, 10, A)}
      {sq(14.5, 14, A)}
      {sq(30.5, 14, A)}
      {[14, 18, 22, 26].map((y) => sq(22.5, y, A))}
      {[10.5, 14.5, 18.5, 22.5, 26.5, 30.5, 34.5].map((x) => sq(x, 36, "currentColor", 0.55))}
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6.5 7l.8 12.5h9.4L17.5 7" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </svg>
  );
}

export function DrawIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" opacity=".6" />
      <path d="M7.5 12.5l3 3.2 6-7.4" stroke={A} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
