import React, { useState } from 'react';

interface DayRunData {
  date: string;
  dayLabel: string;
  runs: number;
  successCount: number;
}

interface RunsLineChartProps {
  data: DayRunData[];
}

export const RunsLineChart: React.FC<RunsLineChartProps> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-app-text-muted">
        No execution data available
      </div>
    );
  }

  // Chart dimensions & margins
  const viewBoxWidth = 600;
  const viewBoxHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 24;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = viewBoxWidth - paddingLeft - paddingRight;
  const chartHeight = viewBoxHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(...data.map((d) => d.runs), 10);
  // Round up maxVal to a clean step
  const yMax = Math.ceil(maxVal / 10) * 10;
  const yMid = Math.round(yMax / 2);

  // Compute points
  const points = data.map((d, i) => {
    const x = paddingLeft + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.runs / yMax) * chartHeight;
    return { x, y, ...d };
  });

  // Construct SVG Path
  const linePath = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    // smooth curve using cubic bezier control points
    const prev = points[i - 1];
    const cp1x = prev.x + (p.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (p.x - prev.x) / 2;
    const cp2y = p.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
  }, '');

  // Area path for gradient fill
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x} ${paddingTop + chartHeight} L ${firstPoint.x} ${
    paddingTop + chartHeight
  } Z`;

  return (
    <div className="w-full relative select-none">
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-auto overflow-visible"
      >
        <defs>
          <linearGradient id="runsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft + chartWidth}
          y2={paddingTop}
          stroke="var(--border)"
          strokeDasharray="3 3"
          strokeOpacity="0.6"
        />
        <text
          x={paddingLeft - 8}
          y={paddingTop + 4}
          textAnchor="end"
          fontSize="10"
          className="fill-app-text-muted font-mono"
        >
          {yMax}
        </text>

        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight / 2}
          x2={paddingLeft + chartWidth}
          y2={paddingTop + chartHeight / 2}
          stroke="var(--border)"
          strokeDasharray="3 3"
          strokeOpacity="0.6"
        />
        <text
          x={paddingLeft - 8}
          y={paddingTop + chartHeight / 2 + 4}
          textAnchor="end"
          fontSize="10"
          className="fill-app-text-muted font-mono"
        >
          {yMid}
        </text>

        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={paddingLeft + chartWidth}
          y2={paddingTop + chartHeight}
          stroke="var(--border)"
        />
        <text
          x={paddingLeft - 8}
          y={paddingTop + chartHeight + 4}
          textAnchor="end"
          fontSize="10"
          className="fill-app-text-muted font-mono"
        >
          0
        </text>

        {/* Gradient Area */}
        <path d={areaPath} fill="url(#runsGradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive Points */}
        {points.map((p, index) => {
          const isHovered = hoveredIndex === index;
          return (
            <g
              key={index}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              {/* Invisible larger hit target */}
              <circle cx={p.x} cy={p.y} r="14" fill="transparent" />

              {/* Point dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? '6' : '4'}
                fill="var(--surface)"
                stroke="var(--accent)"
                strokeWidth={isHovered ? '3' : '2'}
                className="transition-all duration-150"
              />

              {/* X Axis Labels */}
              <text
                x={p.x}
                y={paddingTop + chartHeight + 18}
                textAnchor="middle"
                fontSize="11"
                className={`font-medium transition-colors ${
                  isHovered ? 'fill-app-accent font-bold' : 'fill-app-text-muted'
                }`}
              >
                {p.dayLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover Tooltip Overlay */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          className="absolute pointer-events-none -translate-x-1/2 -translate-y-full bg-app-surface border border-app-border rounded-lg shadow-xl px-2.5 py-1.5 text-xs z-20 animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${(points[hoveredIndex].x / viewBoxWidth) * 100}%`,
            top: `${(points[hoveredIndex].y / viewBoxHeight) * 100 - 8}%`,
          }}
        >
          <div className="font-bold text-app-text">
            {points[hoveredIndex].dayLabel} ({points[hoveredIndex].date})
          </div>
          <div className="text-[11px] text-app-accent font-semibold flex items-center space-x-1.5 mt-0.5">
            <span>Runs: {points[hoveredIndex].runs}</span>
            <span className="text-app-text-muted">•</span>
            <span className="text-app-success">Success: {points[hoveredIndex].successCount}</span>
          </div>
        </div>
      )}
    </div>
  );
};
