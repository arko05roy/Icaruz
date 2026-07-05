"use client"

import { useEffect, useState } from "react"

const BRAINS = [
  { name: "yudhi", topic: "research", status: "ONLINE" },
  { name: "karpathy", topic: "frameworks", status: "ONLINE" },
  { name: "0g-expert", topic: "research", status: "ONLINE" },
]

export function StatusCard() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const cachePct = 40 + (tick % 5) * 8

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          brain_registry.status
        </span>
        <span className="text-[10px] tracking-widest text-muted-foreground">
          {`TICK:${String(tick).padStart(4, "0")}`}
        </span>
      </div>
      <div className="flex-1 flex flex-col p-4 gap-0">
        <div className="grid grid-cols-3 gap-2 border-b border-border pb-2 mb-2">
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground">Brain</span>
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground">Topic</span>
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground text-right">Status</span>
        </div>
        {BRAINS.map((brain) => (
          <div
            key={brain.name}
            className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-none"
          >
            <span className="text-xs font-mono text-foreground">{brain.name}</span>
            <span className="text-xs font-mono text-muted-foreground">{brain.topic}</span>
            <div className="flex items-center justify-end gap-2">
              <span
                className="h-1.5 w-1.5"
                style={{
                  backgroundColor: brain.status === "ONLINE" ? "#ea580c" : "hsl(var(--muted-foreground))",
                }}
              />
              <span className="text-xs font-mono text-muted-foreground">{brain.status}</span>
            </div>
          </div>
        ))}
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground">
              Prefix Cache Hits
            </span>
            <span className="text-[9px] font-mono text-foreground">{cachePct}%</span>
          </div>
          <div className="h-2 w-full border border-foreground">
            <div className="h-full bg-foreground transition-all duration-500" style={{ width: `${cachePct}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
