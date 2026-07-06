interface HolisLogoProps {
  className?: string;
  size?: number;
}

export function HolisLogo({ className = "", size = 32 }: HolisLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer circle */}
      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="2.5" fill="none" />
      {/* Spiral */}
      <path
        d="M50 28
           C36 28, 26 38, 26 50
           C26 62, 36 72, 50 72
           C62 72, 70 64, 70 54
           C70 44, 62 38, 54 38
           C46 38, 40 44, 40 50
           C40 56, 44 60, 50 60
           C55 60, 58 57, 58 53
           C58 49, 55 47, 52 47"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
