import React, { useState, useMemo } from 'react'
import tdfData from '../data/tdf_data.json'

// Interfaces
// Interfaces
interface Participant {
  participant_name: string;
  total_score: number;
  rank: number;
  rank_change: number | null;
  directie: string;
}

interface DirectieEntry {
  directie: string;
  total_score: number;
  rank: number;
  rank_change: number | null;
  contributing_participants: Array<{
    participant_name: string;
    total_contribution: number;
  }>;
}

interface ParticipantStageData {
  date: string;
  stage_score: number;
  cumulative_score: number;
  rider_contributions: Record<string, number>;
}

interface ParticipantData {
  directie: string;
  stages: Record<string, ParticipantStageData>;
  rider_totals: Record<string, number>;
}

type ViewType = 'klassement' | 'stage' | 'directie';

interface StageResult {
  name: string;
  score: number;
  date: string;
  directie?: string; // added directie
}

function HomePage() {
  const [activeView, setActiveView] = useState<ViewType>('klassement');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Destructure data from imported JSON
  const { metadata, leaderboard, participants, directie_leaderboard } = tdfData;
  const currentStageNum = metadata.current_stage;
  const currentStageKey = `stage_${currentStageNum}`;

  // Memoize stage results for current stage
  const stageResults = useMemo(() => {
    return Object.entries(participants as Record<string, ParticipantData>)
      .map(([name, data]) => ({
        name,
        score: data.stages[currentStageKey]?.stage_score || 0,
        date: data.stages[currentStageKey]?.date || '',
        directie: data.directie || '' // include directie
      }))
      .sort((a, b) => b.score - a.score);
  }, [participants, currentStageKey]);

  // Memoize filtered results based on active view and search term
  const filteredResults = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    
    if (!searchLower) {
      // No search: return data depending on view
      if (activeView === 'klassement') return leaderboard;
      if (activeView === 'stage') return stageResults;
      return directie_leaderboard;
    }

    // When searching, always allow filtering by participant name OR directie
    if (activeView === 'klassement') {
      return leaderboard.filter((p: Participant) => 
        p.participant_name.toLowerCase().includes(searchLower) ||
        (p.directie || '').toLowerCase().includes(searchLower)
      );
    } else if (activeView === 'stage') {
      return stageResults.filter((r: StageResult) => 
        r.name.toLowerCase().includes(searchLower) ||
        (r.directie || '').toLowerCase().includes(searchLower)
      );
    } else { // directie view: match directie name OR any contributing participant's name
      return directie_leaderboard.filter((d: DirectieEntry) => 
        d.directie.toLowerCase().includes(searchLower) ||
        d.contributing_participants.some(cp => cp.participant_name.toLowerCase().includes(searchLower))
      );
    }
  }, [activeView, searchTerm, leaderboard, stageResults, directie_leaderboard]);

  const renderRankChange = (rankChange: number | null) => {
    if (rankChange === null) return <span className="text-gray-400">—</span>;
    if (rankChange > 0) {
      return <span className="text-green-600 font-semibold">↑ {rankChange}</span>;
    }
    if (rankChange < 0) {
      return <span className="text-red-600 font-semibold">↓ {Math.abs(rankChange)}</span>;
    }
    return <span className="text-gray-400">—</span>;
  };

  const renderMedal = (index: number) => {
    if (index === 0) return ' 🥇';
    if (index === 1) return ' 🥈';
    if (index === 2) return ' 🥉';
    return '';
  };

  const toggleItemDetails = (itemName: string) => {
    setExpandedItem(prev => 
      prev === itemName ? null : itemName
    );
  };

  const getParticipantStages = (participantName: string) => {
    const participantData = (participants as Record<string, ParticipantData>)[participantName];
    if (!participantData?.stages) return [];

    return Object.entries(participantData.stages)
      .map(([stageKey, data]) => ({
        stageNum: parseInt(stageKey.replace('stage_', '')),
        stageKey,
        stage_score: data.stage_score,
        date: data.date
      }))
      .sort((a, b) => a.stageNum - b.stageNum);
  };

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
            onClick={() => setActiveView('klassement')}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-colors ${
              activeView === 'klassement'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Algemeen Klassement
          </button>
          <button
            onClick={() => setActiveView('stage')}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-colors ${
              activeView === 'stage'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Etappe {currentStageNum}
          </button>
          <button
            onClick={() => setActiveView('directie')}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-colors ${
              activeView === 'directie'
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
      {activeView === 'stage' && (
        <main className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-6">
            Etappe {currentStageNum} Resultaten
            {stageResults[0]?.date && (
              <span className="text-sm text-gray-500 ml-2">
                ({new Date(stageResults[0].date).toLocaleDateString('nl-NL')})
              </span>
            )}
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Positie</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Deelnemer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Directie</th> {/* new column */}
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Punten</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((result, index) => {
                  const typedResult = result as StageResult;
                  const isExpanded = expandedItem === typedResult.name;
                  const participantData = (participants as Record<string, ParticipantData>)[typedResult.name];
                  const stageData = participantData?.stages[currentStageKey];
                  const riderContributions = stageData?.rider_contributions || {};
                  const sortedRiders = Object.entries(riderContributions)
                    .sort(([, a], [, b]) => b - a);

                  return (
                    <React.Fragment key={typedResult.name}>
                      <tr 
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                          index < 3 ? 'bg-yellow-50' : ''
                        }`}
                        onClick={() => toggleItemDetails(typedResult.name)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {index + 1}{renderMedal(index)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {typedResult.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {typedResult.directie || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                          {typedResult.score}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={4} className="px-4 py-4"> {/* updated colSpan */}
                            <div className="ml-8 max-w-md">
                              <h3 className="text-sm font-semibold text-gray-700 mb-2 pb-2 border-b border-gray-300">Renner Bijdragen</h3>
                              <div>
                                {sortedRiders.map(([rider, points]) => (
                                  <div 
                                    key={rider}
                                    className="flex justify-between items-center py-1 px-2 hover:bg-gray-100 rounded transition-colors"
                                  >
                                    <span className="text-sm text-gray-700">
                                      {rider}
                                    </span>
                                    <span className="text-sm font-bold text-gray-900">
                                      {points}
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

      {/* Overall Leaderboard View */}
      {activeView === 'klassement' && (
        <main className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-6">Algemeen Klassement</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rank</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">+/-</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Deelnemer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Directie</th> {/* new column */}
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Totaal Punten</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((participant) => {
                  const typedParticipant = participant as Participant;
                  const isExpanded = expandedItem === typedParticipant.participant_name;
                  const stages = isExpanded ? getParticipantStages(typedParticipant.participant_name) : [];

                  return (
                    <React.Fragment key={typedParticipant.participant_name}>
                      <tr 
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => toggleItemDetails(typedParticipant.participant_name)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {typedParticipant.rank}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {renderRankChange(typedParticipant.rank_change)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {typedParticipant.participant_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {typedParticipant.directie || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                          {typedParticipant.total_score}
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="px-4 py-4"> {/* updated colSpan */}
                            <div className="ml-8 max-w-md">
                              <h3 className="text-sm font-semibold text-gray-700 mb-2 pb-2 border-b border-gray-300">Punten per Etappe</h3>
                              <div>
                                {stages.map(stage => (
                                  <div 
                                    key={stage.stageKey}
                                    className="flex justify-between items-center py-1 px-2 hover:bg-gray-100 rounded transition-colors"
                                  >
                                    <span className="text-sm text-gray-700">
                                      Etappe {stage.stageNum}:
                                    </span>
                                    <span className="text-sm font-bold text-gray-900">
                                      {stage.stage_score}
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

      {/* Directie Leaderboard View */}
      {activeView === 'directie' && (
        <main className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">Directie Klassement</h2>
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
                {filteredResults.map((directieEntry) => {
                  const typedDirectie = directieEntry as DirectieEntry;
                  const isExpanded = expandedItem === typedDirectie.directie;

                  return (
                    <React.Fragment key={typedDirectie.directie}>
                      <tr 
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                          typedDirectie.rank <= 3 ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => toggleItemDetails(typedDirectie.directie)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {typedDirectie.rank}{renderMedal(typedDirectie.rank - 1)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {renderRankChange(typedDirectie.rank_change)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          {typedDirectie.directie}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                          {typedDirectie.total_score}
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={4} className="px-4 py-4">
                            <div className="ml-8 max-w-2xl">
                              <h3 className="text-sm font-semibold text-gray-700 mb-2 pb-2 border-b border-gray-300">
                                Bijdragen per Deelnemer
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {typedDirectie.contributing_participants.map((participant, idx) => (
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
                                      {participant.total_contribution}
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