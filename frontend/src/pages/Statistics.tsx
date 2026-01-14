import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FactionBalanceTab from '../components/FactionBalanceTab';
import MapBalanceTab from '../components/MapBalanceTab';
import MatchupBalanceTab from '../components/MatchupBalanceTab';
import BalanceEventImpactPanel from '../components/BalanceEventImpactPanel';
import '../styles/Statistics.css';
import '../styles/BalanceEventImpactPanel.css';

type StatisticsTab = 'faction' | 'map' | 'matchups';

interface ComparisonData {
  map_id?: string;
  map_name?: string;
  faction_id?: string;
  faction_name?: string;
  opponent_faction_id?: string;
  opponent_faction_name?: string;
  winrate: number;
  total_games: number;
  wins: number;
  losses: number;
}

const Statistics: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<StatisticsTab>('faction');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [beforeData, setBeforeData] = useState<ComparisonData[]>([]);
  const [afterData, setAfterData] = useState<ComparisonData[]>([]);

  const handleComparisonDataChange = (before: ComparisonData[], after: ComparisonData[]) => {
    setBeforeData(before);
    setAfterData(after);
  };

  return (
    <div className="statistics-container">
      <h1>{t('statistics') || 'Balance Statistics'}</h1>
      <p className="statistics-intro">
        {t('statistics_intro') || 'Detailed analysis of faction and map balance across all matches'}
      </p>

      <BalanceEventImpactPanel 
        eventId={selectedEventId ?? undefined} 
        onEventChange={setSelectedEventId}
        onComparisonDataChange={handleComparisonDataChange}
      />

      <div className="statistics-tabs">
        <button 
          className={`tab-button ${activeTab === 'faction' ? 'active' : ''}`}
          onClick={() => setActiveTab('faction')}
        >
          {t('faction_balance') || 'Faction Balance'}
        </button>
        <button 
          className={`tab-button ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          {t('map_balance') || 'Map Balance'}
        </button>
        <button 
          className={`tab-button ${activeTab === 'matchups' ? 'active' : ''}`}
          onClick={() => setActiveTab('matchups')}
        >
          {t('matchup_balance') || 'Matchup Analysis'}
        </button>
      </div>

      <div className="statistics-content">
        {activeTab === 'faction' && <FactionBalanceTab beforeData={selectedEventId ? beforeData : null} afterData={selectedEventId ? afterData : null} />}
        {activeTab === 'map' && <MapBalanceTab beforeData={selectedEventId ? beforeData : null} afterData={selectedEventId ? afterData : null} />}
        {activeTab === 'matchups' && <MatchupBalanceTab beforeData={selectedEventId ? beforeData : null} afterData={selectedEventId ? afterData : null} />}
      </div>
    </div>
  );
};

export default Statistics;
