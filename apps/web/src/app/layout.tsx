import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { GeistPixelGrid } from 'geist/font/pixel';
import './globals.css';
import { Providers } from '@/components/providers';
import { AppShell } from '@/components/app-shell';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'Icaruz — Cache-aware mixture-of-brains on BTL Runtime',
    template: '%s · Icaruz',
  },
  description:
    'Route one agent prompt across specialist knowledge brains. Prefix-stable RAG lets BTL Runtime cache shared wiki context — with per-request savings proof in every response.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    title: 'Icaruz — Cache-aware mixture-of-brains',
    description:
      'Multi-expert agent queries with verifiable BTL Runtime economics. Fan out, cache prefix, prove savings.',
    siteName: 'Icaruz',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Icaruz — Cache-aware mixture-of-brains',
    description:
      'Prefix-stable RAG across specialist brains. Every mixture query returns a live economics receipt.',
  },
};

export const viewport: Viewport = {
  themeColor: '#F2F1EA',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} ${GeistPixelGrid.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
