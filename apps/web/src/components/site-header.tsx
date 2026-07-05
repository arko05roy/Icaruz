'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Network } from 'lucide-react';
import { ThemeToggle } from '@/components/landing/theme-toggle';

const NAV = [
  { label: 'Ask', href: '/ask' },
  { label: 'Brains', href: '/brains' },
  { label: 'Create', href: '/create' },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === '/') return null;

  return (
    <header className="sticky top-0 z-50 w-full px-4 pt-4 lg:px-6">
      <nav className="mx-auto flex max-w-6xl items-center justify-between border border-foreground/20 bg-background/80 px-6 py-3 backdrop-blur-sm lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Network size={16} strokeWidth={1.5} />
          <span className="text-xs font-mono font-bold uppercase tracking-[0.15em]">
            Icaruz
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://runtime.badtheorylabs.com/docs"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            BTL Docs
          </a>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            href="/ask"
            className="bg-foreground px-4 py-2 text-xs font-mono uppercase tracking-widest text-background"
          >
            Open App
          </Link>
        </div>
      </nav>
    </header>
  );
}
