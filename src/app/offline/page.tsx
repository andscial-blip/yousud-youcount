import { Logo, Wordmark } from '@/components/Logo';
import { guestLang } from '@/lib/session';
import { translator } from '@/lib/i18n';

export default async function Offline() {
  const t = translator(await guestLang());
  return (
    <main className="wrap login" style={{ maxWidth: 480, paddingTop: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Logo size={72} /><Wordmark tagline={t('app_tagline')} />
      </div>
      <h1 style={{ fontSize: 20, marginBottom: 10 }}>{t('offline_title')}</h1>
      <div className="note">{t('offline_text')}</div>
    </main>
  );
}
