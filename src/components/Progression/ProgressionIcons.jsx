/**
 * Pure vector SVG icons for Progression, Missions, Currency, and Achievements.
 * High-DPI optimized, responsive, and completely emoji-free.
 */

export function CrestIcon({ className = '', size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="crestGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      {/* Outer Diamond Shield */}
      <polygon
        points="12 2 21 9 17 21 7 21 3 9"
        fill="url(#crestGoldGrad)"
        stroke="#FDE047"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Inner Facet */}
      <polygon
        points="12 5 18 10 15 19 9 19 6 10"
        fill="#78350F"
        opacity="0.35"
      />
      {/* Center Star Core */}
      <polygon
        points="12 7 13.5 11 17.5 12 13.5 13 12 17 10.5 13 6.5 12 10.5 11"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function MissionCategoryIcon({ type, className = '', size = 20 }) {
  switch (type) {
    case 'watermelon':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2v20z" fill="rgba(16, 185, 129, 0.2)" stroke="#10B981" />
          <path d="M12 6c-3.31 0-6 2.69-6 6 0 3.31 2.69 6 6 6V6z" fill="rgba(239, 68, 68, 0.4)" stroke="#EF4444" />
          <circle cx="9" cy="12" r="0.8" fill="#FFFFFF" />
          <circle cx="10" cy="9" r="0.8" fill="#FFFFFF" />
          <circle cx="10" cy="15" r="0.8" fill="#FFFFFF" />
        </svg>
      );
    case 'combo':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <line x1="4" y1="20" x2="20" y2="4" stroke="#38BDF8" strokeWidth="2.5" />
          <polyline points="14 4 20 4 20 10" stroke="#38BDF8" />
          <line x1="4" y1="4" x2="13" y2="13" stroke="#F59E0B" strokeWidth="1.8" />
        </svg>
      );
    case 'score':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="rgba(245, 158, 11, 0.25)" stroke="#F59E0B" />
        </svg>
      );
    case 'multislice':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <line x1="3" y1="7" x2="21" y2="7" stroke="#A855F7" strokeWidth="2" />
          <line x1="3" y1="12" x2="21" y2="12" stroke="#EC4899" strokeWidth="2.5" />
          <line x1="3" y1="17" x2="21" y2="17" stroke="#38BDF8" strokeWidth="2" />
        </svg>
      );
    case 'survival':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="13" r="8" stroke="#10B981" />
          <polyline points="12 9 12 13 15 15" stroke="#10B981" />
          <path d="M12 2v3M9 2h6" stroke="#10B981" />
        </svg>
      );
    case 'fever':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5 0-1-.5-1.5-1.5-2.5-1-1-1.5-2-1.5-3.5 0-.5.1-1 .3-1.5-1.8 1-3.3 2.8-3.3 5 0 1 .4 1.8 1 2.5z" fill="#F59E0B" />
          <path d="M12 2c-2 3-5 5-5 10a7 7 0 0 0 14 0c0-4-3-7-4.5-9-1 2-2 3-4.5 3-.5 0-1-.1-1.5-.3C11.5 4.5 12 3 12 2z" stroke="#EF4444" fill="rgba(239, 68, 68, 0.25)" />
        </svg>
      );
    case 'special':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <polygon points="12 2 15 8 21 9 17 14 18 20 12 17 6 20 7 14 3 9 9 8 12 2" fill="rgba(6, 182, 212, 0.3)" stroke="#06B6D4" />
          <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
        </svg>
      );
    case 'fruit':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="14" r="7" fill="rgba(239, 68, 68, 0.25)" stroke="#EF4444" />
          <path d="M12 7c0-2.5 1.5-4 3.5-4" stroke="#10B981" />
          <path d="M12 7c-1-1.5-2.5-2-4-2" stroke="#10B981" />
        </svg>
      );
  }
}
