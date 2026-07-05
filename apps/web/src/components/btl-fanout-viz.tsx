'use client';

/**
 * Signature viz: mixture fan-out as parallel lanes into BTL cache layer.
 */
export function BtlFanoutViz({ brainCount, cacheHits }: { brainCount: number; cacheHits?: number }) {
  const brains = Math.max(brainCount, 3);
  const hits = cacheHits ?? 0;
  const accent = '#ea580c';
  const muted = 'hsl(var(--muted-foreground))';
  const fg = 'hsl(var(--foreground))';
  const bg = 'hsl(var(--background))';
  const border = 'hsl(var(--border))';

  return (
    <div className="panel overflow-hidden p-4" aria-hidden>
      <div className="label-rail mb-4">routing board · mixture fan-out</div>
      <svg viewBox="0 0 560 200" className="h-auto w-full" role="img">
        <rect x="8" y="88" width="72" height="24" fill={bg} stroke={border} strokeWidth="2" />
        <text x="44" y="104" textAnchor="middle" fill={muted} fontSize="9" fontFamily="monospace">
          PROMPT
        </text>
        <line x1="80" y1="100" x2="120" y2="100" stroke={accent} strokeWidth="2" />

        <rect x="120" y="76" width="88" height="48" fill={bg} stroke={accent} strokeWidth="2" />
        <text x="164" y="98" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace">
          ORCH
        </text>
        <text x="164" y="112" textAnchor="middle" fill={muted} fontSize="7" fontFamily="monospace">
          prefix-stable RAG
        </text>

        {Array.from({ length: brains }).map((_, i) => {
          const y = 24 + i * (152 / Math.max(brains - 1, 1));
          const active = i < hits;
          return (
            <g key={i}>
              <path
                d={`M208 100 C 280 ${100}, 300 ${y}, 360 ${y}`}
                fill="none"
                stroke={active ? accent : border}
                strokeWidth={active ? 2 : 1}
                strokeDasharray={active ? '0' : '4 4'}
              />
              <rect
                x="360"
                y={y - 12}
                width="72"
                height="24"
                fill={bg}
                stroke={active ? accent : border}
                strokeWidth="2"
              />
              <text
                x="396"
                y={y + 4}
                textAnchor="middle"
                fill={active ? accent : muted}
                fontSize="8"
                fontFamily="monospace"
              >
                BRAIN_{i + 1}
              </text>
            </g>
          );
        })}

        <line x1="432" y1="100" x2="468" y2="100" stroke={fg} strokeWidth="2" />
        <rect x="468" y="60" width="84" height="80" fill={bg} stroke={fg} strokeWidth="2" />
        <text x="510" y="88" textAnchor="middle" fill={fg} fontSize="9" fontFamily="monospace" fontWeight="bold">
          BTL
        </text>
        <text x="510" y="104" textAnchor="middle" fill={fg} fontSize="8" fontFamily="monospace">
          RUNTIME
        </text>
        <text x="510" y="122" textAnchor="middle" fill={accent} fontSize="7" fontFamily="monospace">
          cache / dedupe
        </text>
      </svg>
    </div>
  );
}
