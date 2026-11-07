import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegisterSW } from '@/components/RegisterSW';

export const metadata: Metadata = {
  title: { default: 'Mizana · Contabilità YouSud', template: '%s · Mizana' },
  description: 'Registrazione di entrate e uscite, giustificativi e rendiconto per YouSud ODV.',
  applicationName: 'Mizana',
  appleWebApp: { capable: true, title: 'Mizana', statusBarStyle: 'black-translucent' },
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
    <html lang="it">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
