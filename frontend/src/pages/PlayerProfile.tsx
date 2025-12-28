import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { userService, publicService } from '../services/api';
import { playerStatisticsService } from '../services/playerStatisticsService';
import ProfileStats from '../components/ProfileStats';
import EloChart from '../components/EloChart';
import MatchesTable from '../components/MatchesTable';
import MatchDetailsModal from '../components/MatchDetailsModal';
import PlayerStatsByMap from '../components/PlayerStatsByMap';
import PlayerStatsByFaction from '../components/PlayerStatsByFaction';
import PlayerLink from '../components/PlayerLink';
import '../styles/UserProfile.css';

type ProfileTab = 'overall' | 'matches' | 'opponents' | 'by-map' | 'by-faction';

const PlayerProfile: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [opponentStats, setOpponentStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchDetailsModal, setMatchDetailsModal] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overall');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterOpponent, setFilterOpponent] = useState<string>('');

  useEffect(() => {
    if (!id) {
      navigate('/players');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch player profile
        const profileRes = await publicService.getPlayerProfile(id);
        setProfile(profileRes.data);

        // Fetch recent matches for the user
        const matchesRes = await userService.getRecentMatches(id);
        const matchesData = matchesRes.data?.data || matchesRes.data || [];
        setMatches(matchesData);

        // Fetch opponent stats from backend (pre-calculated)
        const opponentsRes = await playerStatisticsService.getRecentOpponents(id, 100);
        setOpponentStats(opponentsRes);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Error loading profile');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const openMatchDetails = (match: any) => {
    setMatchDetailsModal(match);
  };

  const closeMatchDetails = () => {
    setMatchDetailsModal(null);
  };

  // Filter and sort opponent stats
  const filteredOpponentStats = opponentStats
    .filter(stat => !filterOpponent || stat.opponent_name.toLowerCase().includes(filterOpponent.toLowerCase()))
    .sort((a, b) => {
      if (!sortColumn) return b.total_matches - a.total_matches;
      
      let aVal: any = a[sortColumn as keyof typeof a];
      let bVal: any = b[sortColumn as keyof typeof b];
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  if (loading) {
    return <div className="auth-container"><p>{t('loading')}</p></div>;
  }

  if (error) {
    return (
      <div className="auth-container">
        <p className="error-message">{error}</p>
        <button onClick={() => navigate('/players')}>{t('back_to_players')}</button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="auth-container">
        <p>Profile not found</p>
        <button onClick={() => navigate('/players')}>{t('back_to_players')}</button>
      </div>
    );
  }

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'overall', label: t('overall_statistics') || 'Overall' },
    { id: 'matches', label: t('matches_label') || 'Matches' },
    { id: 'opponents', label: t('my_opponents') || 'Opponents' },
    { id: 'by-map', label: t('performance_by_map') || 'By Map' },
    { id: 'by-faction', label: t('performance_by_faction') || 'By Faction' },
  ];

  return (
    <div className="profile-page-content">
      <h1>{profile?.nickname}'s Profile</h1>
      
      {profile && (
        <>
          <ProfileStats player={profile} />

          {/* Tab Navigation */}
          <div className="player-stats-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSortColumn('');
                  setFilterOpponent('');
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* Overall Tab */}
            {activeTab === 'overall' && (
              <div className="tab-pane active">
                <EloChart 
                  matches={matches}
                  currentPlayerId={id || ''}
                />

                <div className="recent-games-container">
                  <h2>{t('recent_games')}</h2>
                  <MatchesTable 
                    matches={matches.slice(0, 10)}
                    currentPlayerId={id || ''}
                    onViewDetails={openMatchDetails}
                    onDownloadReplay={async (matchId, replayFilePath) => {
                      try {
                        const API_URL = window.location.hostname.includes('main.') 
                          ? 'https://wesnothtournamentmanager-main.up.railway.app/api'
                          : window.location.hostname.includes('wesnoth-tournament-manager.pages.dev')
                          ? 'https://wesnothtournamentmanager-production.up.railway.app/api'
                          : '/api';
                        
                        const response = await fetch(`${API_URL}/matches/${matchId}/replay/download`, {
                          method: 'GET'
                        });
                        
                        if (!response.ok) {
                          throw new Error(`Download failed with status ${response.status}`);
                        }
                        
                        const { signedUrl } = await response.json();
                        window.location.href = signedUrl;
                      } catch (err) {
                        console.error('Error downloading replay:', err);
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Matches Tab */}
            {activeTab === 'matches' && (
              <div className="tab-pane active">
                <div className="matches-container">
                  <h2>{t('all_matches')}</h2>
                  <MatchesTable 
                    matches={matches}
                    currentPlayerId={id || ''}
                    onViewDetails={openMatchDetails}
                    onDownloadReplay={async (matchId, replayFilePath) => {
                      try {
                        const API_URL = window.location.hostname.includes('main.') 
                          ? 'https://wesnothtournamentmanager-main.up.railway.app/api'
                          : window.location.hostname.includes('wesnoth-tournament-manager.pages.dev')
                          ? 'https://wesnothtournamentmanager-production.up.railway.app/api'
                          : '/api';
                        
                        const response = await fetch(`${API_URL}/matches/${matchId}/replay/download`, {
                          method: 'GET'
                        });
                        
                        if (!response.ok) {
                          throw new Error(`Download failed with status ${response.status}`);
                        }
                        
                        const { signedUrl } = await response.json();
                        window.location.href = signedUrl;
                      } catch (err) {
                        console.error('Error downloading replay:', err);
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Opponents Tab */}
            {activeTab === 'opponents' && (
              <div className="tab-pane active">
                <div className="opponent-stats-container">
                  <h2>{t('my_opponents') || 'Opponents'}</h2>
                  
                  <div className="filter-section">
                    <input
                      type="text"
                      placeholder={t('filter_by_opponent') || 'Filter by opponent...'}
                      value={filterOpponent}
                      onChange={(e) => setFilterOpponent(e.target.value)}
                      className="opponent-filter"
                    />
                  </div>

                  {opponentStats.length === 0 ? (
                    <div className="no-data-message">{t('no_opponent_data') || 'No opponent data available'}</div>
                  ) : (
                    <div className="opponent-stats-wrapper">
                      <table className="opponent-stats-table">
                        <thead>
                          <tr>
                            <th 
                              className="sortable"
                              onClick={() => handleSort('opponent_name')}
                            >
                              {t('opponent_name') || 'Opponent'}
                              {sortColumn === 'opponent_name' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                            </th>
                            <th className="numeric sortable" onClick={() => handleSort('current_elo')}>
                              {t('current_elo') || 'Current ELO'}
                              {sortColumn === 'current_elo' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                            </th>
                            <th className="numeric sortable" onClick={() => handleSort('total_matches')}>
                              {t('total_matches_label') || 'Total'}
                              {sortColumn === 'total_matches' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                            </th>
                            <th className="numeric">{t('wins') || 'Wins'}</th>
                            <th className="numeric">{t('losses') || 'Losses'}</th>
                            <th className="numeric sortable" onClick={() => handleSort('win_percentage')}>
                              {t('win_percentage') || 'Win %'}
                              {sortColumn === 'win_percentage' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                            </th>
                            <th className="numeric">{t('elo_gained') || 'ELO Gained'}</th>
                            <th className="numeric">{t('elo_lost') || 'ELO Lost'}</th>
                            <th>{t('last_match') || 'Last Match'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOpponentStats.map((stat) => (
                            <tr key={stat.opponent_id} className="opponent-row">
                              <td className="opponent-name">
                                <span className="name">
                                  <PlayerLink nickname={stat.opponent_name} userId={stat.opponent_id} />
                                </span>
                              </td>
                              <td className="numeric">
                                <span className="elo-badge">{stat.current_elo}</span>
                              </td>
                              <td className="numeric">
                                <strong>{stat.total_matches}</strong>
                              </td>
                              <td className="numeric">
                                <span className="wins-badge">{stat.wins_against_me}</span>
                              </td>
                              <td className="numeric">
                                <span className="losses-badge">{stat.losses_against_me}</span>
                              </td>
                              <td className="numeric">
                                <span className="percentage-badge positive">{Number(stat.win_percentage).toFixed(1)}%</span>
                              </td>
                              <td className="numeric">
                                <span className="elo-positive">+{Number(stat.elo_gained).toFixed(0)}</span>
                              </td>
                              <td className="numeric">
                                <span className="elo-negative">-{Number(stat.elo_lost).toFixed(0)}</span>
                              </td>
                              <td>
                                <span className="date">{stat.last_match_date ? new Date(stat.last_match_date).toLocaleDateString() : 'N/A'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Performance by Map Tab */}
            {activeTab === 'by-map' && (
              <div className="tab-pane active">
                <PlayerStatsByMap playerId={id || ''} />
              </div>
            )}

            {/* Performance by Faction Tab */}
            {activeTab === 'by-faction' && (
              <div className="tab-pane active">
                <PlayerStatsByFaction playerId={id || ''} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Match Details Modal */}
      <MatchDetailsModal 
        match={matchDetailsModal}
        isOpen={!!matchDetailsModal}
        onClose={closeMatchDetails}
      />
    </div>
  );
};

export default PlayerProfile;
