import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { CrestIcon, MissionCategoryIcon, AchievementCategoryIcon } from './ProgressionIcons.jsx';
import styles from './ProgressionModal.module.css';

export function ProgressionModal({
  isOpen,
  onClose,
  progressionManager,
  audioManager,
}) {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);

  const [activeTab, setActiveTab] = useState('missions');
  const [data, setData] = useState(() => {
    if (progressionManager) {
      return {
        currency: progressionManager.getCurrency(),
        profile: progressionManager.getProfile(),
        missions: progressionManager.getMissions(),
        achievements: progressionManager.getAchievements(),
        unclaimedCount: progressionManager.getUnclaimedCount(),
      };
    }
    return {
      currency: 0,
      profile: {
        totalFruitsSliced: 0,
        highestScore: 0,
        highestCombo: 0,
        totalGames: 0,
        totalPlayTime: 0,
        missionsCompleted: 0,
        specialAchievements: [],
      },
      missions: [],
      achievements: [],
      unclaimedCount: 0,
    };
  });

  // Subscribe to real-time progression changes
  useEffect(() => {
    if (!progressionManager) return;
    const unsubscribe = progressionManager.subscribe((latest) => {
      setData(latest);
    });
    return unsubscribe;
  }, [progressionManager]);

  // Handle entrance animation and keyboard close
  useEffect(() => {
    if (!isOpen) return;

    if (modalRef.current) {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.22, ease: 'power2.out' }
      );
      gsap.fromTo(
        modalRef.current,
        { opacity: 0, scale: 0.92, y: 16 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.25)' }
      );
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClaim = (missionId) => {
    if (!progressionManager) return;
    if (audioManager) audioManager.playPowerUpPickup('double_score');
    progressionManager.claimReward(missionId);
  };

  const handleClaimAll = () => {
    if (!progressionManager) return;
    if (audioManager) audioManager.playPowerUpPickup('frenzy');
    progressionManager.claimAllRewards();
  };

  const formatPlayTime = (seconds) => {
    const totalSec = Math.floor(seconds || 0);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m`;
    }
    return `${m}m ${s}s`;
  };

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="progression-heading"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div ref={modalRef} className={styles.modal}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.subtitle}>Dojo Career</span>
            <h2 id="progression-heading" className={styles.title}>Progression</h2>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.currencyPill} title="Blade Crests Currency">
              <CrestIcon size={18} />
              <span className={styles.currencyAmount}>{data.currency}</span>
              <span className={styles.currencyLabel}>Crests</span>
            </div>

            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              onMouseEnter={() => audioManager?.playButtonHover()}
              aria-label="Close progression modal"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className={styles.tabNav} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'missions'}
            className={`${styles.tabButton} ${activeTab === 'missions' ? styles.tabButtonActive : ''}`}
            onClick={() => {
              if (audioManager) audioManager.playButtonClick();
              setActiveTab('missions');
            }}
          >
            <span>Missions</span>
            {data.unclaimedCount > 0 && (
              <span className={styles.badgePill}>{data.unclaimedCount}</span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'profile'}
            className={`${styles.tabButton} ${activeTab === 'profile' ? styles.tabButtonActive : ''}`}
            onClick={() => {
              if (audioManager) audioManager.playButtonClick();
              setActiveTab('profile');
            }}
          >
            <span>Career Profile</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'achievements'}
            className={`${styles.tabButton} ${activeTab === 'achievements' ? styles.tabButtonActive : ''}`}
            onClick={() => {
              if (audioManager) audioManager.playButtonClick();
              setActiveTab('achievements');
            }}
          >
            <span>Achievements</span>
          </button>
        </nav>

        {/* Tab Content */}
        <div className={styles.contentArea}>
          {activeTab === 'missions' && (
            <>
              {data.unclaimedCount > 1 && (
                <div className={styles.claimAllBar}>
                  <span className={styles.claimAllText}>
                    {data.unclaimedCount} missions ready to claim!
                  </span>
                  <button
                    type="button"
                    className={styles.claimAllBtn}
                    onClick={handleClaimAll}
                    onMouseEnter={() => audioManager?.playButtonHover()}
                  >
                    Claim All
                  </button>
                </div>
              )}

              <div className={styles.missionList}>
                {data.missions.map((mission) => {
                  const percent = Math.min(100, Math.round((mission.progress / mission.target) * 100));
                  return (
                    <div
                      key={mission.id}
                      className={`${styles.missionCard} ${mission.completed && !mission.claimed ? styles.missionCardCompleted : ''} ${mission.claimed ? styles.missionCardClaimed : ''}`}
                    >
                      <div className={styles.missionLeft}>
                        <div className={styles.iconBox}>
                          <MissionCategoryIcon type={mission.iconType} size={22} />
                        </div>

                        <div className={styles.missionDetails}>
                          <div className={styles.missionHeaderRow}>
                            <h3 className={styles.missionTitle}>{mission.title}</h3>
                            <span className={styles.categoryTag}>{mission.category}</span>
                          </div>
                          <p className={styles.missionDesc}>{mission.description}</p>

                          <div className={styles.progressContainer}>
                            <div className={styles.progressBarTrack}>
                              <div
                                className={`${styles.progressBarFill} ${mission.completed ? styles.progressBarFillDone : ''}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className={styles.progressLabel}>
                              {mission.progress} / {mission.target}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.missionRight}>
                        <div className={styles.rewardBadge}>
                          <CrestIcon size={14} />
                          <span className={styles.rewardValue}>+{mission.reward}</span>
                        </div>

                        {mission.claimed ? (
                          <span className={styles.claimedBadge}>Claimed</span>
                        ) : mission.completed ? (
                          <button
                            type="button"
                            className={styles.claimButton}
                            onClick={() => handleClaim(mission.id)}
                            onMouseEnter={() => audioManager?.playButtonHover()}
                          >
                            Claim
                          </button>
                        ) : (
                          <span className={styles.inProgressBadge}>In Progress</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'profile' && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Total Fruits Sliced</span>
                <span className={`${styles.statValue} ${styles.statValueHighlight}`}>
                  {data.profile.totalFruitsSliced.toLocaleString()}
                </span>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statLabel}>Highest Score</span>
                <span className={`${styles.statValue} ${styles.statValueGold}`}>
                  {data.profile.highestScore.toLocaleString()}
                </span>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statLabel}>Highest Combo</span>
                <span className={styles.statValue}>
                  {data.profile.highestCombo > 0 ? `${data.profile.highestCombo}x` : '0x'}
                </span>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statLabel}>Games Played</span>
                <span className={styles.statValue}>
                  {data.profile.totalGames}
                </span>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statLabel}>Total Play Time</span>
                <span className={styles.statValue}>
                  {formatPlayTime(data.profile.totalPlayTime)}
                </span>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statLabel}>Missions Completed</span>
                <span className={`${styles.statValue} ${styles.statValueHighlight}`}>
                  {data.profile.missionsCompleted}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div className={styles.achievementsList}>
              {data.achievements.map((ach) => (
                <div
                  key={ach.id}
                  className={`${styles.achievementCard} ${ach.isUnlocked ? styles.achievementCardUnlocked : ''}`}
                >
                  <div className={styles.achievementLeft}>
                    <div className={`${styles.achievementIcon} ${!ach.isUnlocked ? styles.achievementLockedIcon : ''}`}>
                      <AchievementCategoryIcon type={ach.iconType || ach.id} size={22} />
                    </div>
                    <div>
                      <h4 className={styles.achievementTitle}>{ach.title}</h4>
                      <p className={styles.achievementDesc}>{ach.description}</p>
                    </div>
                  </div>

                  <div className={styles.missionRight}>
                    <div className={styles.rewardBadge}>
                      <CrestIcon size={14} />
                      <span className={styles.rewardValue}>+{ach.reward}</span>
                    </div>

                    {ach.isUnlocked ? (
                      <span className={styles.unlockedBadge}>Unlocked</span>
                    ) : (
                      <span className={styles.lockedBadge}>Locked</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
