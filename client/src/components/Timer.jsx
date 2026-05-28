export default function Timer({ seconds, total = 90, phase, size = 'md' }) {
  const pct  = total > 0 ? Math.max(0, seconds / total) : 0;
  const urgent  = seconds > 0 && seconds <= 10;
  const warning = seconds > 0 && seconds <= 30 && seconds > 10;

  const color = urgent  ? '#f87171'
    : warning ? '#fbbf24'
    : { night:'#818cf8', discuss:'#4ade80', vote:'#f87171' }[phase] || '#8b5cf6';

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  // size configs
  const cfg = size === 'lg'
    ? { svgSize: 96, r: 40, sw: 6, fontSize: 22, subSize: 11 }
    : size === 'sm'
    ? { svgSize: 44, r: 18, sw: 3, fontSize: 10, subSize: 0  }
    : { svgSize: 64, r: 27, sw: 5, fontSize: 15, subSize: 10 }; // md default

  const { svgSize, r, sw, fontSize, subSize } = cfg;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const cx   = svgSize / 2;

  const phaseLabel = { night:'ĐÊM', discuss:'NGÀY', vote:'BỎ PHIẾU' }[phase] || '';

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
      <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        {/* Track */}
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
        {/* Progress */}
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke={color} strokeWidth={sw}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: 'stroke-dasharray 0.9s linear', filter: urgent ? `drop-shadow(0 0 4px ${color})` : 'none' }}
        />
        {/* Glow ring khi urgent */}
        {urgent && (
          <circle cx={cx} cy={cx} r={r} fill="none"
            stroke={color} strokeWidth={sw + 2} opacity={0.15}
            strokeDasharray={`${circ} 0`}
          />
        )}
        {/* Time text */}
        <text x={cx} y={cx + (subSize > 0 ? fontSize * 0.35 : fontSize * 0.4)}
          textAnchor="middle"
          fill={urgent ? '#f87171' : 'var(--text-primary, #fff)'}
          fontSize={fontSize}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {mm}:{ss}
        </text>
        {/* Phase sub-label */}
        {subSize > 0 && phaseLabel && (
          <text x={cx} y={cx + fontSize * 0.35 + subSize + 2}
            textAnchor="middle"
            fill="rgba(255,255,255,0.35)"
            fontSize={subSize}
            fontFamily="var(--font-body, sans-serif)"
            fontWeight="600"
            letterSpacing="1">
            {phaseLabel}
          </text>
        )}
      </svg>
      {/* Urgent pulse bar bên dưới khi ≤10s */}
      {urgent && size !== 'sm' && (
        <div style={{
          width: svgSize * 0.7, height: 3, borderRadius: 2,
          background: `linear-gradient(90deg, ${color}44, ${color}, ${color}44)`,
          animation: 'bl 0.6s ease-in-out infinite',
          marginTop: -2,
        }} />
      )}
    </div>
  );
}
