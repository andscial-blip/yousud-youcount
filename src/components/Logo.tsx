// Marchio Mizana: bilancia («mizana» in malgascio) su quadrato ardesia, piatto ambra.
export function Logo({ className = 'logo' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="mz-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A5C76" />
          <stop offset="1" stopColor="#34445A" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9.5" fill="url(#mz-g)" />
      <path d="M20 11v18M14 30h12M9 14h22" stroke="#C9D6EA" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M6 22a4.6 4.6 0 0 0 9.2 0z" fill="#C9D6EA" />
      <path d="M24.8 22a4.6 4.6 0 0 0 9.2 0z" fill="#E8BE5A" />
      <path d="M10.6 14 7 22M10.6 14l3.6 8M29.4 14 25.8 22M29.4 14l3.6 8" stroke="#C9D6EA" strokeWidth="1.2" fill="none" />
      <circle cx="20" cy="10.5" r="2.2" fill="#E8BE5A" />
    </svg>
  );
}
