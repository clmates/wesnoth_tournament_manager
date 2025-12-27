import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabaseService';
import PlayerStatsOverview from '../components/PlayerStatsOverview';
import PlayerStatsByMap from '../components/PlayerStatsByMap';
import PlayerStatsByFaction from '../components/PlayerStatsByFaction';
import PlayerHeadToHead from '../components/PlayerHeadToHead';
import PlayerRecentOpponents from '../components/PlayerRecentOpponents';
import '../styles/PlayerStats.css';

type StatsTab = 'overview' | 'by-map' | 'by-faction' | 'recent-opponents';

interface Player {
  id: string;
  username: string;
  email: string;
  elo_rating: number;
}

const PlayerStatsPage: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const { t } = useTranslation();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<StatsTab>('overview');
  const [headToHeadOpponent, setHeadToHeadOpponent] = useState<string>('');

  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        setLoading(true);
        if (!playerId) {
          setError('No player ID provided');
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('players')
          .select('id, username, email, elo_rating')
          .eq('id', playerId)
          .single();

        if (fetchError) throw fetchError;
        if (!data) {
          setError('Player not found');
          return;
        }

        setPlayer(data);
      } catch (err) {
        console.error('Error fetching player:', err);
        setError('Error loading player information');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayer();
  }, [playerId]);

  if (loading) {
    return (
      <div className="player-stats-container">
        <div className="stats-container">
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !player || !playerId) {
    return (
      <div className="player-stats-container">
        <div className="stats-container error">
          <p>{error || 'Error loading player'}</p>
        </div>
      </div>
    );
  }

  const tabs: { id: StatsTab; label: string }[] = [
    { id: 'overview', label: t('overall_statistics') || 'Overall Statistics' },
    { id: 'by-map', label: t('performance_by_map') || 'By Map' },
    { id: 'by-faction', label: t('performance_by_faction') || 'By Faction' },
    { id: 'recent-opponents', label: t('recent_opponents') || 'Recent Opponents' },
  ];

  return (
    <div className="player-stats-container">
      {/* Player Header */}
      <div className="player-header">
        <div className="player-header-info">
          <h1>{player.username}</h1>
          <p>{t('current_elo') || 'Current ELO'}: <strong>{player.elo_rating}</strong></p>
          <p>{t('player_id') || 'Player ID'}: {playerId}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="player-stats-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`player-stats-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setHeadToHeadOpponent(''); // Reset H2H opponent when switching tabs
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div>
            <PlayerStatsOverview playerId={playerId} />
          </div>
        )}

        {activeTab === 'by-map' && (
          <div>
            <PlayerStatsByMap playerId={playerId} />
          </div>
        )}

        {activeTab === 'by-faction' && (
          <div>
            <PlayerStatsByFaction playerId={playerId} />
          </div>
        )}

        {activeTab === 'recent-opponents' && (
          <div>
            <PlayerRecentOpponents playerId={playerId} limit={20} />
            
            {/* Head to Head Section */}
            {headToHeadOpponent && (
              <div style={{ marginTop: '40px' }}>
                <PlayerHeadToHead 
                  playerId={playerId} 
                  opponentId={headToHeadOpponent}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerStatsPage;
