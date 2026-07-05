'use client';

/**
 * Signature viz: mixture fan-out as parallel lanes into BTL cache layer.
 * Not a generic force graph — reads like a bus diagram / exchange routing board.
 */
export function BtlFanoutViz({ brainCount, cacheHits }: { brainCount: number; cacheHits?: number }) {
  const brains = Math.max(brainCount, 3);
  const hits = cacheHits ?? 0;

  return (
    <div className="panel overflow-hidden p-4" aria-hidden>
      <div className="label-rail mb-4">routing board · mixture fan-out</div>
      <svg viewBox="0 0 560 200" className="h-auto w-full" role="img">
        <defs>
          <linearGradient id="lane" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2a3347" />
            <stop offset="100%" stopColor="#3dffa8" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {/* prompt in */}
        <rect x="8" y="88" width="72" height="24" fill="#1a2030" stroke="#3d4d66" />
        <text x="44" y="104" textAnchor="middle" fill="#8b9bb3" fontSize="9" fontFamily="monospace">
          PROMPT
        </text>
        <line x1="80" y1="100" x2="120" y2="100" stroke="#ff9f1c" strokeWidth="2" />

        {/* orchestrator */}
        <rect x="120" y="76" width="88" height="48" fill="#12161f" stroke="#ff9f1c" strokeWidth="1.5" />
        <text x="164" y="98" textAnchor="middle" fill="#ff9f1c" fontSize="8" fontFamily="monospace">
          ORCH
        </text>
        <text x="164" y="112" textAnchor="middle" fill="#5c6b82" fontSize="7" fontFamily="monospace">
          prefix-stable RAG
        </text>

        {/* fan-out lanes */}
        {Array.from({ length: brains }).map((_, i) => {
          const y = 24 + i * (152 / Math.max(brains - 1, 1));
          const active = i < hits;
          return (
            <g key={i}>
              <path
                d={`M208 100 C 280 ${100}, 300 ${y}, 360 ${y}`}
                fill="none"
                stroke={active ? '#3dffa8' : '#2a3347'}
                strokeWidth={active ? 2 : 1}
                strokeDasharray={active ? '0' : '4 4'}
              />
              <rect
                x="360"
                y={y - 12}
                width="72"
                height="24"
                fill={active ? 'rgba(61,255,168,0.08)' : '#141820'}
                stroke={active ? '#3dffa8' : '#2a3347'}
              />
              <text
                x="396"
                y={y + 4}
                textAnchor="middle"
                fill={active ? '#3dffa8' : '#5c6b82'}
                fontSize="8"
                fontFamily="monospace"
              >
                BRAIN_{i + 1}
              </text>
            </g>
          );
        })}

        {/* BTL gateway */}
        <line x1="432" y1="100" x2="468" y2="100" stroke="#6ec8ff" strokeWidth="2" />
        <rect x="468" y="60" width="84" height="80" fill="#0a0c10" stroke="#6ec8ff" strokeWidth="2" />
        <text x="510" y="88" textAnchor="middle" fill="#6ec8ff" fontSize="9" fontFamily="monospace" fontWeight="bold">
          BTL
        </text>
        <text x="510" y="104" textAnchor="middle" fill="#6ec8ff" fontSize="8" fontFamily="monospace">
          RUNTIME
        </text>
        <text x="510" y="122" textAnchor="middle" fill="#3dffa8" fontSize="7" fontFamily="monospace">
          cache / dedupe
        </text>
      </svg>
    </div>
  );
}
