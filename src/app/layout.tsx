import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegisterSW } from '@/components/RegisterSW';

export const metadata: Metadata = {
  title: { default: 'YouCount · Contabilità YouSud', template: '%s · YouCount' },
  description: 'Ogni spesa, il suo giustificativo. Contabilità di YouSud ODV.',
  applicationName: 'YouCount',
  appleWebApp: { capable: true, title: 'YouCount', statusBarStyle: 'black-translucent' },
  icons: { icon: '/favicon.ico', apple: '/icons/apple-touch-icon.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#44546A',
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
