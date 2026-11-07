import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YouCount · Contabilità YouSud',
    short_name: 'YouCount',
    description: 'Ogni spesa, il suo giustificativo – Chaque dépense, sa pièce justificative',
    lang: 'it',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#44546A',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [{ name: 'Nuovo movimento', url: '/nuovo', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }],
  };
}
