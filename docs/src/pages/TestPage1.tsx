import { useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardRow, CardExpandedSection, DetailRow } from '../components/Card';
import { TabButton, SearchInput } from '../components/Button';

// Example data structure
interface Rider {
  name: string;
  team: string;
  points: number;
  rank: number;
  stages_won: number;
}

const mockRiders: Rider[] = [
  { name: "Tadej Pogacar", team: "UAE Team Emirates", points: 450, rank: 1, stages_won: 5 },
  { name: "Jonas Vingegaard", team: "Visma-Lease a Bike", points: 425, rank: 2, stages_won: 3 },
  { name: "Remco Evenepoel", team: "Soudal Quick-Step", points: 380, rank: 3, stages_won: 2 },
  { name: "Primoz Roglic", team: "BORA-hansgrohe", points: 350, rank: 4, stages_won: 1 },
  { name: "Adam Yates", team: "UAE Team Emirates", points: 320, rank: 5, stages_won: 0 },
];

type ViewType = 'all' | 'winners' | 'teams';

function TestPage1() {
  const [activeView, setActiveView] = useState<ViewType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRider, setExpandedRider] = useState<string | null>(null);

  const filteredRiders = mockRiders.filter(rider => 
    rider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rider.team.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedRiders = activeView === 'winners' 
    ? filteredRiders.filter(r => r.stages_won > 0)
    : filteredRiders;

  return (
    <Layout 
      title="TEST: Renner Statistieken" 
      subtitle="Bekijk de prestaties van alle renners"
    >
      <main>
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-4">
          <TabButton onClick={() => setActiveView('all')} active={activeView === 'all'}>
            Alle Renners
          </TabButton>
          <TabButton onClick={() => setActiveView('winners')} active={activeView === 'winners'}>
            Etappe Winnaars
          </TabButton>
          <TabButton onClick={() => setActiveView('teams')} active={activeView === 'teams'}>
            Per Team
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

        {/* Mobile Card View */}
        <div className="block lg:hidden space-y-2">
          {displayedRiders.map((rider) => (
            <Card key={rider.name}>
              <div onClick={() => setExpandedRider(
                expandedRider === rider.name ? null : rider.name
              )}>
                <CardRow
                  left={
                    <>
                      <div className="text-lg font-bold text-tdf-text-primary">#{rider.rank}</div>
                      {rider.stages_won > 0 && (
                        <div className="text-sm">{'🏆'.repeat(rider.stages_won)}</div>
                      )}
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
                      <div className="text-lg font-bold text-tdf-score">{rider.points}</div>
                      <div className="text-xs text-tdf-text-secondary">punten</div>
                    </>
                  }
                />
              </div>

              <CardExpandedSection 
                title="Gedetailleerde Statistieken"
                isExpanded={expandedRider === rider.name}
              >
                <DetailRow label="Totaal Punten" value={rider.points} />
                <DetailRow label="Huidige Positie" value={`#${rider.rank}`} />
                <DetailRow label="Etappes Gewonnen" value={rider.stages_won} />
                <DetailRow label="Team" value={rider.team} />
              </CardExpandedSection>
            </Card>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-tdf-row-odd">
                <th className="px-4 py-4 text-left text-sm font-semibold text-tdf-text-secondary">Rank</th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-tdf-text-secondary">Renner</th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-tdf-text-secondary">Team</th>
                <th className="px-4 py-4 text-right text-sm font-semibold text-tdf-text-secondary">Punten</th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-tdf-text-secondary">Etappes</th>
              </tr>
            </thead>
            <tbody>
              {displayedRiders.map((rider, idx) => (
                <tr
                  key={rider.name}
                  className={`cursor-pointer hover:bg-tdf-card-hover ${
                    idx % 2 === 0 ? 'bg-tdf-row-even' : 'bg-tdf-row-odd'
                  }`}
                  onClick={() => setExpandedRider(
                    expandedRider === rider.name ? null : rider.name
                  )}
                >
                  <td className="px-4 py-3 text-sm font-medium text-tdf-text-primary">
                    {rider.rank}
                  </td>
                  <td className="px-4 py-3 text-sm text-tdf-text-primary">{rider.name}</td>
                  <td className="px-4 py-3 text-sm text-tdf-text-secondary">{rider.team}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-tdf-text-primary">
                    {rider.points}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    {rider.stages_won > 0 ? '🏆'.repeat(rider.stages_won) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {displayedRiders.length === 0 && (
          <div className="text-center py-12 text-tdf-text-secondary">
            Geen renners gevonden
          </div>
        )}
      </main>
    </Layout>
  );
}

export default TestPage1;