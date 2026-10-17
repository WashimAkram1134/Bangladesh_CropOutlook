'use client';

interface ArcGaugeProps {
  score?: number; // 0 to 100
  valueText?: string;
  unitText?: string;
  labelText?: string;
  size?: number;
}

export function ArcGauge({
  score = 70,
  valueText = '70%',
  unitText,
  labelText = 'Health Score',
  size = 200,
}: ArcGaugeProps) {
  const totalDots = 28;
  const activeCount = Math.round((Math.min(100, Math.max(0, score)) / 100) * totalDots);

  // Geometry
  const cx = 110;
  const cy = 100;
  const radius = 72;

  // Generate dots along an arc from -195 deg to 15 deg (a bit more than 180 degrees for a nice horseshoe curve)
  const startAngle = -195;
  const endAngle = 15;
  const angleSpan = endAngle - startAngle;

  const dots = Array.from({ length: totalDots }).map((_, i) => {
    const fraction = i / (totalDots - 1);
    const angleDeg = startAngle + fraction * angleSpan;
    const angleRad = (angleDeg * Math.PI) / 180;

    const x = Number((cx + radius * Math.cos(angleRad)).toFixed(3));
    const y = Number((cy + radius * Math.sin(angleRad)).toFixed(3));
    const rotation = Number((angleDeg + 90).toFixed(3));
    const isActive = i <= activeCount;

    return {
      id: i,
      x,
      y,
      rotation,
      isActive,
      fraction,
    };
  });

  return (
    <div className="relative flex flex-col items-center justify-center select-none" style={{ width: size, height: size * 0.72 }}>
      <svg
        viewBox="0 0 220 160"
        className="w-full h-full overflow-visible"
      >
        <defs>
          <linearGradient id="arcActiveGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="60%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <filter id="arcGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#22c55e" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Arc Dots */}
        {dots.map((dot) => (
          <rect
            key={dot.id}
            x={-2.2}
            y={-6.5}
            width={4.4}
            height={13}
            rx={2.2}
            transform={`translate(${dot.x}, ${dot.y}) rotate(${dot.rotation})`}
            fill={dot.isActive ? 'url(#arcActiveGradient)' : '#334155'}
            filter={dot.isActive ? 'url(#arcGlow)' : undefined}
            opacity={dot.isActive ? 1 : 0.45}
          />
        ))}
      </svg>

      {/* Central Content */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center ${size <= 160 ? 'pt-2.5' : 'pt-5'}`}>
        <div className="flex items-baseline gap-1">
          <span
            className="font-bold text-white tracking-tight leading-none"
            style={{ fontSize: size <= 160 ? '22px' : '32px' }}
          >
            {valueText}
          </span>
          {unitText && (
            <span
              className="font-semibold text-[#86efac]"
              style={{ fontSize: size <= 160 ? '10px' : '12px' }}
            >
              {unitText}
            </span>
          )}
        </div>
        <span
          className="font-medium text-[#94a39b] tracking-wide mt-0.5"
          style={{ fontSize: size <= 160 ? '9px' : '11px' }}
        >
          {labelText}
        </span>
      </div>
    </div>
  );
}
