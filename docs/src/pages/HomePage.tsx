import React, { useState, useMemo } from 'react'

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
      return <span className="font-semibold text-[var(--color-green)]">↑ {rankChange}</span>;
    }
    if (rankChange < 0) {
      return <span className="font-semibold text-[var(--color-red)]">↓ {Math.abs(rankChange)}</span>;
    }
    return <span className="text-[var(--color-text-muted)]">—</span>;
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
    <div className="min-h-screen py-8 px-32 bg-[var(--color-background)]">
      {/* Header - No box, just title with icon */}
      <header className="mb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <h1 className="text-5xl font-bold text-[var(--color-primary)]">
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
            className={`py-3 px-6 rounded-lg font-semibold transition-all ${
              activeView === 'stage_individual'
                ? 'bg-[var(--color-accent)] text-white border-2 border-[var(--color-accent)]'
                : 'bg-[var(--color-table-row-even)] text-[var(--color-text-secondary)] border-2 border-transparent'
            }`}
          >
            Etappe Uitslagen
          </button>          
          <button
            onClick={() => setActiveView('standings_individual')}
            className={`py-3 px-6 rounded-lg font-semibold transition-all ${
              activeView === 'standings_individual'
                ? 'bg-[var(--color-accent)] text-white border-2 border-[var(--color-accent)]'
                : 'bg-[var(--color-table-row-even)] text-[var(--color-text-secondary)] border-2 border-transparent'
            }`}
          >
            Individueel Klassement
          </button>
          <button
            onClick={() => setActiveView('standings_directie')}
            className={`py-3 px-6 rounded-lg font-semibold transition-all ${
              activeView === 'standings_directie'
                ? 'bg-[var(--color-accent)] text-white border-2 border-[var(--color-accent)]'
                : 'bg-[var(--color-table-row-even)] text-[var(--color-text-secondary)] border-2 border-transparent'
            }`}
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
            className="w-full px-4 py-3 pr-10 rounded-lg transition-all bg-[var(--color-table-row-even)] border-2 border-transparent text-[var(--color-text-primary)] focus:border-[var(--color-accent)]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors text-[var(--color-text-muted)]"
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
          <h2 className="text-2xl font-semibold mb-6 text-[var(--color-primary)]">
            Etappe {currentStageNum} Resultaten
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--color-table-row-odd)]">
                  <th className="px-4 py-4 text-left text-sm font-semibold text-[var(--color-text-secondary)]">Positie</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-[var(--color-text-secondary)]">Deelnemer</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-[var(--color-text-secondary)]">Directie</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold text-[var(--color-text-secondary)]">Punten</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-[var(--color-text-secondary)]">Alg. Rank</th>
                </tr>
              </thead>
              <tbody>
                {(filteredResults as LeaderboardEntry[]).map((entry, idx) => {
                  const sortedRiders = Object.entries(entry.stage_rider_contributions)
                    .sort(([, a], [, b]) => b - a);

                  return (
                    <React.Fragment key={entry.participant_name}>
                      <tr 
                        className={`transition-colors cursor-pointer hover:bg-[var(--color-table-row-hover)] ${
                          idx % 2 === 0 ? 'bg-[var(--color-table-row-even)]' : 'bg-[var(--color-table-row-odd)]'
                        }`}
                        onClick={() => toggleItemDetails(entry.participant_name)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">
                          {entry.stage_rank}
                          {renderMedal(entry.stage_rank)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">
                          {entry.participant_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                          {entry.directie_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-[var(--color-text-primary)]">
                          {entry.stage_score}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-[var(--color-text-secondary)]">
                          #{entry.overall_rank}
                        </td>
                      </tr>

                      {expandedItem === entry.participant_name && (
                        <tr className="bg-[var(--color-expanded-bg)]">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="ml-8 max-w-md">
                              <h3 className="text-sm font-semibold mb-2 pb-2 text-[var(--color-text-secondary)] border-b border-[var(--color-text-muted)]">
                                Renner Bijdragen
                              </h3>
                              <div>
                                {sortedRiders.map(([rider, points]) => (
                                  <div 
                                    key={rider}
                                    className="flex justify-between items-center py-1 px-2 rounded transition-colors hover:bg-[var(--color-table-row-hover)]"
                                  >
                                    <span className="text-sm text-[var(--color-text-secondary)]">{rider}</span>
                                    <span className="text-sm font-bold text-[var(--color-text-primary)]">{points}</span>
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
          <h2 className="text-2xl font-semibold mb-6 text-[var(--color-primary)]">Algemeen Klassement</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--color-table-row-odd)]">
                  <th className="px-4 py-4 text-left text-sm font-semibold text-[var(--color-text-secondary)]">Rank</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-[var(--color-text-secondary)]">+/-</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-[var(--color-text-secondary)]">Deelnemer</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-[var(--color-text-secondary)]">Directie</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold text-[var(--color-text-secondary)]">Totaal Punten</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-[var(--color-text-secondary)]">Etappe Medailles</th>
                </tr>
              </thead>
              <tbody>
                {(filteredResults as LeaderboardEntry[]).map((entry, idx) => {
                  const medals = getParticipantMedals(entry.participant_name);
                  
                  return (
                    <React.Fragment key={entry.participant_name}>
                      <tr 
                        className={`transition-colors cursor-pointer hover:bg-[var(--color-table-row-hover)] ${
                          idx % 2 === 0 ? 'bg-[var(--color-table-row-even)]' : 'bg-[var(--color-table-row-odd)]'
                        }`}
                        onClick={() => toggleItemDetails(entry.participant_name)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">
                          {entry.overall_rank}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {renderRankChange(entry.overall_rank_change)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">
                          {entry.participant_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                          {entry.directie_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-[var(--color-text-primary)]">
                          {entry.overall_score}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {medals || ''}
                        </td>
                      </tr>
                      
                      {expandedItem === entry.participant_name && (
                        <tr className="bg-[var(--color-expanded-bg)]">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="ml-8 max-w-md">
                              <h3 className="text-sm font-semibold mb-2 pb-2 text-[var(--color-text-secondary)] border-b border-[var(--color-text-muted)]">
                                Punten per Etappe
                              </h3>
                              <div>
                                {getParticipantStages(entry.participant_name).map(stage => (
                                  <div 
                                    key={stage.stageKey}
                                    className="flex justify-between items-center py-1 px-2 rounded transition-colors hover:bg-[var(--color-table-row-hover)]"
                                  >
                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                      Etappe {stage.stageNum}:
                                    </span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-[var(--color-text-muted)]">
                                        #{stage.stage_rank}
                                      </span>
                                      <span className="text-sm font-bold text-[var(--color-text-primary)]">
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
          <h2 className="text-2xl font-semibold mb-6 text-[var(--color-primary)]">Directie Klassement</h2>
          <p className="text-sm mb-6 text-[var(--color-text-secondary)]">
            Top {metadata.top_n_participants_for_directie} deelnemers per directie per etappe tellen mee
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--color-table-row-odd)]">
                  <th className="px-4 py-4 text-left text-sm font-semibold text-[var(--color-text-secondary)]">Rank</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-[var(--color-text-secondary)]">+/-</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-[var(--color-text-secondary)]">Directie</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold text-[var(--color-text-secondary)]">Totaal Punten</th>
                </tr>
              </thead>
              <tbody>
                {(filteredResults as DirectieEntry[]).map((entry, idx) => {
                  const isExpanded = expandedItem === entry.directie_name;

                  return (
                    <React.Fragment key={entry.directie_name}>
                      <tr 
                        className={`transition-colors cursor-pointer hover:bg-[var(--color-table-row-hover)] ${
                          idx % 2 === 0 ? 'bg-[var(--color-table-row-even)]' : 'bg-[var(--color-table-row-odd)]'
                        }`}
                        onClick={() => toggleItemDetails(entry.directie_name)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">
                          {entry.overall_rank}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {renderRankChange(entry.overall_rank_change)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">
                          {entry.directie_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-[var(--color-text-primary)]">
                          {entry.overall_score}
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="bg-[var(--color-expanded-bg)]">
                          <td colSpan={4} className="px-4 py-4">
                            <div className="ml-8 max-w-2xl">
                              <h3 className="text-sm font-semibold mb-2 pb-2 text-[var(--color-text-secondary)] border-b border-[var(--color-text-muted)]">
                                Totale Bijdragen per Deelnemer
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {entry.overall_participant_contributions.map((participant, pidx) => (
                                  <div 
                                    key={participant.participant_name}
                                    className="flex justify-between items-center py-2 px-3 rounded transition-colors hover:bg-[var(--color-table-row-hover)]"
                                  >
                                    <span className="text-sm flex items-center gap-2 text-[var(--color-text-secondary)]">
                                      <span className="text-xs font-semibold w-5 text-[var(--color-text-muted)]">
                                        #{pidx + 1}
                                      </span>
                                      {participant.participant_name}
                                    </span>
                                    <span className="text-sm font-bold text-[var(--color-text-primary)]">
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