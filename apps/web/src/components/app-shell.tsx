'use client';

import { SiteHeader } from '@/components/site-header';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen dot-grid-bg bg-background text-foreground font-mono">
      <SiteHeader />
      {children}
    </div>
  );
}
