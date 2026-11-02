import { Marquee } from '@chai/ui';

/** The pet's kettle: a pink chai kettle with rising steam, gently rocking. */
export function Kettle({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 120 120" className={`cc-kettle overflow-visible ${className}`}>
      {[46, 60, 74].map((x, i) => (
        <path
          key={x}
          className="cc-kettle-steam"
          style={{ animationDelay: `${i * 0.8}s` }}
          d={`M${x} 22 c-6 -7 6 -11 0 -18 s6 -9 0 -15`}
          stroke="#ff4fd8"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      ))}
      <path
        d="M86 70 L111 46 L116 52 L96 84 Z"
        fill="#ff4fd8"
        stroke="#000"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M30 46 Q60 6 90 46"
        fill="none"
        stroke="#000"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M22 98 Q14 60 38 46 H82 Q106 60 98 98 Z"
        fill="#ff4fd8"
        stroke="#000"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M36 46 Q60 32 84 46 Z" fill="#000" />
      <circle cx="60" cy="34" r="5" fill="#ff4fd8" stroke="#000" strokeWidth="3" />
      <path d="M20 98 H100" stroke="#000" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M32 66 Q30 80 34 90"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      <text
        x="60"
        y="82"
        textAnchor="middle"
        fontSize="13"
        fontWeight="900"
        fill="#000"
        style={{ fontFamily: 'var(--font-unbounded)' }}
      >
        CHAI
      </text>
    </svg>
  );
}

/** Two tape strips crossing the screen at angles, running in opposite directions. */
export function CrossTapes({ a, b }: { a: string[]; b: string[] }) {
  return (
    <div
      aria-hidden
      className="relative left-1/2 h-36 w-screen -translate-x-1/2 overflow-hidden sm:h-48"
    >
      <div className="absolute top-1/2 left-[-10%] w-[120%] -translate-y-1/2 rotate-[4deg]">
        <Marquee
          items={b}
          speed={55}
          reverse
          itemClassName="text-[#ff4fd8]"
          className="font-display h-12 border-y-2 border-[#ff4fd8] bg-[#000] text-lg font-black tracking-tight text-[#ff4fd8] uppercase sm:h-16 sm:text-3xl"
          separator={<Burst className="size-4 text-white sm:size-6" />}
        />
      </div>
      <div className="absolute top-1/2 left-[-10%] w-[120%] -translate-y-1/2 rotate-[-5deg]">
        <Marquee
          items={a}
          speed={70}
          itemClassName="text-[#000]"
          className="font-display relative z-10 h-14 bg-[#ff4fd8] text-xl font-black tracking-tight text-[#000] uppercase sm:h-20 sm:text-4xl"
          separator={<Burst className="size-5 text-[#000] sm:size-8" />}
        />
      </div>
    </div>
  );
}

export function Burst({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 0l2.6 7.2L22 4.6l-4.4 6.2L24 14l-7.4.9L18 22l-6-4.6L6 22l1.4-7.1L0 14l6.4-3.2L2 4.6l7.4 2.6Z"
        fill="currentColor"
      />
    </svg>
  );
}
