import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { userService, matchService, publicService } from '../services/api';
import { processMultiLanguageItems } from '../utils/languageFallback';
import '../styles/Home.css';

const Home: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [recentPlayers, setRecentPlayers] = useState<any[]>([]);
  const [playerOfMonth, setPlayerOfMonth] = useState<any>(null);
  const [playerMonthlyStats, setPlayerMonthlyStats] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetchMatches = async () => {
    try {
      const matchesRes = await matchService.getAllMatches();
      setRecentMatches(matchesRes.data?.slice(0, 10) || []);
    } catch (err) {
      console.error('Error refetching matches:', err);
    }
  };

  const handleDownloadReplay = async (matchId: string, replayFilePath: string) => {
    try {
      // Extract filename from path
      const filename = replayFilePath.split('/').pop() || `replay_${matchId}`;
      
      // Increment download count in the database
      await matchService.incrementReplayDownloads(matchId);
      
      // Refresh the matches to update the download count
      await refetchMatches();
      
      // Construct the download URL - use current origin for API
      const downloadUrl = `/api/matches/${matchId}/replay/download`;
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading replay:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Fetch top 10 players
        try {
          const rankingRes = await userService.getGlobalRanking();
          const players = rankingRes.data?.data || rankingRes.data || [];
          setTopPlayers(Array.isArray(players) ? players.slice(0, 10) : []);
          // Player of month - top player this month
          if (Array.isArray(players) && players.length > 0) {
            const topPlayer = players[0];
            setPlayerOfMonth(topPlayer);
            
            // Fetch monthly stats for player of month
            try {
              const statsRes = await userService.getUserMonthlyStats(topPlayer.id);
              setPlayerMonthlyStats(statsRes.data || statsRes);
            } catch (statsErr) {
              console.error('Error fetching monthly stats:', statsErr);
            }
          }
        } catch (err) {
          console.error('Error fetching ranking:', err);
        }

        // Fetch recent matches (only 3 for home page)
        try {
          const matchesRes = await publicService.getRecentMatches();
          setRecentMatches(matchesRes.data?.slice(0, 3) || []);
        } catch (err) {
          console.error('Error fetching matches:', err);
        }

        // Fetch recent players (latest registrations)
        try {
          const usersRes = await userService.getAllUsers();
          const allUsers = usersRes.data?.data || usersRes.data || [];
          if (Array.isArray(allUsers)) {
            // Get newest players by sorting by creation date (reverse order for newest first)
            const sortedByDate = [...allUsers].sort((a, b) => {
              const dateA = new Date(a.created_at || 0).getTime();
              const dateB = new Date(b.created_at || 0).getTime();
              return dateB - dateA;
            });
            setRecentPlayers(sortedByDate.slice(0, 3));
          }
        } catch (err) {
          console.error('Error fetching recent players:', err);
        }

        // Fetch announcements
        try {
          const newsRes = await publicService.getNews();
          const rawNews = newsRes.data || [];
          // Process with language fallback: use user's language, fallback to EN
          const localizedNews = processMultiLanguageItems(rawNews, i18n.language);
          setAnnouncements(localizedNews.slice(0, 5));
        } catch (err) {
          console.error('Error fetching announcements:', err);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Error loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [i18n.language]);

  if (loading) {
    return <div className="home"><p>{t('loading')}</p></div>;
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>{t('app_name')}</h1>
        {error && <p className="error-message">{error}</p>}
      </div>

      <div className="home-layout">
        {/* Left Column: 80% */}
        <div className="home-left">
          {/* Recent Matches */}
          <section className="home-section recent-matches-section">
            <div className="section-header">
              <h2>{t('recent_games')}</h2>
              <a href="/matches" className="view-all-link">{t('view_all') || 'View All →'}</a>
            </div>
            {recentMatches.length > 0 ? (
              <div className="recent-matches-table-wrapper">
                <table className="recent-matches-table">
                  <thead>
                    <tr>
                      <th>{t('label_date')}</th>
                      <th>{t('label_winner')}</th>
                      <th>{t('label_winner_rating')}</th>
                      <th>{t('label_loser')}</th>
                      <th>{t('label_loser_rating')}</th>
                      <th>{t('label_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMatches.map((match) => {
                      const winnerEloChange = (match.winner_elo_after || 0) - (match.winner_elo_before || 0);
                      const loserEloChange = (match.loser_elo_after || 0) - (match.loser_elo_before || 0);

                      return (
                        <tr key={match.id} className="match-row">
                          <td className="date-col">
                            {new Date(match.created_at).toLocaleDateString()}
                          </td>
                          
                          <td className="winner-col">
                            <div className="player-info">
                              <span className="player-name">{match.winner_nickname}</span>
                              {match.winner_faction && (
                                <span className="faction-badge">{match.winner_faction}</span>
                              )}
                            </div>
                          </td>
                          
                          <td className="rating-col">
                            <div className="rating-block">
                              <div className="rating-value">{match.winner_elo_before || 'N/A'}</div>
                              <div className={`rating-change ${winnerEloChange >= 0 ? 'positive' : 'negative'}`}>
                                ({winnerEloChange >= 0 ? '+' : ''}{winnerEloChange})
                              </div>
                            </div>
                          </td>
                          
                          <td className="loser-col">
                            <div className="player-info">
                              <span className="player-name">{match.loser_nickname}</span>
                              {match.loser_faction && (
                                <span className="faction-badge">{match.loser_faction}</span>
                              )}
                            </div>
                          </td>
                          
                          <td className="rating-col">
                            <div className="rating-block">
                              <div className="rating-value">{match.loser_elo_before || 'N/A'}</div>
                              <div className={`rating-change ${loserEloChange >= 0 ? 'positive' : 'negative'}`}>
                                ({loserEloChange >= 0 ? '+' : ''}{loserEloChange})
                              </div>
                            </div>
                          </td>
                          
                          <td className="action-col">
                            {match.replay_file_path && (
                              <button 
                                className="download-btn"
                                onClick={() => handleDownloadReplay(match.id, match.replay_file_path)}
                                title={`${t('downloads')}: ${match.replay_downloads || 0}`}
                                type="button"
                              >
                                ⬇️
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>{t('recent_games_no_data')}</p>
            )}
          </section>

          {/* Announcements */}
          <section className="home-section announcements-section">
            <h2>{t('announcements')}</h2>
            {announcements.length > 0 ? (
              <div className="announcements-list">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="announcement-card">
                    <h3>{announcement.title}</h3>
                    <p>{announcement.content}</p>
                    <small>By {announcement.author} - {new Date(announcement.published_at || announcement.created_at).toLocaleDateString()}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p>{t('home.no_announcements')}</p>
            )}
          </section>
        </div>

        {/* Right Column: 20% */}
        <div className="home-right">
          {/* Player of Month */}
          <section className="home-widget">
            <h3>{t('home.player_of_month')}</h3>
            {playerOfMonth ? (
                <div className="widget-card player-of-month">
                  <div className="player-name">{playerOfMonth.nickname}</div>
                  <div className="player-stat">
                    <span className="label">{t('label_elo')}:</span>
                    <span className="value">
                      {playerOfMonth.is_rated ? playerOfMonth.elo_rating : t('unrated')}
                    </span>
                  </div>
                  <div className="player-stat">
                    <span className="label">{t('label_level')}:</span>
                    <span className="value">{playerOfMonth.level}</span>
                  </div>
                  {playerMonthlyStats && (
                    <>
                      <div className="player-stat">
                        <span className="label">ELO {t('month')}:</span>
                        <span className="value" style={{ color: playerMonthlyStats.elo_gained >= 0 ? '#4caf50' : '#f44336' }}>
                          {playerMonthlyStats.elo_gained >= 0 ? '+' : ''}{playerMonthlyStats.elo_gained}
                        </span>
                      </div>
                      <div className="player-stat">
                        <span className="label">{t('label_ranking_position')}:</span>
                        <span className="value" style={{ color: playerMonthlyStats.positions_gained >= 0 ? '#4caf50' : '#f44336' }}>
                          {playerMonthlyStats.positions_gained >= 0 ? '+' : ''}{playerMonthlyStats.positions_gained}
                        </span>
                      </div>
                    </>
                  )}
                </div>
            ) : (
              <p>{t('no_data')}</p>
            )}
          </section>

          {/* Recent Players */}
          <section className="home-widget">
            <h3>{t('home.recent_players')}</h3>
            {recentPlayers.length > 0 ? (
              <div className="widget-list">
                {recentPlayers.map((player) => (
                  <div key={player.id} className="widget-item">
                    <span className="player-nick">{player.nickname}</span>
                    <span className="player-elo">
                      {player.is_rated ? `${player.elo_rating} ${t('label_elo')}` : t('unrated')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p>{t('no_data')}</p>
            )}
          </section>

          {/* Top 10 */}
          <section className="home-widget">
            <h3>{t('home.top_10_players')}</h3>
            {topPlayers.length > 0 ? (
              <div className="widget-list top-10">
                {topPlayers.map((player, index) => (
                  <div key={player.id} className="widget-item ranking-item">
                    <span className="rank">#{index + 1}</span>
                    <span className="player-nick">{player.nickname}</span>
                    <span className="player-elo">
                      {player.is_rated ? player.elo_rating : t('unrated')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p>{t('no_data')}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Home;
