'use client';
import { useEffect } from 'react';

// Una sola misura per apertura dell'app: quanto ci mette il server, quando compare la prima cosa e
// quando la pagina è pronta. Inviata dopo il caricamento, senza rallentare nulla.
export function PerfBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('yc-perf')) return;
      sessionStorage.setItem('yc-perf', '1');
    } catch { return; }
    const send = () => {
      const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!n) return;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
      const sd = getComputedStyle(document.documentElement).getPropertyValue('--yc-sd');
      const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
      const body = JSON.stringify({
        path: location.pathname, ttfb: n.responseStart - n.startTime, html: n.responseEnd - n.startTime, dom: n.domContentLoadedEventEnd - n.startTime,
        fcp, load: n.loadEventEnd - n.startTime, splash: sd ? parseFloat(sd) : undefined, sw: Boolean(navigator.serviceWorker?.controller),
        net: conn?.effectiveType, pwa: window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
      });
      if (!navigator.sendBeacon?.('/api/v1/perf', new Blob([body], { type: 'application/json' }))) fetch('/api/v1/perf', { method: 'POST', body, keepalive: true }).catch(() => {});
    };
    if (document.readyState === 'complete') setTimeout(send, 500); else window.addEventListener('load', () => setTimeout(send, 500), { once: true });
  }, []);
  return null;
}
