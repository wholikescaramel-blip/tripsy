// Faint hand-drawn travel doodles behind every page. Purely decorative.
export function Doodles() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg className="h-full w-full" viewBox="0 0 400 900" preserveAspectRatio="xMidYMid slice" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* soft blobs and rings */}
        <circle cx="360" cy="70" r="70" fill="#ff6b4a" opacity="0.06" />
        <circle cx="30" cy="520" r="90" fill="#7c3aed" opacity="0.045" />
        <circle cx="380" cy="820" r="60" fill="#ff4d7d" opacity="0.05" />
        <g stroke="#ff6b4a" strokeWidth="1.5" opacity="0.14">
          <circle cx="60" cy="140" r="26" />
          <circle cx="60" cy="140" r="38" strokeDasharray="3 6" />
          <circle cx="330" cy="600" r="22" />
        </g>

        <g stroke="#b84ce0" strokeWidth="2" opacity="0.16">
          {/* plane with a dashed trail */}
          <path d="M40 300 C 110 250, 170 330, 250 270" strokeDasharray="2 7" />
          <path d="M262 262 l22 -8 l-6 6 l10 10 l-5 2 l-10 -7 l-8 9 l-2 -3 l4 -9 l-10 -4 z" />

          {/* compass */}
          <circle cx="330" cy="400" r="20" />
          <path d="M330 386 l5 14 l-5 14 l-5 -14 z" />

          {/* camera */}
          <rect x="40" y="690" width="44" height="30" rx="6" />
          <circle cx="62" cy="705" r="9" />
          <path d="M52 690 l4 -6 h12 l4 6" />
        </g>

        <g stroke="#ff6b4a" strokeWidth="2" opacity="0.16">
          {/* palm tree */}
          <path d="M340 240 c -4 -30, -2 -50, 6 -70" />
          <path d="M346 170 c -14 -8, -28 -4, -34 6 M346 170 c 12 -12, 28 -12, 36 -2 M346 170 c -2 -14, 6 -26, 18 -30 M346 170 c -16 2, -24 14, -24 24" />

          {/* mountains and sun */}
          <path d="M20 440 l34 -46 l18 24 l16 -18 l30 40" />
          <circle cx="92" cy="382" r="9" />

          {/* suitcase */}
          <rect x="300" y="700" width="46" height="36" rx="6" />
          <path d="M315 700 v-8 h16 v8 M300 716 h46" />

          {/* location pin */}
          <path d="M200 610 c -12 0, -18 -9, -18 -17 c 0 -10, 8 -17, 18 -17 s 18 7, 18 17 c 0 8, -6 17, -18 17 z" transform="translate(0 -12)" />
          <circle cx="200" cy="581" r="5" />
        </g>

        {/* waves */}
        <g stroke="#0ea5e9" strokeWidth="2" opacity="0.13">
          <path d="M120 480 q 12 -10, 24 0 t 24 0 t 24 0 t 24 0" />
          <path d="M140 496 q 12 -10, 24 0 t 24 0 t 24 0" />
          <path d="M100 860 q 14 -12, 28 0 t 28 0 t 28 0 t 28 0 t 28 0" />
          <path d="M200 60 q 10 -8, 20 0 t 20 0 t 20 0" />
        </g>

        {/* little sparkles and dots */}
        <g fill="#ff6b4a" opacity="0.18">
          <circle cx="180" cy="160" r="2.5" />
          <circle cx="260" cy="520" r="2" />
          <circle cx="120" cy="780" r="2.5" />
          <circle cx="360" cy="520" r="2" />
          <circle cx="30" cy="30" r="2" />
        </g>
        <g stroke="#b84ce0" strokeWidth="1.8" opacity="0.18">
          <path d="M240 190 v12 M234 196 h12" />
          <path d="M60 600 v10 M55 605 h10" />
          <path d="M250 800 v12 M244 806 h12" />
        </g>
      </svg>
    </div>
  );
}
