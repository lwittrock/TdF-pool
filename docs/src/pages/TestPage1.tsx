import { useState, useMemo } from 'react';
import Layout from '../components/Layout';
import { Card, CardRow, CardExpandedSection, DetailRow } from '../components/Card';
import { TabButton, SearchInput } from '../components/Button';

// Import your data
import tdfData from '../data/tdf_data.json';

interface RiderStageData {
  date: string;
  stage_finish_points: number;
  jersey_points?: {
    yellow?: number;
    green?: number;
    polka?: number;
  };
  stage_total: number;
  cumulative_total: number;
}

interface RiderData {
  name: string;
  team: string;
  total_points: number;
  stages: Record<string, RiderStageData>;
}

interface StageRankedRider extends RiderData {
  stage_points: number;
  stage_data: RiderStageData | undefined;
  stage_rank: number;
}

interface TotalRankedRider extends RiderData {
  overall_rank: number;
}

interface StageInfo {
  stageNum: number;
  stageKey: string;
  date: string;
  stage_finish_points: number;
  jersey_points?: {
    yellow?: number;
    green?: number;
    polka?: number;
  };
  stage_total: number;
  cumulative_total: number;
}

type ViewType = 'stage' | 'total' | 'team';

function RidersPage() {
  const [activeView, setActiveView] = useState<ViewType>('total');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRider, setExpandedRider] = useState<string | null>(null);

  const data = tdfData;
  const currentStageNum = data.metadata.current_stage;
  const currentStageKey = `stage_${currentStageNum}`;

  // Transform riders data into array format
  const ridersArray: RiderData[] = useMemo(() => {
    const ridersRecord = data.riders as Record<string, {
      team?: string;
      total_points: number;
      stages: Record<string, RiderStageData>;
    }>;

    return Object.entries(ridersRecord).map(([name, riderData]) => ({
      name,
      team: riderData.team || 'Onbekend Team',
      total_points: riderData.total_points,
      stages: riderData.stages
    })).filter(rider => rider.total_points > 0);
  }, [data.riders]);

  // Calculate stage rankings
  const stageRankings = useMemo(() => {
    const ridersWithStagePoints = ridersArray
      .map(rider => {
        const stageData = rider.stages[currentStageKey];
        return {
          ...rider,
          stage_points: stageData?.stage_total || 0,
          stage_data: stageData
        };
      })
      .filter(rider => rider.stage_points > 0)
      .sort((a, b) => b.stage_points - a.stage_points);

    return ridersWithStagePoints.map((rider, index) => ({
      ...rider,
      stage_rank: index + 1
    }));
  }, [ridersArray, currentStageKey]);

  // Calculate total rankings
  const totalRankings = useMemo(() => {
    const sorted = [...ridersArray].sort((a, b) => b.total_points - a.total_points);
    return sorted.map((rider, index) => ({
      ...rider,
      overall_rank: index + 1
    }));
  }, [ridersArray]);

  // Get medals for a rider across all stages
  const getRiderMedals = (riderName: string) => {
    let goldCount = 0, silverCount = 0, bronzeCount = 0;
    
    const ridersRecord = data.riders as Record<string, {
      stages: Record<string, RiderStageData>;
    }>;
    
    // Get all stage keys
    const allStageKeys = Object.keys(ridersRecord[riderName]?.stages || {});
    
    allStageKeys.forEach(stageKey => {
      // Calculate rankings for this stage
      const stageRanking = ridersArray
        .map(rider => ({
          name: rider.name,
          stage_points: rider.stages[stageKey]?.stage_total || 0
        }))
        .filter(r => r.stage_points > 0)
        .sort((a, b) => b.stage_points - a.stage_points);

      const riderRank = stageRanking.findIndex(r => r.name === riderName) + 1;
      
      if (riderRank === 1) goldCount++;
      else if (riderRank === 2) silverCount++;
      else if (riderRank === 3) bronzeCount++;
    });

    const medals = [];
    if (goldCount > 0) medals.push('🥇'.repeat(goldCount));
    if (silverCount > 0) medals.push('🥈'.repeat(silverCount));
    if (bronzeCount > 0) medals.push('🥉'.repeat(bronzeCount));
    return medals.join('');
  };

  const renderMedal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  // Filter based on search
  const filteredResults = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    const dataToFilter = activeView === 'stage' ? stageRankings : totalRankings;
    
    if (!searchLower) return dataToFilter;
    
    return dataToFilter.filter(rider => 
      rider.name.toLowerCase().includes(searchLower) ||
      rider.team.toLowerCase().includes(searchLower)
    );
  }, [activeView, searchTerm, stageRankings, totalRankings]);

  // Get all stages for a rider in chronological order
  const getRiderStages = (riderName: string): StageInfo[] => {
    const ridersRecord = data.riders as Record<string, {
      stages: Record<string, RiderStageData>;
    }>;
    
    const rider = ridersRecord[riderName];
    if (!rider) return [];

    return Object.entries(rider.stages)
      .map(([stageKey, stageData]) => ({
        stageNum: parseInt(stageKey.replace('stage_', '')),
        stageKey,
        ...stageData
      }))
      .sort((a, b) => a.stageNum - b.stageNum);
  };

  return (
    <Layout 
      title="Renner Klassement" 
    >
      <main>
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-4">
          <TabButton onClick={() => setActiveView('stage')} active={activeView === 'stage'}>
            Etappe
          </TabButton>
          <TabButton onClick={() => setActiveView('total')} active={activeView === 'total'}>
            Renner
          </TabButton>
          <TabButton onClick={() => setActiveView('team')} active={activeView === 'team'}>
            Team
          </TabButton>
        </div>

        {/* Search */}
        <div className="mb-6">
          <SearchInput 
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Zoek renner of team..."
          />
        </div>

        {/* STAGE VIEW */}
        {activeView === 'stage' && (
          <>
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-tdf-primary">
            Etappe {currentStageNum} Resultaten
          </h2>

            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-2">
              {(filteredResults as StageRankedRider[]).map((rider) => {
                const medal = renderMedal(rider.stage_rank);
                const stageData = rider.stage_data;

                return (
                  <Card key={rider.name}>
                    <div onClick={() => setExpandedRider(
                      expandedRider === rider.name ? null : rider.name
                    )}>
                      <CardRow
                        left={
                          <>
                            <div className="text-lg font-bold text-tdf-text-primary">#{rider.stage_rank}</div>
                            {medal && <div className="text-xl leading-none">{medal}</div>}
                          </>
                        }
                        middle={
                          <>
                            <div className="font-bold text-sm text-tdf-text-primary truncate">
                              {rider.name}
                            </div>
                            <div className="text-xs text-tdf-text-secondary truncate">
                              {rider.team}
                            </div>
                          </>
                        }
                        right={
                          <>
                            <div className="text-lg font-bold text-tdf-score">{rider.stage_points}</div>
                            <div className="text-xs text-tdf-text-secondary">punten</div>
                          </>
                        }
                      />
                    </div>

                    <CardExpandedSection 
                      title="Etappe Details"
                      isExpanded={expandedRider === rider.name}
                    >
                      <DetailRow label="Finish Punten" value={stageData?.stage_finish_points || 0} />
                      {stageData?.jersey_points?.yellow && (
                        <DetailRow label="Gele Trui Bonus" value={stageData.jersey_points.yellow} />
                      )}
                      {stageData?.jersey_points?.green && (
                        <DetailRow label="Groene Trui Bonus" value={stageData.jersey_points.green} />
                      )}
                      {stageData?.jersey_points?.polka && (
                        <DetailRow label="Bolletjestrui Bonus" value={stageData.jersey_points.polka} />
                      )}
                      <div className="flex justify-between py-2 px-3 bg-tdf-accent bg-opacity-10 rounded">
                        <span className="text-sm font-semibold text-tdf-text-primary">Etappe Totaal</span>
                        <span className="text-sm font-bold text-tdf-score">{rider.stage_points}</span>
                      </div>
                    </CardExpandedSection>
                  </Card>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Rank</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Renner</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Team</th>
                    <th className="px-4 py-4 text-right text-sm font-semibold text-gray-600">Punten</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredResults as StageRankedRider[]).map((rider, idx) => {
                    const stageData = rider.stage_data;
                    return (
                      <>
                        <tr
                          key={rider.name}
                          className={`cursor-pointer hover:bg-gray-100 ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-tdf-bg'
                          }`}
                          onClick={() => setExpandedRider(
                            expandedRider === rider.name ? null : rider.name
                          )}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-tdf-text-primary">
                            {rider.stage_rank}{renderMedal(rider.stage_rank)}
                          </td>
                          <td className="px-4 py-3 text-sm text-tdf-text-primary">{rider.name}</td>
                          <td className="px-4 py-3 text-sm text-tdf-text-secondary">{rider.team}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-tdf-text-primary">
                            {rider.stage_points}
                          </td>
                        </tr>
                        {expandedRider === rider.name && (
                          <tr className="bg-gray-100">
                            <td colSpan={4} className="px-4 py-4">
                              <div className="ml-8 max-w-md">
                                <h3 className="text-sm font-semibold mb-2 pb-2 text-gray-600 border-b">Etappe Details</h3>
                                <div className="space-y-1">
                                  <div className="flex justify-between py-1 px-2 rounded hover:bg-gray-200">
                                    <span className="text-sm text-gray-600">Finish Punten:</span>
                                    <span className="text-sm font-bold">{stageData?.stage_finish_points || 0}</span>
                                  </div>
                                  {stageData?.jersey_points?.yellow && (
                                    <div className="flex justify-between py-1 px-2 rounded hover:bg-gray-200">
                                      <span className="text-sm text-gray-600">Gele Trui Bonus:</span>
                                      <span className="text-sm font-bold">{stageData.jersey_points.yellow}</span>
                                    </div>
                                  )}
                                  {stageData?.jersey_points?.green && (
                                    <div className="flex justify-between py-1 px-2 rounded hover:bg-gray-200">
                                      <span className="text-sm text-gray-600">Groene Trui Bonus:</span>
                                      <span className="text-sm font-bold">{stageData.jersey_points.green}</span>
                                    </div>
                                  )}
                                  {stageData?.jersey_points?.polka && (
                                    <div className="flex justify-between py-1 px-2 rounded hover:bg-gray-200">
                                      <span className="text-sm text-gray-600">Bolletjestrui Bonus:</span>
                                      <span className="text-sm font-bold">{stageData.jersey_points.polka}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between py-1 px-2 rounded bg-tdf-accent bg-opacity-10 font-semibold">
                                    <span className="text-sm text-tdf-text-primary">Etappe Totaal:</span>
                                    <span className="text-sm font-bold text-tdf-score">{rider.stage_points}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* TOTAL VIEW */}
        {activeView === 'total' && (
          <>
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-tdf-primary">
            Algemeen Klassement
          </h2>
            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-2">
              {(filteredResults as TotalRankedRider[]).map((rider) => {
                const medals = getRiderMedals(rider.name);

                return (
                  <Card key={rider.name}>
                    <div onClick={() => setExpandedRider(
                      expandedRider === rider.name ? null : rider.name
                    )}>
                      <CardRow
                        left={
                          <>
                            <div className="text-lg font-bold text-tdf-text-primary">#{rider.overall_rank}</div>
                          </>
                        }
                        middle={
                          <>
                            <div className="font-bold text-sm text-tdf-text-primary truncate">
                              {rider.name}
                            </div>
                            <div className="text-xs text-tdf-text-secondary truncate">
                              {rider.team}
                            </div>
                          </>
                        }
                        right={
                          <>
                            <div className="text-lg font-bold text-tdf-score">{rider.total_points}</div>
                            {medals && <div className="text-sm leading-none mt-0.5">{medals}</div>}
                          </>
                        }
                      />
                    </div>

                    <CardExpandedSection 
                      title="Punten per Etappe"
                      isExpanded={expandedRider === rider.name}
                    >
                      {getRiderStages(rider.name).map((stage) => (
                        <div key={stage.stageKey} className="flex justify-between py-2 px-3 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-tdf-text-secondary">Etappe {stage.stageNum}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-tdf-text-primary">{stage.stage_total}</span>
                            <span className="text-xs text-tdf-text-secondary">(Tot: {stage.cumulative_total})</span>
                          </div>
                        </div>
                      ))}
                    </CardExpandedSection>
                  </Card>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Rank</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Renner</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Team</th>
                    <th className="px-4 py-4 text-right text-sm font-semibold text-gray-600">Totaal Punten</th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-gray-600">Etappe Medailles</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredResults as TotalRankedRider[]).map((rider, idx) => {
                    const medals = getRiderMedals(rider.name);
                    
                    return (
                      <>
                        <tr
                          key={rider.name}
                          className={`cursor-pointer hover:bg-gray-100 ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-tdf-bg'
                          }`}
                          onClick={() => setExpandedRider(
                            expandedRider === rider.name ? null : rider.name
                          )}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-tdf-text-primary">
                            {rider.overall_rank}
                          </td>
                          <td className="px-4 py-3 text-sm text-tdf-text-primary">{rider.name}</td>
                          <td className="px-4 py-3 text-sm text-tdf-text-secondary">{rider.team}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-tdf-text-primary">
                            {rider.total_points}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">{medals || '—'}</td>
                        </tr>
                        {expandedRider === rider.name && (
                          <tr className="bg-gray-100">
                            <td colSpan={5} className="px-4 py-4">
                              <div className="ml-8 max-w-md">
                                <h3 className="text-sm font-semibold mb-2 pb-2 text-gray-600 border-b">Punten per Etappe</h3>
                                <div className="space-y-1">
                                  {getRiderStages(rider.name).map((stage) => (
                                    <div key={stage.stageKey} className="flex justify-between py-1 px-2 rounded hover:bg-gray-200">
                                      <span className="text-sm text-gray-600">Etappe {stage.stageNum}:</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold">{stage.stage_total}</span>
                                        <span className="text-xs text-tdf-text-secondary">(Totaal: {stage.cumulative_total})</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* TEAM VIEW - Placeholder for now */}
        {activeView === 'team' && (
          <div className="text-center py-12 text-tdf-text-secondary">
            Team klassement - Coming soon
          </div>
        )}

        {filteredResults.length === 0 && (
          <div className="text-center py-12 text-tdf-text-secondary">
            Geen renners gevonden
          </div>
        )}
      </main>
    </Layout>
  );
}

export default RidersPage;