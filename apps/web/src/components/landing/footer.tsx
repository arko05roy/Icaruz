"use client"

import Link from "next/link"
import { motion } from "framer-motion"

const ease = [0.22, 1, 0.36, 1] as const

const FOOTER_LINKS = [
  { label: "Status", href: "/status" },
  { label: "Brains", href: "/brains" },
  { label: "BTL Docs", href: "https://runtime.badtheorylabs.com/docs", external: true },
  { label: "GitHub", href: "https://github.com/arko05roy/Icaruz", external: true },
] as const

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease }}
      className="w-full border-t-2 border-foreground px-6 py-8 lg:px-12"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono tracking-[0.15em] uppercase font-bold text-foreground">
            Icaruz
          </span>
          <span className="text-[10px] font-mono tracking-widest text-muted-foreground">
            Cache-aware mixture-of-brains on BTL Runtime · MIT
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          {FOOTER_LINKS.map((link, i) => (
            <motion.span
              key={link.label}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease }}
            >
              {"external" in link && link.external ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  href={link.href}
                  className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {link.label}
                </Link>
              )}
            </motion.span>
          ))}
        </div>
      </div>
    </motion.footer>
  )
}
