import { Callback } from './Callback';

export const dynamic = 'force-static';

export default function AuthCallback() {
  return (
    <main className="wrap login" style={{ maxWidth: 420, paddingTop: 'calc(40px + env(safe-area-inset-top, 0px))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/brand/youcount-mark.svg" alt="" width={52} height={52} />
        <div className="brand"><b><span className="wm-you">You</span><span className="wm-count">Count</span></b></div>
      </div>
      <Callback />
    </main>
  );
}
