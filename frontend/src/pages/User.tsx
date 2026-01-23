import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/api';
import { playerStatisticsService } from '../services/playerStatisticsService';
import { useAuthStore } from '../store/authStore';
import MainLayout from '../components/MainLayout';
import ProfileStats from '../components/ProfileStats';
import EloChart from '../components/EloChart';
import MatchesTable from '../components/MatchesTable';
import MatchDetailsModal from '../components/MatchDetailsModal';
import MatchConfirmationModal from '../components/MatchConfirmationModal';
import PlayerStatsByMap from '../components/PlayerStatsByMap';
import PlayerStatsByFaction from '../components/PlayerStatsByFaction';
import PlayerLink from '../components/PlayerLink';
import '../styles/UserProfile.css';
import '../styles/OpponentStats.css';

type ProfileTab = 'overall' | 'matches' | 'opponents' | 'by-map' | 'by-faction';

interface FilterState {
  winner: string;
  loser: string;
  map: string;
  status: string;
}

const User: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, userId } = useAuthStore();
  
  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [opponentStats, setOpponentStats] = useState<any[]>([]);
  const [opponentStatsLoading, setOpponentStatsLoading] = useState(false);
  const [opponentStatsError, setOpponentStatsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchDetailsModal, setMatchDetailsModal] = useState<any>(null);
  const [confirmationModal, setConfirmationModal] = useState<any>({
    isOpen: false,
    match: null,
  });
  const [activeTab, setActiveTab] = useState<ProfileTab>('overall');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterOpponent, setFilterOpponent] = useState<string>('');
  const [filters, setFilters] = useState<FilterState>({
    winner: '',
    loser: '',
    map: '',
    status: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch profile data
        const profileRes = await userService.getProfile();
        setProfile(profileRes.data);

        // Fetch recent matches for the current user
        if (userId) {
          console.log('Fetching matches for user ID:', userId);
          const matchesRes = await userService.getRecentMatches(userId);
          console.log('Matches response:', matchesRes.data);
          const matchesData = matchesRes.data?.data || matchesRes.data || [];
          setMatches(matchesData);
        } else {
          console.warn('User ID not available:', userId);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Error loading profile');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, navigate, userId]);

  // Fetch opponent stats when opponents tab is selected
  useEffect(() => {
    if (activeTab === 'opponents' && opponentStats.length === 0 && !opponentStatsLoading && userId) {
      const fetchOpponents = async () => {
        try {
          setOpponentStatsLoading(true);
          setOpponentStatsError('');
          console.log('Fetching recent opponents for user:', userId);
          const opponentsRes = await playerStatisticsService.getRecentOpponents(userId, 100);
          console.log('Opponents data received:', opponentsRes);
          
          // Normalize API response to match expected format
          const normalized = opponentsRes?.map((opponent: any) => ({
            opponent_id: opponent.opponent_id,
            opponent_name: opponent.opponent_name,
            total_matches: opponent.total_games,
            total_games: opponent.total_games,
            wins: opponent.wins,
            losses: opponent.losses,
            winrate: typeof opponent.winrate === 'string' ? parseFloat(opponent.winrate) : opponent.winrate,
            current_elo: opponent.current_elo,
            elo_gained: typeof opponent.elo_gained === 'string' ? parseFloat(opponent.elo_gained) : opponent.elo_gained,
            elo_lost: typeof opponent.elo_lost === 'string' ? parseFloat(opponent.elo_lost) : opponent.elo_lost,
            last_elo_against_me: typeof opponent.last_elo_against_me === 'string' ? parseFloat(opponent.last_elo_against_me) : opponent.last_elo_against_me,
            last_match_date: opponent.last_match_date
          })) || [];
          
          console.log('Normalized opponents data:', normalized);
          setOpponentStats(normalized);
        } catch (err) {
          console.error('Error fetching opponents:', err);
          setOpponentStatsError('Error loading opponent data');
        } finally {
          setOpponentStatsLoading(false);
        }
      };

      fetchOpponents();
    }
  }, [activeTab, userId]);

  const refetchMatches = async () => {
    try {
      if (userId) {
        const matchesRes = await userService.getRecentMatches(userId);
        const matchesData = matchesRes.data?.data || matchesRes.data || [];
        setMatches(matchesData);
      }
    } catch (err) {
      console.error('Error refetching matches:', err);
    }
  };

  const openMatchDetails = (match: any) => {
    setMatchDetailsModal(match);
  };

  const closeMatchDetails = () => {
    setMatchDetailsModal(null);
  };

  const openConfirmation = (match: any) => {
    setConfirmationModal({
      isOpen: true,
      match: match,
    });
  };

  const closeConfirmation = () => {
    setConfirmationModal({
      isOpen: false,
      match: null,
    });
  };

  const handleConfirmationSuccess = () => {
    closeConfirmation();
    refetchMatches();
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetFilters = () => {
    setFilters({
      winner: '',
      loser: '',
      map: '',
      status: '',
    });
  };

  // Filter matches based on active filters
  const filteredMatches = matches.filter(match => {
    if (filters.winner && !match.winner_nickname?.toLowerCase().includes(filters.winner.toLowerCase())) {
      return false;
    }
    if (filters.loser && !match.loser_nickname?.toLowerCase().includes(filters.loser.toLowerCase())) {
      return false;
    }
    if (filters.map && !match.map?.toLowerCase().includes(filters.map.toLowerCase())) {
      return false;
    }
    if (filters.status && match.status !== filters.status) {
      return false;
    }
    return true;
  });

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
    return <MainLayout><div className="auth-container"><p>{t('loading')}</p></div></MainLayout>;
  }

  if (error) {
    return (
      <MainLayout>
        <div className="auth-container">
          <p className="error-message">{error}</p>
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="auth-container">
          <p>Profile not found</p>
        </div>
      </MainLayout>
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
    <MainLayout>
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
                    currentPlayerId={userId || ''}
                  />

                  <div className="recent-games-container">
                    <h2>{t('recent_games')}</h2>
                    <MatchesTable 
                      matches={matches.slice(0, 10)}
                      currentPlayerId={userId || ''}
                      onViewDetails={openMatchDetails}
                      onOpenConfirmation={openConfirmation}
                      onDownloadReplay={async (matchId, replayFilePath) => {
                        try {
                          let API_URL: string;
                          if (window.location.hostname === 'main.wesnoth-tournament-manager.pages.dev') {
                            API_URL = 'https://wesnothtournamentmanager-main.up.railway.app/api';
                          } else if (window.location.hostname === 'wesnoth-tournament-manager.pages.dev') {
                            API_URL = 'https://wesnothtournamentmanager-production.up.railway.app/api';
                          } else if (window.location.hostname.includes('feature-unranked-tournaments')) {
                            API_URL = 'https://wesnothtournamentmanager-wesnothtournamentmanager-pr-1.up.railway.app/api';
                          } else {
                            API_URL = '/api';
                          }
                          
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
                    
                    {/* Filters */}
                    <div className="filters-section">
                      <div className="filter-group">
                        <label htmlFor="winner">{t('filter_winner')}</label>
                        <input
                          type="text"
                          id="winner"
                          name="winner"
                          placeholder={t('filter_by_winner')}
                          value={filters.winner}
                          onChange={handleFilterChange}
                        />
                      </div>

                      <div className="filter-group">
                        <label htmlFor="loser">{t('filter_loser')}</label>
                        <input
                          type="text"
                          id="loser"
                          name="loser"
                          placeholder={t('filter_by_loser')}
                          value={filters.loser}
                          onChange={handleFilterChange}
                        />
                      </div>

                      <div className="filter-group">
                        <label htmlFor="map">{t('filter_map')}</label>
                        <input
                          type="text"
                          id="map"
                          name="map"
                          placeholder={t('filter_by_map')}
                          value={filters.map}
                          onChange={handleFilterChange}
                        />
                      </div>

                      <div className="filter-group">
                        <label htmlFor="status">{t('filter_match_status')}</label>
                        <select
                          id="status"
                          name="status"
                          value={filters.status}
                          onChange={handleFilterChange}
                        >
                          <option value="">{t('all')}</option>
                          <option value="unconfirmed">{t('match_status_unconfirmed')}</option>
                          <option value="confirmed">{t('match_status_confirmed')}</option>
                          <option value="disputed">{t('match_status_disputed')}</option>
                          <option value="cancelled">{t('match_status_cancelled')}</option>
                        </select>
                      </div>

                      <button className="reset-btn" onClick={resetFilters}>{t('reset_filters')}</button>
                    </div>

                    <MatchesTable 
                      matches={filteredMatches}
                      currentPlayerId={userId || ''}
                      onViewDetails={openMatchDetails}
                      onOpenConfirmation={openConfirmation}
                      onDownloadReplay={async (matchId, replayFilePath) => {
                        try {
                          let API_URL: string;
                          if (window.location.hostname === 'main.wesnoth-tournament-manager.pages.dev') {
                            API_URL = 'https://wesnothtournamentmanager-main.up.railway.app/api';
                          } else if (window.location.hostname === 'wesnoth-tournament-manager.pages.dev') {
                            API_URL = 'https://wesnothtournamentmanager-production.up.railway.app/api';
                          } else if (window.location.hostname.includes('feature-unranked-tournaments')) {
                            API_URL = 'https://wesnothtournamentmanager-wesnothtournamentmanager-pr-1.up.railway.app/api';
                          } else {
                            API_URL = '/api';
                          }
                          
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
                    
                    {opponentStatsLoading && (
                      <div className="loading-message">{t('loading')}</div>
                    )}

                    {opponentStatsError && (
                      <div className="error-message">{opponentStatsError}</div>
                    )}

                    {!opponentStatsLoading && !opponentStatsError && opponentStats.length === 0 && (
                      <div className="no-data-message">{t('no_opponent_data') || 'No opponent data available'}</div>
                    )}

                    {!opponentStatsLoading && !opponentStatsError && opponentStats.length > 0 && (
                      <>
                        <div className="filter-section">
                          <input
                            type="text"
                            placeholder={t('filter_by_opponent') || 'Filter by opponent...'}
                            value={filterOpponent}
                            onChange={(e) => setFilterOpponent(e.target.value)}
                            className="opponent-filter"
                          />
                        </div>

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
                                <th className="numeric sortable" onClick={() => handleSort('wins')}>
                                  {t('wins') || 'Wins'}
                                  {sortColumn === 'wins' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                                </th>
                                <th className="numeric sortable" onClick={() => handleSort('losses')}>
                                  {t('losses') || 'Losses'}
                                  {sortColumn === 'losses' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                                </th>
                                <th className="numeric sortable" onClick={() => handleSort('win_percentage')}>
                                  {t('win_percentage') || 'Win %'}
                                  {sortColumn === 'win_percentage' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                                </th>
                                <th className="numeric sortable" onClick={() => handleSort('elo_gained')}>
                                  {t('elo_gained') || 'ELO Gained'}
                                  {sortColumn === 'elo_gained' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                                </th>
                                <th className="numeric sortable" onClick={() => handleSort('elo_lost')}>
                                  {t('elo_lost') || 'ELO Lost'}
                                  {sortColumn === 'elo_lost' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                                </th>
                                <th className="sortable" onClick={() => handleSort('last_match_date')}>
                                  {t('last_match') || 'Last Match'}
                                  {sortColumn === 'last_match_date' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredOpponentStats.map((stat) => {
                                const winPercentage = stat.total_games > 0 
                                  ? (stat.wins / stat.total_games) * 100 
                                  : 0;
                                
                                return (
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
                                      <span className="wins-badge">{stat.wins}</span>
                                    </td>
                                    <td className="numeric">
                                      <span className="losses-badge">{stat.losses}</span>
                                    </td>
                                    <td className="numeric">
                                      <span className={`percentage-badge ${winPercentage > 55 ? 'positive' : winPercentage < 45 ? 'negative' : ''}`}>
                                        {winPercentage.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="numeric">
                                      <span className="elo-positive">+{Number(stat.elo_gained).toFixed(2)}</span>
                                    </td>
                                    <td className="numeric">
                                      <span className="elo-negative">-{Number(stat.elo_lost).toFixed(2)}</span>
                                    </td>
                                    <td>
                                      <span className="date">{stat.last_match_date ? new Date(stat.last_match_date).toLocaleDateString() : 'N/A'}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Performance by Map Tab */}
              {activeTab === 'by-map' && (
                <div className="tab-pane active">
                  <PlayerStatsByMap playerId={userId || ''} />
                </div>
              )}

              {/* Performance by Faction Tab */}
              {activeTab === 'by-faction' && (
                <div className="tab-pane active">
                  <PlayerStatsByFaction playerId={userId || ''} />
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

        {/* Match Confirmation Modal */}
        {confirmationModal.isOpen && confirmationModal.match && (
          <MatchConfirmationModal
            match={confirmationModal.match}
            currentPlayerId={userId || ''}
            onClose={closeConfirmation}
            onSubmit={handleConfirmationSuccess}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default User;
