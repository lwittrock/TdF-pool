import React, { useState, useMemo } from 'react'

// ============================================================================
// COLOR DEFINITIONS - Change these to experiment with different color schemes
// ============================================================================
const COLORS = {
  // Primary colors
  primary: '#2d3748',        // Dark gray/charcoal
  accent: '#10b981',         // Lime green (change this to experiment!)
  
  // Background colors
  background: '#f3f4f6',     // Light gray background
  tableRowEven: '#ffffff',   // White
  tableRowOdd: '#f9fafb',    // Very light gray
  tableRowHover: '#f3f4f6',  // Light gray
  expandedBg: '#f9fafb',     // Very light gray
  
  // Text colors
  textPrimary: '#111827',    // Almost black
  textSecondary: '#6b7280',  // Medium gray
  textMuted: '#9ca3af',      // Light gray
  
  // Accent variations
  accentHover: '#059669',    // Darker green for hover
  accentLight: '#d1fae5',    // Light green for highlights
  
  // Status colors
  green: '#10b981',          // Positive change
  red: '#ef4444',            // Negative change
  yellow: '#fef3c7',         // Podium highlight
};

// Data Import
import tdfData from '../data/tdf_data.json' with { type: "json" };

// Interfaces
interface LeaderboardEntry {
  participant_name: string;
  directie_name: string;
  overall_score: number;
  overall_rank: number;
  overall_rank_change: number;
  stage_score: number;
  stage_rank: number;
  stage_rider_contributions: {
    [key: string]: number;
  };
}

interface DirectieEntry {
  directie_name: string;
  overall_score: number;
  overall_rank: number;
  overall_rank_change: number;
  stage_score: number;
  stage_rank: number;
  stage_participant_contributions: Array<{
    participant_name: string;
    stage_score: number;
  }>;
  overall_participant_contributions: Array<{
    participant_name: string;
    overall_score: number;
  }>;
}

interface TdfData {
  metadata: {
    current_stage: number;
    top_n_participants_for_directie: number;
  };
  leaderboard_by_stage: Record<string, LeaderboardEntry[]>;
  directie_leaderboard_by_stage: Record<string, DirectieEntry[]>;
}

// View Type
type ViewType = 'stage_individual' | 'standings_individual' | 'standings_directie';


// Main Component
function HomePage() {
  const [activeView, setActiveView] = useState<ViewType>('standings_individual');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Destructure data from imported JSON with proper typing
  const data: TdfData = tdfData as unknown as TdfData;
  const { metadata, leaderboard_by_stage, directie_leaderboard_by_stage } = data;
  const currentStageNum = metadata.current_stage;
  const currentStageKey = `stage_${currentStageNum}`;

  // Get current stage leaderboards
  const currentLeaderboard = useMemo(() => 
    leaderboard_by_stage[currentStageKey] || [], 
    [leaderboard_by_stage, currentStageKey]
  );
  
  const currentDirectieLeaderboard = useMemo(() => 
    directie_leaderboard_by_stage[currentStageKey] || [], 
    [directie_leaderboard_by_stage, currentStageKey]
  );

  // Memorize stage results for current stage (sorted by stage_rank)
  const stageResults = useMemo(() => {
    return [...currentLeaderboard].sort((a, b) => a.stage_rank - b.stage_rank);
  }, [currentLeaderboard]);

  // Memorize filtered results based on active view and search term
  const filteredResults = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    
    if (!searchLower) {
      if (activeView === 'standings_individual') return currentLeaderboard;
      if (activeView === 'stage_individual') return stageResults;
      return currentDirectieLeaderboard;
    }

    // Filter based on view type
    if (activeView === 'standings_individual') {
      return currentLeaderboard.filter((p) => 
        p.participant_name.toLowerCase().includes(searchLower) ||
        p.directie_name.toLowerCase().includes(searchLower)
      );
    } else if (activeView === 'stage_individual') {
      return stageResults.filter((r) => 
        r.participant_name.toLowerCase().includes(searchLower) ||
        r.directie_name.toLowerCase().includes(searchLower)
      );
    } else {
      return currentDirectieLeaderboard.filter((d) => 
        d.directie_name.toLowerCase().includes(searchLower) ||
        d.overall_participant_contributions.some(cp => 
          cp.participant_name.toLowerCase().includes(searchLower)
        )
      );
    }
  }, [activeView, searchTerm, stageResults, currentDirectieLeaderboard, currentLeaderboard]); 

  // Helper to render rank change with arrows and colors
  const renderRankChange = (rankChange: number) => {
    if (rankChange > 0) {
      return <span style={{ color: COLORS.green }} className="font-semibold">↑ {rankChange}</span>;
    }
    if (rankChange < 0) {
      return <span style={{ color: COLORS.red }} className="font-semibold">↓ {Math.abs(rankChange)}</span>;
    }
    return <span style={{ color: COLORS.textMuted }}>—</span>;
  };

  // Helper to render medal emojis for top 3
  const renderMedal = (rank: number) => {
    if (rank === 1) return ' 🥇';
    if (rank === 2) return ' 🥈';
    if (rank === 3) return ' 🥉';
    return '';
  };

  // Toggle expanded item for details view
  const toggleItemDetails = (itemName: string) => {
    setExpandedItem(prev => prev === itemName ? null : itemName);
  };

  // Get participant stages data for expanded view
  const getParticipantStages = (participantName: string) => {
    const allStages: Array<{
      stageNum: number;
      stageKey: string;
      stage_score: number;
      stage_rank: number;
    }> = [];

    // Iterate through all stages in leaderboard_by_stage
    Object.entries(leaderboard_by_stage).forEach(([stageKey, stageData]) => {
      const participantEntry = stageData.find(
        p => p.participant_name === participantName
      );
      
      if (participantEntry) {
        allStages.push({
          stageNum: parseInt(stageKey.replace('stage_', '')),
          stageKey,
          stage_score: participantEntry.stage_score,
          stage_rank: participantEntry.stage_rank
        });
      }
    });

    return allStages.sort((a, b) => a.stageNum - b.stageNum);
  };

  // Get participant medals from all stages
  const getParticipantMedals = (participantName: string) => {
    let goldCount = 0;
    let silverCount = 0;
    let bronzeCount = 0;

    // Iterate through all stages to count medals
    Object.values(leaderboard_by_stage).forEach((stageData) => {
      const participantEntry = stageData.find(
        p => p.participant_name === participantName
      );
      
      if (participantEntry) {
        if (participantEntry.stage_rank === 1) goldCount++;
        else if (participantEntry.stage_rank === 2) silverCount++;
        else if (participantEntry.stage_rank === 3) bronzeCount++;
      }
    });

    // Return medals as string (grouped by type)
    const medals = [];
    if (goldCount > 0) medals.push('🥇'.repeat(goldCount));
    if (silverCount > 0) medals.push('🥈'.repeat(silverCount));
    if (bronzeCount > 0) medals.push('🥉'.repeat(bronzeCount));
    
    return medals.join('');
  };


  // Main render
  return (
    <div className="min-h-screen py-8 px-32" style={{ backgroundColor: COLORS.background }}>      {/* Header - No box, just title with icon */}
      <header className="mb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <h1 className="text-5xl font-bold" style={{ color: COLORS.primary }}>
            ACM Tour de France 2025 Poule
          </h1>
        </div>
      </header>

      {/* Navigation and Search */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8 items-center justify-center">
        
        {/* Navigation Tabs - No grouping box */}
        <div className="flex gap-3">
          <button
            onClick={() => setActiveView('stage_individual')}
            className="py-3 px-6 rounded-lg font-semibold transition-all"
            style={{
              backgroundColor: activeView === 'stage_individual' ? COLORS.accent : COLORS.tableRowEven,
              color: activeView === 'stage_individual' ? 'white' : COLORS.textSecondary,
              border: `2px solid ${activeView === 'stage_individual' ? COLORS.accent : 'transparent'}`,
            }}
          >
            Etappe Uitslagen
          </button>          
          <button
            onClick={() => setActiveView('standings_individual')}
            className="py-3 px-6 rounded-lg font-semibold transition-all"
            style={{
              backgroundColor: activeView === 'standings_individual' ? COLORS.accent : COLORS.tableRowEven,
              color: activeView === 'standings_individual' ? 'white' : COLORS.textSecondary,
              border: `2px solid ${activeView === 'standings_individual' ? COLORS.accent : 'transparent'}`,
            }}
          >
            Individueel Klassement
          </button>
          <button
            onClick={() => setActiveView('standings_directie')}
            className="py-3 px-6 rounded-lg font-semibold transition-all"
            style={{
              backgroundColor: activeView === 'standings_directie' ? COLORS.accent : COLORS.tableRowEven,
              color: activeView === 'standings_directie' ? 'white' : COLORS.textSecondary,
              border: `2px solid ${activeView === 'standings_directie' ? COLORS.accent : 'transparent'}`,
            }}
          >
            Directie Klassement
          </button>
        </div>

        {/* Search Filter - No box */}
        <div className="relative lg:w-80">
          <input
            type="text"
            placeholder="Zoek deelnemer of directie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 pr-10 rounded-lg transition-all"
            style={{
              backgroundColor: COLORS.tableRowEven,
              border: `2px solid transparent`,
              color: COLORS.textPrimary,
            }}
            onFocus={(e) => e.target.style.borderColor = COLORS.accent}
            onBlur={(e) => e.target.style.borderColor = 'transparent'}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: COLORS.textMuted }}
              aria-label="Clear search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Stage Results View */}
      {activeView === 'stage_individual' && (
        <main>
          <h2 className="text-2xl font-semibold mb-6" style={{ color: COLORS.primary }}>
            Etappe {currentStageNum} Resultaten
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: COLORS.tableRowOdd }}>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Positie</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Deelnemer</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Directie</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Punten</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Alg. Rank</th>
                </tr>
              </thead>
              <tbody>
                {(filteredResults as LeaderboardEntry[]).map((entry, idx) => {
                  const sortedRiders = Object.entries(entry.stage_rider_contributions)
                    .sort(([, a], [, b]) => b - a);

                  return (
                    <React.Fragment key={entry.participant_name}>
                      <tr 
                        className="transition-colors cursor-pointer"
                        style={{
                          backgroundColor: idx % 2 === 0 ? COLORS.tableRowEven : COLORS.tableRowOdd
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.tableRowHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? COLORS.tableRowEven : COLORS.tableRowOdd }
                        onClick={() => toggleItemDetails(entry.participant_name)}
                      >
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                          {entry.stage_rank}
                          {renderMedal(entry.stage_rank)}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: COLORS.textPrimary }}>
                          {entry.participant_name}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: COLORS.textSecondary }}>
                          {entry.directie_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: COLORS.textPrimary }}>
                          {entry.stage_score}
                        </td>
                        <td className="px-4 py-3 text-sm text-center" style={{ color: COLORS.textSecondary }}>
                          #{entry.overall_rank}
                        </td>
                      </tr>

                      {expandedItem === entry.participant_name && (
                        <tr style={{ backgroundColor: COLORS.expandedBg }}>
                          <td colSpan={5} className="px-4 py-4">
                            <div className="ml-8 max-w-md">
                              <h3 className="text-sm font-semibold mb-2 pb-2" style={{ color: COLORS.textSecondary, borderBottom: `1px solid ${COLORS.textMuted}` }}>
                                Renner Bijdragen
                              </h3>
                              <div>
                                {sortedRiders.map(([rider, points]) => (
                                  <div 
                                    key={rider}
                                    className="flex justify-between items-center py-1 px-2 rounded transition-colors"
                                    style={{ backgroundColor: 'transparent' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.tableRowHover}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <span className="text-sm" style={{ color: COLORS.textSecondary }}>{rider}</span>
                                    <span className="text-sm font-bold" style={{ color: COLORS.textPrimary }}>{points}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* Overall Leaderboard View */}
      {activeView === 'standings_individual' && (
        <main>
          <h2 className="text-2xl font-semibold mb-6" style={{ color: COLORS.primary }}>Algemeen Klassement</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: COLORS.tableRowOdd }}>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Rank</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold" style={{ color: COLORS.textSecondary }}>+/-</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Deelnemer</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Directie</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Totaal Punten</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Etappe Medailles</th>
                </tr>
              </thead>
              <tbody>
                {(filteredResults as LeaderboardEntry[]).map((entry, idx) => {
                  const medals = getParticipantMedals(entry.participant_name);
                  
                  return (
                    <React.Fragment key={entry.participant_name}>
                      <tr 
                        className="transition-colors cursor-pointer"
                        style={{
                          backgroundColor: idx % 2 === 0 ? COLORS.tableRowEven : COLORS.tableRowOdd
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.tableRowHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? COLORS.tableRowEven : COLORS.tableRowOdd}
                        onClick={() => toggleItemDetails(entry.participant_name)}
                      >
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                          {entry.overall_rank}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {renderRankChange(entry.overall_rank_change)}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: COLORS.textPrimary }}>
                          {entry.participant_name}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: COLORS.textSecondary }}>
                          {entry.directie_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: COLORS.textPrimary }}>
                          {entry.overall_score}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {medals || ''}
                        </td>
                      </tr>
                      
                      {expandedItem === entry.participant_name && (
                        <tr style={{ backgroundColor: COLORS.expandedBg }}>
                          <td colSpan={6} className="px-4 py-4">
                            <div className="ml-8 max-w-md">
                              <h3 className="text-sm font-semibold mb-2 pb-2" style={{ color: COLORS.textSecondary, borderBottom: `1px solid ${COLORS.textMuted}` }}>
                                Punten per Etappe
                              </h3>
                              <div>
                                {getParticipantStages(entry.participant_name).map(stage => (
                                  <div 
                                    key={stage.stageKey}
                                    className="flex justify-between items-center py-1 px-2 rounded transition-colors"
                                    style={{ backgroundColor: 'transparent' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.tableRowHover}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <span className="text-sm" style={{ color: COLORS.textSecondary }}>
                                      Etappe {stage.stageNum}:
                                    </span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs" style={{ color: COLORS.textMuted }}>
                                        #{stage.stage_rank}
                                      </span>
                                      <span className="text-sm font-bold" style={{ color: COLORS.textPrimary }}>
                                        {stage.stage_score}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* Directie Leaderboard View */}
      {activeView === 'standings_directie' && (
        <main>
          <h2 className="text-2xl font-semibold mb-6" style={{ color: COLORS.primary }}>Directie Klassement</h2>
          <p className="text-sm mb-6" style={{ color: COLORS.textSecondary }}>
            Top {metadata.top_n_participants_for_directie} deelnemers per directie per etappe tellen mee
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: COLORS.tableRowOdd }}>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Rank</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold" style={{ color: COLORS.textSecondary }}>+/-</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Directie</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold" style={{ color: COLORS.textSecondary }}>Totaal Punten</th>
                </tr>
              </thead>
              <tbody>
                {(filteredResults as DirectieEntry[]).map((entry, idx) => {
                  const isExpanded = expandedItem === entry.directie_name;

                  return (
                    <React.Fragment key={entry.directie_name}>
                      <tr 
                        className="transition-colors cursor-pointer"
                        style={{
                          backgroundColor: idx % 2 === 0 ? COLORS.tableRowEven : COLORS.tableRowOdd
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.tableRowHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? COLORS.tableRowEven : COLORS.tableRowOdd}
                        onClick={() => toggleItemDetails(entry.directie_name)}
                      >
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                          {entry.overall_rank}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {renderRankChange(entry.overall_rank_change)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                          {entry.directie_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: COLORS.textPrimary }}>
                          {entry.overall_score}
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr style={{ backgroundColor: COLORS.expandedBg }}>
                          <td colSpan={4} className="px-4 py-4">
                            <div className="ml-8 max-w-2xl">
                              <h3 className="text-sm font-semibold mb-2 pb-2" style={{ color: COLORS.textSecondary, borderBottom: `1px solid ${COLORS.textMuted}` }}>
                                Totale Bijdragen per Deelnemer
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {entry.overall_participant_contributions.map((participant, pidx) => (
                                  <div 
                                    key={participant.participant_name}
                                    className="flex justify-between items-center py-2 px-3 rounded transition-colors"
                                    style={{ backgroundColor: 'transparent' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.tableRowHover}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <span className="text-sm flex items-center gap-2" style={{ color: COLORS.textSecondary }}>
                                      <span className="text-xs font-semibold w-5" style={{ color: COLORS.textMuted }}>
                                        #{pidx + 1}
                                      </span>
                                      {participant.participant_name}
                                    </span>
                                    <span className="text-sm font-bold" style={{ color: COLORS.textPrimary }}>
                                      {participant.overall_score}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      )}
    </div>
  )
}

export default HomePage