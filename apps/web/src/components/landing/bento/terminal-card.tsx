"use client"

import { useEffect, useState } from "react"

const LOG_LINES = [
  "> POST /api/mixture { topic: \"auto\" }",
  "> Router (btl-2): classified → research",
  "> Fan-out: yudhi · karpathy · 0g-expert",
  "> yudhi: prefix-stable RAG → BTL Runtime",
  "> x-btl-cache-tier: prefix",
  "> x-btl-saved: $0.000004",
  "> karpathy: cache hit on wiki prefix",
  "> Synthesis call → BTL Runtime",
  "> btlEconomics.cacheHits: 2",
  "> btlEconomics.savingsRate: 33%",
  "> --------- RECEIPT EMITTED ---------",
]

export function TerminalCard() {
  const [lines, setLines] = useState<string[]>([])
  const [currentLine, setCurrentLine] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLine((prev) => {
        const next = prev + 1
        if (next >= LOG_LINES.length) {
          setLines([])
          return 0
        }
        setLines((l) => {
          const line = LOG_LINES[next]
          if (!line) return l
          return [...l.slice(-8), line]
        })
        return next
      })
    }, 600)

    const first = LOG_LINES[0]
    if (first) setLines([first])

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b-2 border-foreground px-4 py-2">
        <span className="h-2 w-2 bg-[#ea580c]" />
        <span className="h-2 w-2 bg-foreground" />
        <span className="h-2 w-2 border border-foreground" />
        <span className="ml-auto text-[10px] tracking-widest text-muted-foreground uppercase">
          mixture.log
        </span>
      </div>
      <div className="flex-1 bg-foreground p-4 overflow-hidden">
        <div className="flex flex-col gap-1">
          {lines.map((line, i) => (
            <span
              key={`${currentLine}-${i}`}
              className="text-xs text-background font-mono block"
              style={{ opacity: i === lines.length - 1 ? 1 : 0.6 }}
            >
              {line}
            </span>
          ))}
          <span className="text-xs text-[#ea580c] font-mono animate-blink">{"_"}</span>
        </div>
      </div>
    </div>
  )
}
