/**
 * NeuroShield brand logo — a stylised brain-shield mark.
 * Inner brain circuit lines + outer shield outline, gradient fill.
 */
const NeuroShieldLogo = ({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient
        id="ns-grad"
        x1="0"
        y1="0"
        x2="64"
        y2="64"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#22D3EE" />
        <stop offset="50%" stopColor="#818CF8" />
        <stop offset="100%" stopColor="#A855F7" />
      </linearGradient>
      <linearGradient
        id="ns-inner"
        x1="16"
        y1="16"
        x2="48"
        y2="48"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#22D3EE" />
        <stop offset="100%" stopColor="#A855F7" />
      </linearGradient>
      <filter id="ns-glow">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* Outer shield shape */}
    <path
      d="M32 4 L56 16 V34 C56 46 46 56 32 60 C18 56 8 46 8 34 V16 L32 4Z"
      stroke="url(#ns-grad)"
      strokeWidth="2.5"
      strokeLinejoin="round"
      fill="none"
      filter="url(#ns-glow)"
    />

    {/* Inner shield fill (subtle) */}
    <path
      d="M32 8 L52 18 V34 C52 44 43 52 32 56 C21 52 12 44 12 34 V18 L32 8Z"
      fill="url(#ns-grad)"
      opacity="0.12"
    />

    {/* Brain circuit — left hemisphere */}
    <path
      d="M24 24 C20 24 18 28 20 31 C18 33 19 37 23 38 C23 40 26 42 29 40"
      stroke="url(#ns-inner)"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />

    {/* Brain circuit — right hemisphere */}
    <path
      d="M40 24 C44 24 46 28 44 31 C46 33 45 37 41 38 C41 40 38 42 35 40"
      stroke="url(#ns-inner)"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />

    {/* Brain stem / connection */}
    <path
      d="M32 40 V46"
      stroke="url(#ns-inner)"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* Centre bridge */}
    <path
      d="M29 32 H35"
      stroke="url(#ns-inner)"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* Neural nodes */}
    <circle cx="24" cy="24" r="2" fill="#22D3EE" />
    <circle cx="40" cy="24" r="2" fill="#A855F7" />
    <circle cx="32" cy="20" r="1.5" fill="#818CF8" />
    <circle cx="32" cy="46" r="1.5" fill="#818CF8" />

    {/* Pulse ring at center */}
    <circle
      cx="32"
      cy="32"
      r="3"
      fill="none"
      stroke="url(#ns-inner)"
      strokeWidth="1"
      opacity="0.6"
    >
      <animate
        attributeName="r"
        values="3;5;3"
        dur="2s"
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values="0.6;0.2;0.6"
        dur="2s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);

export default NeuroShieldLogo;
