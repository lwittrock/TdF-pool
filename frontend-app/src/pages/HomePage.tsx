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
      return <span className="text-green-600 font-semibold">↑ {rankChange}</span>;
    }
    if (rankChange < 0) {
      return <span className="text-red-600 font-semibold">↓ {Math.abs(rankChange)}</span>;
    }
    return <span className="text-gray-400">—</span>;
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
    <div className="min-h-screen bg-gray-100 p-8">
      <header className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h1 className="text-4xl font-bold text-blue-600">ACM TdF 2025 Poule</h1>
      </header>

      {/* Navigation and Search */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        
        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md p-2 flex gap-2 lg:flex-1">
          <button
            onClick={() => setActiveView('stage_individual')}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-colors ${
              activeView === 'stage_individual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Etappe Uitslagen
          </button>          
          <button
            onClick={() => setActiveView('standings_individual')}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-colors ${
              activeView === 'standings_individual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Algemeen Klassement
          </button>
          <button
            onClick={() => setActiveView('standings_directie')}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-colors ${
              activeView === 'standings_directie'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Directie Klassement
          </button>
        </div>

        {/* Search Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 lg:w-80">
          <div className="relative">
            <input
              type="text"
              placeholder="Zoek deelnemer of directie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stage Results View */}
      {activeView === 'stage_individual' && (
        <main className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-6">
            Etappe {currentStageNum} Uitslagen
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Positie</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Deelnemer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Directie</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Punten</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Alg. Rank</th>
                </tr>
              </thead>
              <tbody>
                {(filteredResults as LeaderboardEntry[]).map((entry) => {
                  const sortedRiders = Object.entries(entry.stage_rider_contributions)
                    .sort(([, a], [, b]) => b - a);

                  return (
                    <React.Fragment key={entry.participant_name}>
                      <tr 
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                          entry.stage_rank <= 3 ? 'bg-yellow-50' : ''
                        }`}
                        onClick={() => toggleItemDetails(entry.participant_name)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {entry.stage_rank}
                          {renderMedal(entry.stage_rank)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {entry.participant_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {entry.directie_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                          {entry.stage_score}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-center">
                          #{entry.overall_rank}
                        </td>
                      </tr>

                      {expandedItem === entry.participant_name && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="ml-8 max-w-md">
                              <h3 className="text-sm font-semibold text-gray-700 mb-2 pb-2 border-b border-gray-300">
                                Renner Bijdragen
                              </h3>
                              <div>
                                {sortedRiders.map(([rider, points]) => (
                                  <div 
                                    key={rider}
                                    className="flex justify-between items-center py-1 px-2 hover:bg-gray-100 rounded transition-colors"
                                  >
                                    <span className="text-sm text-gray-700">{rider}</span>
                                    <span className="text-sm font-bold text-gray-900">{points}</span>
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
        <main className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-6">Algemeen Klassement</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rank</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">+/-</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Deelnemer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Directie</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Totaal Punten</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Etappe Medailles</th>
                </tr>
              </thead>
              <tbody>
                {(filteredResults as LeaderboardEntry[]).map((entry) => {
                  const medals = getParticipantMedals(entry.participant_name);
                  
                  return (
                    <React.Fragment key={entry.participant_name}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => toggleItemDetails(entry.participant_name)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {entry.overall_rank}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {renderRankChange(entry.overall_rank_change)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {entry.participant_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {entry.directie_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                          {entry.overall_score}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {medals || ''}
                        </td>
                      </tr>
                      
                      {expandedItem === entry.participant_name && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="ml-8 max-w-md">
                              <h3 className="text-sm font-semibold text-gray-700 mb-2 pb-2 border-b border-gray-300">
                                Punten per Etappe
                              </h3>
                              <div>
                                {getParticipantStages(entry.participant_name).map(stage => (
                                  <div 
                                    key={stage.stageKey}
                                    className="flex justify-between items-center py-1 px-2 hover:bg-gray-100 rounded transition-colors"
                                  >
                                    <span className="text-sm text-gray-700">
                                      Etappe {stage.stageNum}:
                                    </span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-gray-500">
                                        #{stage.stage_rank}
                                      </span>
                                      <span className="text-sm font-bold text-gray-900">
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
        <main className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-6">Directie Klassement</h2>
          <p className="text-sm text-gray-600 mb-6">
            Top {metadata.top_n_participants_for_directie} deelnemers per directie per etappe tellen mee
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rank</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">+/-</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Directie</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Totaal Punten</th>
                </tr>
              </thead>
              <tbody>
                {(filteredResults as DirectieEntry[]).map((entry) => {
                  const isExpanded = expandedItem === entry.directie_name;

                  return (
                    <React.Fragment key={entry.directie_name}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => toggleItemDetails(entry.directie_name)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {entry.overall_rank}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {renderRankChange(entry.overall_rank_change)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          {entry.directie_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                          {entry.overall_score}
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={4} className="px-4 py-4">
                            <div className="ml-8 max-w-2xl">
                              <h3 className="text-sm font-semibold text-gray-700 mb-2 pb-2 border-b border-gray-300">
                                Totale Bijdragen per Deelnemer
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {entry.overall_participant_contributions.map((participant, idx) => (
                                  <div 
                                    key={participant.participant_name}
                                    className="flex justify-between items-center py-2 px-3 hover:bg-gray-100 rounded transition-colors"
                                  >
                                    <span className="text-sm text-gray-700 flex items-center gap-2">
                                      <span className="text-xs font-semibold text-gray-500 w-5">
                                        #{idx + 1}
                                      </span>
                                      {participant.participant_name}
                                    </span>
                                    <span className="text-sm font-bold text-gray-900">
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