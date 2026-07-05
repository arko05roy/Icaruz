import type { Metadata } from 'next';
import { DM_Sans, IBM_Plex_Mono, Syne } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { SiteHeader } from '@/components/site-header';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['700', '800'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500'],
});

const ibmMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Brainpedia × BTL Runtime',
  description:
    'Cache-aware mixture-of-brains: multi-expert agent queries with per-request BTL Runtime savings proof.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmSans.variable} ${ibmMono.variable}`}
    >
      <body className="min-h-screen antialiased">
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
