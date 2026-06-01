export function BearMascot({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Ears */}
      <circle cx="60" cy="45" r="30" fill="#C4865A" />
      <circle cx="140" cy="45" r="30" fill="#C4865A" />
      <circle cx="60" cy="45" r="18" fill="#E8A87C" />
      <circle cx="140" cy="45" r="18" fill="#E8A87C" />

      {/* Head */}
      <ellipse cx="100" cy="100" rx="70" ry="65" fill="#C4865A" />

      {/* Face */}
      <ellipse cx="100" cy="108" rx="45" ry="38" fill="#E8D5B7" />

      {/* Eyes */}
      <ellipse cx="75" cy="88" rx="8" ry="9" fill="#1B2A4A" />
      <ellipse cx="125" cy="88" rx="8" ry="9" fill="#1B2A4A" />
      <circle cx="78" cy="85" r="3" fill="white" />
      <circle cx="128" cy="85" r="3" fill="white" />

      {/* Nose */}
      <ellipse cx="100" cy="105" rx="10" ry="7" fill="#1B2A4A" />
      <ellipse cx="100" cy="103" rx="4" ry="2.5" fill="#4A6080" opacity="0.5" />

      {/* Mouth */}
      <path
        d="M90 112 Q100 122 110 112"
        stroke="#1B2A4A"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Blush */}
      <ellipse cx="65" cy="105" rx="10" ry="6" fill="#F4A0A0" opacity="0.5" />
      <ellipse cx="135" cy="105" rx="10" ry="6" fill="#F4A0A0" opacity="0.5" />

      {/* Hat (tourist hat) */}
      <ellipse cx="100" cy="42" rx="50" ry="8" fill="#E8732C" />
      <rect x="70" y="15" width="60" height="28" rx="8" fill="#E8732C" />
      <rect x="85" y="20" width="30" height="6" rx="3" fill="#FDF6EC" />
    </svg>
  );
}

export function BearLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="12" cy="9" r="6" fill="#C4865A" />
      <circle cx="28" cy="9" r="6" fill="#C4865A" />
      <circle cx="12" cy="9" r="3.5" fill="#E8A87C" />
      <circle cx="28" cy="9" r="3.5" fill="#E8A87C" />
      <ellipse cx="20" cy="20" rx="14" ry="13" fill="#C4865A" />
      <ellipse cx="20" cy="22" rx="9" ry="7.5" fill="#E8D5B7" />
      <ellipse cx="15" cy="18" rx="1.8" ry="2" fill="#1B2A4A" />
      <ellipse cx="25" cy="18" rx="1.8" ry="2" fill="#1B2A4A" />
      <ellipse cx="20" cy="21.5" rx="2.2" ry="1.5" fill="#1B2A4A" />
      <path
        d="M17.5 23.5 Q20 26.5 22.5 23.5"
        stroke="#1B2A4A"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
