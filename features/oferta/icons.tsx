import type { OfertaIcon } from "./types";

const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function FeatureIcon({ icon }: { icon: OfertaIcon }) {
  switch (icon) {
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "ruler":
      return (
        <svg {...common}>
          <path d="M3 17L17 3l4 4L7 21z" />
          <path d="M8 12l2 2M11 9l2 2M14 6l2 2" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "wind":
      return (
        <svg {...common}>
          <path d="M3 8h11a3 3 0 1 0-3-3" />
          <path d="M3 12h15a3 3 0 1 1-3 3" />
          <path d="M3 16h8a2 2 0 1 1-2 2" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "palette":
      return (
        <svg {...common}>
          <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.2-1-1.5-1-2.5 0-1 .8-1.5 2-1.5h1.5A3.5 3.5 0 0 0 20 11.5C20 6.8 16.4 3 12 3z" />
          <circle cx="7.5" cy="11" r="1" />
          <circle cx="10" cy="7.5" r="1" />
          <circle cx="14.5" cy="7.5" r="1" />
        </svg>
      );
    case "tools":
      return (
        <svg {...common}>
          <path d="M14.5 6.5a3.5 3.5 0 0 0 4.3 4.3L21 13l-8 8-2.2-2.2 8-8" />
          <path d="M3 5l4-2 3 3-2 4-5-5z" />
          <path d="M8 8l6 6" />
        </svg>
      );
    case "leaf":
      return (
        <svg {...common}>
          <path d="M4 20c0-9 5-14 16-16-1 11-6 16-16 16z" />
          <path d="M4 20c4-5 8-8 12-11" />
        </svg>
      );
    case "eye":
    default:
      return (
        <svg {...common}>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}
