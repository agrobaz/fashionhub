import type { SVGProps } from "react";

export default function FashionHubLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 300 82"
      role="img"
      aria-label="FashionHub"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="fashionhub-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="48%" stopColor="#d9b36c" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      <g transform="translate(4 8)">
        <path
          d="M31 9h29l8 12-8 38H31L23 21z"
          fill="none"
          stroke="url(#fashionhub-gradient)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M30 9c2 8 8 12 15 12S58 17 60 9"
          fill="none"
          stroke="url(#fashionhub-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M38 30h16M38 39h16M38 48h10"
          fill="none"
          stroke="url(#fashionhub-gradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>

      <text
        x="88"
        y="53"
        fill="url(#fashionhub-gradient)"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="32"
        fontWeight="800"
        letterSpacing="-1"
      >
        FashionHub
      </text>
    </svg>
  );
}
