"use client"

import Link from "next/link"
import { WorkflowDiagram } from "@/components/landing/workflow-diagram"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

const ease = [0.22, 1, 0.36, 1] as const

export function HeroSection() {
  return (
    <section className="relative w-full px-12 pt-6 pb-12 lg:px-24 lg:pt-10 lg:pb-16">
      <div className="flex flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="mb-4 text-[10px] font-mono tracking-[0.25em] uppercase text-muted-foreground"
        >
          Specialist AI brains — one question, one answer
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease }}
          className="font-pixel text-4xl sm:text-6xl lg:text-7xl xl:text-8xl tracking-tight text-foreground mb-2 select-none"
        >
          ONE QUESTION.
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease }}
          className="w-full max-w-2xl my-4 lg:my-6"
        >
          <WorkflowDiagram />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.25, ease }}
          className="font-pixel text-4xl sm:text-6xl lg:text-7xl xl:text-8xl tracking-tight text-foreground mb-4 select-none"
          aria-hidden="true"
        >
          MANY EXPERTS.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease }}
          className="text-xs lg:text-sm text-muted-foreground max-w-lg mb-8 leading-relaxed font-mono"
        >
          Ask anything once. Icaruz sends it to specialist brains — security auditors,
          framework experts, domain researchers — and combines their answers into one
          clear response. Run the same question again and you pay less, not more.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6, ease }}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/ask"
              className="group flex items-center gap-0 bg-foreground text-background text-sm font-mono tracking-wider uppercase"
            >
              <span className="flex items-center justify-center w-10 h-10 bg-[#ea580c]">
                <motion.span
                  className="inline-flex"
                  whileHover={{ x: 3 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <ArrowRight size={16} strokeWidth={2} className="text-background" />
                </motion.span>
              </span>
              <span className="px-5 py-2.5">Open App</span>
            </Link>
          </motion.div>
          <a
            href="#how-it-works"
            className="text-xs font-mono tracking-widest uppercase text-muted-foreground hover:text-foreground border border-foreground/25 px-5 py-3 transition-colors"
          >
            How it works
          </a>
        </motion.div>
      </div>
    </section>
  )
}
