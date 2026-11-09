import type { Metadata, Viewport } from 'next';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import '@fontsource/ibm-plex-sans-condensed/latin-500.css';
import '@fontsource/ibm-plex-sans-condensed/latin-600.css';
import '@fontsource/ibm-plex-sans-condensed/latin-700.css';
import './cairn-base.css';
import './cairn-ds.css';
import './globals.css';
import { RegisterSW } from '@/components/RegisterSW';

export const metadata: Metadata = {
  title: { default: 'YouCount · Contabilità YouSud', template: '%s · YouCount' },
  description: 'Ogni spesa, il suo giustificativo. Contabilità di YouSud ODV.',
  applicationName: 'YouCount',
  appleWebApp: { capable: true, title: 'YouCount', statusBarStyle: 'default' },
  icons: { icon: '/favicon.ico', apple: '/icons/apple-touch-icon.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#10151C' }, { color: '#F3F5F8' }],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
