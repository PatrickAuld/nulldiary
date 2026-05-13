/**
 * Tiny dependency-free SVG sparkline. Renders one or more series stacked
 * with optional baseline reference line. Intentionally minimal — no axes,
 * no tooltips, no animations. Accessibility: title element shows the
 * highest bucket count.
 */
interface Series {
  values: number[];
  color: string;
}

interface Props {
  series: Series[];
  baseline?: number;
  width?: number;
  height?: number;
  /** Aria label, also used in the embedded <title>. */
  label: string;
}

export function Sparkline({
  series,
  baseline,
  width = 240,
  height = 48,
  label,
}: Props) {
  const all = series.flatMap((s) => s.values);
  const max = Math.max(1, baseline ?? 0, ...all);
  const stepX = series[0]?.values.length
    ? width / Math.max(1, series[0].values.length - 1)
    : width;
  const y = (v: number) => height - (v / max) * height;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className="spark"
    >
      <title>{label}</title>
      {baseline != null && baseline > 0 && (
        <line
          x1={0}
          x2={width}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke="var(--text-muted)"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
      )}
      {series.map((s, idx) => {
        if (s.values.length === 0) return null;
        const points = s.values
          .map((v, i) => `${(i * stepX).toFixed(2)},${y(v).toFixed(2)}`)
          .join(" ");
        return (
          <polyline
            key={idx}
            fill="none"
            stroke={s.color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={points}
          />
        );
      })}
    </svg>
  );
}
