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

export function AchievementCategoryIcon({ type, className = '', size = 20 }) {
  switch (type) {
    case 'first_slice':
    case 'first_blood':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="14" r="7" fill="rgba(239, 68, 68, 0.25)" stroke="#EF4444" />
          <line x1="3" y1="5" x2="21" y2="19" stroke="#38BDF8" strokeWidth="2.2" />
        </svg>
      );
    case 'first_combo':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="rgba(56, 189, 248, 0.3)" stroke="#38BDF8" />
        </svg>
      );
    case 'combo_10':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="#38BDF8" fill="rgba(56, 189, 248, 0.2)" />
          <text x="12" y="15.5" fontSize="9" fontWeight="900" textAnchor="middle" fill="#38BDF8" stroke="none" fontFamily="monospace">10</text>
        </svg>
      );
    case 'combo_25':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <polygon points="12 2 21 8 18 20 6 20 3 8" fill="rgba(245, 158, 11, 0.25)" stroke="#F59E0B" />
          <text x="12" y="15.5" fontSize="9" fontWeight="900" textAnchor="middle" fill="#F59E0B" stroke="none" fontFamily="monospace">25</text>
        </svg>
      );
    case 'combo_50':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="rgba(239, 68, 68, 0.3)" stroke="#EF4444" />
          <text x="12" y="15" fontSize="8" fontWeight="900" textAnchor="middle" fill="#FFFFFF" stroke="none" fontFamily="monospace">50</text>
        </svg>
      );
    case 'fruits_100':
    case 'century_club':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="8" cy="13" r="5" fill="rgba(239, 68, 68, 0.3)" stroke="#EF4444" />
          <circle cx="16" cy="13" r="5" fill="rgba(16, 185, 129, 0.3)" stroke="#10B981" />
          <path d="M12 4v4" stroke="#F59E0B" />
        </svg>
      );
    case 'fruits_1000':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 2l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" fill="rgba(245, 158, 11, 0.3)" stroke="#F59E0B" />
          <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
        </svg>
      );
    case 'first_fever':
    case 'fever_initiate':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 2c-2 3-5 5-5 10a7 7 0 0 0 14 0c0-4-3-7-4.5-9-1 2-2 3-4.5 3-.5 0-1-.1-1.5-.3C11.5 4.5 12 3 12 2z" stroke="#EF4444" fill="rgba(239, 68, 68, 0.3)" />
          <path d="M12 11a3 3 0 0 0-3 3c0 2 1.5 3 3 3s3-1 3-3a3 3 0 0 0-3-3z" fill="#F59E0B" />
        </svg>
      );
    case 'perfect_slice':
    case 'perfect_slasher':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8" stroke="#38BDF8" strokeDasharray="3 3" />
          <circle cx="12" cy="12" r="3" fill="#38BDF8" />
          <line x1="2" y1="12" x2="22" y2="12" stroke="#38BDF8" strokeWidth="1.5" />
          <line x1="12" y1="2" x2="12" y2="22" stroke="#38BDF8" strokeWidth="1.5" />
        </svg>
      );
    case 'multi_slice':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <line x1="4" y1="6" x2="20" y2="6" stroke="#EC4899" strokeWidth="2" />
          <line x1="2" y1="12" x2="22" y2="12" stroke="#A855F7" strokeWidth="2.5" />
          <line x1="4" y1="18" x2="20" y2="18" stroke="#38BDF8" strokeWidth="2" />
        </svg>
      );
    case 'high_score':
    case 'grandmaster':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" stroke="#F59E0B" />
          <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" stroke="#F59E0B" />
          <path d="M4 3h16v7a8 8 0 0 1-16 0V3z" fill="rgba(245, 158, 11, 0.2)" stroke="#F59E0B" />
          <path d="M12 17v4M8 21h8" stroke="#F59E0B" />
        </svg>
      );
    case 'long_survival':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="13" r="8" fill="rgba(16, 185, 129, 0.2)" stroke="#10B981" />
          <polyline points="12 9 12 13 15 15" stroke="#10B981" strokeWidth="2" />
          <path d="M12 2v3M9 2h6" stroke="#10B981" />
        </svg>
      );
    case 'bomb_avoider':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(245, 158, 11, 0.25)" stroke="#F59E0B" />
          <polyline points="9 12 11 14 15 10" stroke="#FFFFFF" strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="rgba(245, 158, 11, 0.25)" stroke="#F59E0B" />
        </svg>
      );
  }
}
