import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { publicService, tournamentService } from '../services/api';
import TournamentMatchReportModal from '../components/TournamentMatchReportModal';
import MatchConfirmationModal from '../components/MatchConfirmationModal';
import '../styles/Tournaments.css';

interface Tournament {
  id: string;
  name: string;
  description: string;
  creator_id: string;
  creator_nickname: string;
  status: string;
  tournament_type: string;
  general_rounds: number;
  final_rounds: number;
  general_rounds_format: 'bo1' | 'bo3' | 'bo5';
  final_rounds_format: 'bo1' | 'bo3' | 'bo5';
  round_duration_days: number;
  auto_advance_round: boolean;
  max_participants: number | null;
  created_at: string;
  started_at: string;
  finished_at: string;
}

interface TournamentParticipant {
  id: string;
  user_id: string;
  nickname: string;
  participation_status: string;
  tournament_ranking: number;
  tournament_wins: number;
  tournament_losses: number;
  tournament_points: number;
  elo_rating: number;
}

interface TournamentMatch {
  id: string;
  tournament_id: string;
  round_id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  match_id: string | null;
  match_status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  played_at: string | null;
  created_at: string;
  round_number: number;
  player1_nickname: string;
  player2_nickname: string;
  winner_nickname: string | null;
  match_status_from_matches?: 'confirmed' | 'disputed' | 'unconfirmed' | 'cancelled' | null;
  winner_faction?: string;
  loser_faction?: string;
  map?: string;
}

const TournamentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { userId } = useAuthStore();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [roundMatches, setRoundMatches] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [matchConfirmationMap, setMatchConfirmationMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'participants' | 'matches' | 'rounds' | 'roundMatches' | 'ranking'>('participants');
  const [userParticipationStatus, setUserParticipationStatus] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [reportMatchData, setReportMatchData] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [confirmMatchData, setConfirmMatchData] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [determineWinnerData, setDetermineWinnerData] = useState<any>(null);
  const [showDetermineWinnerModal, setShowDetermineWinnerModal] = useState(false);
  const [editData, setEditData] = useState({
    description: '',
    max_participants: 0,
    started_at: '',
    general_rounds: 0,
    final_rounds: 0,
    general_rounds_format: 'bo3' as 'bo1' | 'bo3' | 'bo5',
    final_rounds_format: 'bo5' as 'bo1' | 'bo3' | 'bo5'
  });

  // Get the origin page from location state
  const originPage = (location.state as any)?.from || 'tournaments';

  useEffect(() => {
    if (id) {
      fetchTournamentData();
    }
  }, [id, userId]);

  const fetchTournamentData = async () => {
    try {
      setLoading(true);
      const [tournamentRes, participantsRes, matchesRes, roundMaturesRes, roundsRes] = await Promise.all([
        publicService.getTournamentById(id!),
        publicService.getTournamentParticipants(id!),
        tournamentService.getTournamentMatches(id!),
        tournamentService.getTournamentRoundMatches(id!),
        tournamentService.getTournamentRounds(id!),
      ]);

      setTournament(tournamentRes.data);
      setParticipants(participantsRes.data || []);
      setMatches(matchesRes.data || []);
      setRoundMatches(roundMaturesRes.data || []);
      setRounds(roundsRes.data || []);
      
      console.log('Fetched data:', {
        tournament: tournamentRes.data,
        matches: matchesRes.data,
        rounds: roundsRes.data,
        userId: userId
      });
      console.log('Match status details:', matchesRes.data?.map((m: any) => ({
        id: m.id,
        match_id: m.match_id,
        match_status: m.match_status,
        match_status_from_matches: m.match_status_from_matches
      })));
      
      // Initialize edit data when tournament loads
      setEditData({
        description: tournamentRes.data.description || '',
        max_participants: tournamentRes.data.max_participants || 0,
        started_at: tournamentRes.data.started_at || '',
        general_rounds: tournamentRes.data.general_rounds || 0,
        final_rounds: tournamentRes.data.final_rounds || 0,
        general_rounds_format: tournamentRes.data.general_rounds_format || 'bo3',
        final_rounds_format: tournamentRes.data.final_rounds_format || 'bo5'
      });
      
      // Check user's participation status
      if (userId) {
        const userParticipant = participantsRes.data?.find((p: TournamentParticipant) => p.user_id === userId);
        setUserParticipationStatus(userParticipant?.participation_status || null);
      }

      setError('');
    } catch (err: any) {
      console.error('Error fetching tournament:', err);
      setError('Error loading tournament data');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTournament = async () => {
    try {
      await tournamentService.requestJoinTournament(id!);
      setSuccess('Join request sent! Waiting for organizer approval.');
      setUserParticipationStatus('pending');
      // Refresh the page after 2 seconds
      setTimeout(() => {
        fetchTournamentData();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request join');
    }
  };

  const handleBackButton = () => {
    if (originPage === 'my-tournaments') {
      navigate('/my-tournaments');
    } else {
      navigate('/tournaments');
    }
  };

  const handleCloseRegistration = async () => {
    try {
      await tournamentService.updateTournament(id!, { status: 'registration_closed' });
      setSuccess('Registration closed successfully!');
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to close registration');
    }
  };

  const handlePrepareAndStart = async () => {
    try {
      // Save edit data first if any changes
      if (editData.description !== tournament?.description || 
          editData.max_participants !== tournament?.max_participants ||
          editData.started_at !== tournament?.started_at ||
          editData.general_rounds !== tournament?.general_rounds ||
          editData.final_rounds !== tournament?.final_rounds ||
          editData.general_rounds_format !== tournament?.general_rounds_format ||
          editData.final_rounds_format !== tournament?.final_rounds_format) {
        await tournamentService.updateTournament(id!, editData);
      }
      
      // Change status to prepared (without starting yet)
      await tournamentService.updateTournament(id!, { status: 'prepared' });
      setSuccess('Tournament prepared! You can now start it.');
      setEditMode(false);
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to prepare tournament');
    }
  };

  const handleStartTournament = async () => {
    try {
      // Call backend to create rounds and start tournament
      await tournamentService.startTournament(id!);
      setSuccess('Tournament started! Rounds created.');
      setEditMode(false);
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start tournament');
    }
  };

  const handleSaveChanges = async () => {
    try {
      await tournamentService.updateTournament(id!, editData);
      setSuccess('Tournament configuration updated!');
      setEditMode(false);
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save changes');
    }
  };

  const handleAcceptParticipant = async (participantId: string) => {
    try {
      await tournamentService.acceptParticipant(id!, participantId);
      setSuccess('Participant accepted!');
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to accept participant');
    }
  };

  const handleRejectParticipant = async (participantId: string) => {
    try {
      await tournamentService.rejectParticipant(id!, participantId);
      setSuccess('Participant rejected!');
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reject participant');
    }
  };

  const handleOpenReportMatch = (match: TournamentMatch) => {
    setReportMatchData({
      tournamentMatchId: match.id,
      tournamentId: id,
      tournamentName: tournament?.name,
      player1Id: match.player1_id,
      player1Name: match.player1_nickname,
      player2Id: match.player2_id,
      player2Name: match.player2_nickname,
    });
    setShowReportModal(true);
  };

  const handleCloseReportModal = () => {
    setShowReportModal(false);
    setReportMatchData(null);
  };

  const handleReportMatchSuccess = () => {
    setSuccess('Match reported successfully!');
    fetchTournamentData();
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleOpenConfirmModal = (match: TournamentMatch) => {
    setConfirmMatchData(match);
    setShowConfirmModal(true);
  };

  const handleCloseConfirmModal = () => {
    setShowConfirmModal(false);
    setConfirmMatchData(null);
  };

  const handleConfirmSuccess = () => {
    setSuccess('Match confirmed!');
    handleCloseConfirmModal(); // Close the modal
    fetchTournamentData();
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDetermineWinner = async (winnerId: string) => {
    try {
      if (!determineWinnerData) return;
      
      await tournamentService.determineMatchWinner(id!, determineWinnerData.id, { winner_id: winnerId });
      setSuccess('Match winner determined!');
      setShowDetermineWinnerModal(false);
      setDetermineWinnerData(null);
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to determine match winner');
    }
  };

  const handleStartNextRound = async (currentRoundNumber: number) => {
    try {
      const response = await fetch(`http://localhost:3000/api/tournaments/${id}/next-round`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start next round');
      }

      setSuccess(`Round ${currentRoundNumber + 1} started successfully!`);
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to start next round');
    }
  };

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'pending': '#FF9800',
      'active': '#4CAF50',
      'completed': '#2196F3',
      'cancelled': '#f44336',
    };
    return colorMap[status] || '#999';
  };

  const getParticipationStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'pending': '#FFC107',
      'accepted': '#4CAF50',
      'denied': '#f44336',
      'cancelled': '#999',
    };
    return colorMap[status] || '#999';
  };

  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const isCreator = userId === tournament?.creator_id;
  const isAcceptedParticipant = userParticipationStatus === 'accepted';

  if (loading) {
    return <div className="admin-container"><p>Loading...</p></div>;
  }

  if (!tournament) {
    return (
      <div className="admin-container">
        <p>{error || 'Tournament not found'}</p>
        <button onClick={() => navigate('/tournaments')}>Back to Tournaments</button>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="tournament-header">
        <button onClick={handleBackButton} className="btn-back">← Back</button>
        <h1>{tournament.name}</h1>
        <span 
          className="status-badge"
          style={{ backgroundColor: getStatusColor(tournament.status) }}
        >
          {tournament.status}
        </span>
      </div>

      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      <div className="tournament-info">
        <p><strong>Organizer:</strong> {tournament.creator_nickname}</p>
        <p><strong>Type:</strong> {tournament.tournament_type}</p>
        <p><strong>Max Participants:</strong> {tournament.max_participants || 'Unlimited'}</p>
        <p><strong>Created:</strong> {formatDate(tournament.created_at)}</p>
        {tournament.started_at && <p><strong>Started:</strong> {formatDate(tournament.started_at)}</p>}
        {tournament.finished_at && <p><strong>Finished:</strong> {formatDate(tournament.finished_at)}</p>}
        <p><strong>Description:</strong> {tournament.description}</p>
      </div>

      {/* Tournament Configuration Section */}
      <div className="tournament-config">
        <h3>Tournament Configuration</h3>
        <div className="config-grid">
          <div className="config-item">
            <strong>Round Duration:</strong> {tournament.round_duration_days} days
          </div>
          <div className="config-item">
            <strong>Auto-advance Rounds:</strong> {tournament.auto_advance_round ? 'Yes' : 'No'}
          </div>
          <div className="config-item">
            <strong>General Rounds:</strong> {tournament.general_rounds}
          </div>
          <div className="config-item">
            <strong>General Rounds Format:</strong> {tournament.general_rounds_format.toUpperCase()}
          </div>
          <div className="config-item">
            <strong>Final Rounds:</strong> {tournament.final_rounds}
          </div>
          <div className="config-item">
            <strong>Final Rounds Format:</strong> {tournament.final_rounds_format.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Organizer Controls Section */}
      {isCreator && (
        <div className="organizer-controls">
          <h3>Tournament Management</h3>
          
          {editMode && tournament.status !== 'in_progress' ? (
            <div className="edit-form">
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label>Max Participants</label>
                <input
                  type="number"
                  min="2"
                  max="256"
                  value={editData.max_participants}
                  onChange={(e) => setEditData({ ...editData, max_participants: parseInt(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Tournament Start Date</label>
                <input
                  type="datetime-local"
                  value={editData.started_at ? editData.started_at.substring(0, 16) : ''}
                  onChange={(e) => setEditData({ ...editData, started_at: e.target.value })}
                />
              </div>

              <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #ddd' }} />

              <h4 style={{ marginTop: '1rem', marginBottom: '1rem' }}>Round Configuration</h4>

              <div className="form-group">
                <label>General Rounds</label>
                <input
                  type="number"
                  min="0"
                  value={editData.general_rounds}
                  onChange={(e) => setEditData({ ...editData, general_rounds: parseInt(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>General Rounds Format</label>
                <select
                  value={editData.general_rounds_format}
                  onChange={(e) => setEditData({ ...editData, general_rounds_format: e.target.value as 'bo1' | 'bo3' | 'bo5' })}
                >
                  <option value="bo1">Best of 1 (Single match)</option>
                  <option value="bo3">Best of 3 (First to 2 wins)</option>
                  <option value="bo5">Best of 5 (First to 3 wins)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Final Rounds</label>
                <input
                  type="number"
                  min="0"
                  value={editData.final_rounds}
                  onChange={(e) => setEditData({ ...editData, final_rounds: parseInt(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Final Rounds Format</label>
                <select
                  value={editData.final_rounds_format}
                  onChange={(e) => setEditData({ ...editData, final_rounds_format: e.target.value as 'bo1' | 'bo3' | 'bo5' })}
                >
                  <option value="bo1">Best of 1 (Single match)</option>
                  <option value="bo3">Best of 3 (First to 2 wins)</option>
                  <option value="bo5">Best of 5 (First to 3 wins)</option>
                </select>
              </div>

              <div className="button-group">
                <button onClick={handleSaveChanges} className="btn-save">Save Changes</button>
                <button onClick={() => setEditMode(false)} className="btn-cancel">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="control-buttons">
              {tournament.status !== 'in_progress' && tournament.status !== 'finished' && (
                <button onClick={() => setEditMode(true)} className="btn-edit">Edit Tournament</button>
              )}

              {tournament.status === 'registration_open' && (
                <button onClick={handleCloseRegistration} className="btn-close-reg">Close Registration</button>
              )}

              {tournament.status === 'registration_closed' && (
                <button onClick={handlePrepareAndStart} className="btn-prepare">Prepare Tournament</button>
              )}

              {tournament.status === 'prepared' && (
                <button onClick={handleStartTournament} className="btn-start">Start Tournament</button>
              )}

              {tournament.status === 'in_progress' && (
                <p className="tournament-started-message">✓ Tournament has started. Configuration is now locked.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Join button for non-creators (only if logged in) */}
      {!isCreator && tournament.status === 'registration_open' && !userParticipationStatus && userId && (
        <button className="btn-join-tournament" onClick={handleJoinTournament}>
          Request to Join Tournament
        </button>
      )}

      {userParticipationStatus === 'pending' && (
        <p className="pending-status">⏳ Your join request is pending approval from the organizer</p>
      )}

      {userParticipationStatus === 'denied' && (
        <p className="denied-status">❌ Your join request was denied</p>
      )}

      <div className="tabs-section">
        <button 
          className={`tab-btn ${activeTab === 'participants' ? 'active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          Participants ({participants.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          Matches ({matches.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'rounds' ? 'active' : ''}`}
          onClick={() => setActiveTab('rounds')}
        >
          Rounds ({rounds.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'roundMatches' ? 'active' : ''}`}
          onClick={() => setActiveTab('roundMatches')}
        >
          Round Details
        </button>
        <button 
          className={`tab-btn ${activeTab === 'ranking' ? 'active' : ''}`}
          onClick={() => setActiveTab('ranking')}
        >
          Ranking
        </button>
      </div>

      {activeTab === 'participants' && (
        <div className="tab-content">
          {participants.length > 0 ? (
            <table className="participants-table">
              <thead>
                <tr>
                  <th>Nickname</th>
                  <th>Status</th>
                  <th>ELO Rating</th>
                  <th>Ranking</th>
                  <th>Wins</th>
                  <th>Losses</th>
                  <th>Points</th>
                  {isCreator && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nickname}</td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getParticipationStatusColor(p.participation_status) }}
                      >
                        {p.participation_status}
                      </span>
                    </td>
                    <td>{p.elo_rating || '-'}</td>
                    <td>{p.tournament_ranking || '-'}</td>
                    <td>{p.tournament_wins}</td>
                    <td>{p.tournament_losses}</td>
                    <td>{p.tournament_points}</td>
                    {isCreator && p.participation_status === 'pending' && (
                      <td>
                        <button 
                          className="btn-accept"
                          onClick={() => handleAcceptParticipant(p.id)}
                        >
                          Accept
                        </button>
                        <button 
                          className="btn-reject"
                          onClick={() => handleRejectParticipant(p.id)}
                        >
                          Reject
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No participants yet</p>
          )}
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="tab-content">
          {tournament?.status !== 'in_progress' && tournament?.status !== 'finished' ? (
            <p className="no-matches-message">Matches will be generated once the tournament starts.</p>
          ) : (
            <>
              {/* Scheduled Matches Section */}
              <div className="matches-section">
                <h3>Scheduled Matches</h3>
                {rounds.length > 0 ? (
                  <>
                    {rounds.map((round) => {
                      const roundMatches = matches.filter(
                        (m) => m.round_id === round.id && m.match_status === 'pending'
                      );
                      
                      if (roundMatches.length === 0) return null;
                      
                      return (
                        <div key={round.id} className="round-matches">
                          <h4>Round {round.round_number} ({round.round_type}) - {round.round_status}</h4>
                          <table className="matches-table">
                            <thead>
                              <tr>
                                <th>Player 1</th>
                                <th>vs</th>
                                <th>Player 2</th>
                                <th>Play Before</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {roundMatches.map((match) => {
                                // Calculate play before date: round_start_date + round_duration_days
                                let playBeforeDate = '-';
                                if (round.round_start_date && tournament?.round_duration_days) {
                                  const startDate = new Date(round.round_start_date);
                                  const endDate = new Date(startDate.getTime() + (tournament.round_duration_days * 24 * 60 * 60 * 1000));
                                  playBeforeDate = formatDate(endDate.toISOString());
                                }

                                // Check if current user is one of the players
                                const isPlayer = userId === match.player1_id || userId === match.player2_id;
                                console.log('Match Debug:', {
                                  matchId: match.id,
                                  player1_id: match.player1_id,
                                  player2_id: match.player2_id,
                                  userId: userId,
                                  isPlayer: isPlayer,
                                  match_status: match.match_status,
                                  round_status: round.status,
                                  round_round_status: round.round_status
                                });
                                
                                return (
                                  <tr key={match.id}>
                                    <td><strong>{match.player1_nickname}</strong></td>
                                    <td>vs</td>
                                    <td><strong>{match.player2_nickname}</strong></td>
                                    <td>{playBeforeDate}</td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span className="status-badge" style={{ backgroundColor: '#FFC107' }}>
                                          {match.match_status_from_matches === 'confirmed' ? t('match_status_confirmed') :
                                           match.match_status_from_matches === 'disputed' ? t('match_status_disputed') :
                                           match.match_status_from_matches === 'unconfirmed' ? t('match_status_unconfirmed') :
                                           match.match_status_from_matches === 'cancelled' ? t('match_status_cancelled') :
                                           match.match_status_from_matches || 'pending'}
                                        </span>
                                        {isPlayer && (round.status === 'pending' || round.status === 'in_progress' || round.round_status === 'pending' || round.round_status === 'in_progress') && (
                                          <button
                                            className="btn-report-match"
                                            onClick={() => handleOpenReportMatch(match)}
                                            title={t('report_match_link')}
                                          >
                                            {t('report_match_link')}
                                          </button>
                                        )}
                                        {isCreator && (round.status === 'completed' || round.status === 'closed') && !match.winner_id && (
                                          <button
                                            className="btn-determine-winner"
                                            onClick={() => {
                                              setDetermineWinnerData(match);
                                              setShowDetermineWinnerModal(true);
                                            }}
                                            title={t('determine_winner')}
                                          >
                                            {t('determine_winner')}
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                    {matches.filter((m) => m.match_status === 'pending').length === 0 && (
                      <p>No scheduled matches at this time.</p>
                    )}
                  </>
                ) : (
                  <p>No rounds configured.</p>
                )}
              </div>

              {/* Completed Matches Section */}
              <div className="matches-section">
                <h3>Completed Matches</h3>
                {matches.filter((m) => m.match_status === 'completed').length > 0 ? (
                  <table className="matches-table completed-matches">
                    <thead>
                      <tr>
                        <th>Round</th>
                        <th>Winner</th>
                        <th>Loser</th>
                        <th>Played On</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches
                        .filter((m) => m.match_status === 'completed')
                        .sort((a, b) => {
                          const roundDiff = (b.round_number || 0) - (a.round_number || 0);
                          return roundDiff !== 0 ? roundDiff : new Date(b.played_at || '').getTime() - new Date(a.played_at || '').getTime();
                        })
                        .map((match) => {
                          const loserNickname = match.winner_nickname === match.player1_nickname 
                            ? match.player2_nickname 
                            : match.player1_nickname;
                          const loserId = match.winner_nickname === match.player1_nickname 
                            ? match.player2_id 
                            : match.player1_id;
                          const isCurrentUserLoser = userId === loserId;
                          
                          // If no match_id, it was determined by admin, show "ADMIN" status
                          const isAdminDetermined = !match.match_id;
                          // Use match_status_from_matches from the matches table (confirmed, disputed, unconfirmed, cancelled)
                          const confirmationStatus = isAdminDetermined ? 'admin' : (match.match_status_from_matches || 'unconfirmed');

                          return (
                            <tr key={match.id}>
                              <td>Round {match.round_number}</td>
                              <td><strong>{match.winner_nickname || '-'}</strong></td>
                              <td>{loserNickname}</td>
                              <td>{match.played_at ? formatDate(match.played_at) : '-'}</td>
                              <td>
                                {isAdminDetermined ? (
                                  <span className="badge-admin">👤 ADMIN</span>
                                ) : confirmationStatus === 'confirmed' ? (
                                  <span className="badge-confirmed">✓ Confirmed</span>
                                ) : confirmationStatus === 'disputed' ? (
                                  <span className="badge-disputed">⚠ Disputed</span>
                                ) : (
                                  <span className="badge-unconfirmed">⏳ Unconfirmed</span>
                                )}
                              </td>
                              <td>
                                <div className="action-buttons">
                                  {!isAdminDetermined && isCurrentUserLoser && confirmationStatus === 'unconfirmed' && (
                                    <button
                                        className="btn-confirm-dispute"
                                        onClick={() => handleOpenConfirmModal(match)}
                                      >
                                        {t('confirm_dispute')}
                                      </button>
                                  )}
                                  {!isAdminDetermined && match.match_id ? (
                                    <button
                                      className="btn-view-match"
                                      onClick={() => navigate(`/matches/${match.match_id}`)}
                                    >
                                      {t('view_match')}
                                    </button>
                                  ) : (
                                    <span className="no-link">-</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                ) : (
                  <p>No completed matches yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Rounds Section */}
      {activeTab === 'rounds' && (
        <div className="tab-content">
          {rounds.length > 0 ? (
            <table className="rounds-table">
              <thead>
                <tr>
                  <th>Round #</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Format</th>
                  {isCreator && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => (
                  <tr key={round.id}>
                    <td>
                      <strong>{round.round_number}</strong>
                    </td>
                    <td>{round.round_type || '-'}</td>
                    <td>
                      <span className={`status-badge status-${round.round_status || 'pending'}`}>
                        {round.round_status || 'pending'}
                      </span>
                    </td>
                    <td>{round.round_start_date ? formatDate(round.round_start_date) : '-'}</td>
                    <td>{round.round_end_date ? formatDate(round.round_end_date) : '-'}</td>
                    <td>{(round as any)?.match_format || '-'}</td>
                    {isCreator && (
                      <td>
                        {round.round_status === 'completed' && round.round_number < rounds.length ? (
                          (() => {
                            const nextRound = rounds.find(r => r.round_number === round.round_number + 1);
                            return nextRound && nextRound.round_status === 'pending' ? (
                              <button
                                className="btn-start-round"
                                onClick={() => handleStartNextRound(round.round_number)}
                                title="Start next round"
                              >
                                Start Round {round.round_number + 1}
                              </button>
                            ) : (
                              <span style={{ color: '#999' }}>-</span>
                            );
                          })()
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No rounds configured for this tournament yet.</p>
          )}
        </div>
      )}

      {/* Round Matches Section */}
      {activeTab === 'roundMatches' && (
        <div className="tab-content">
          {rounds.length > 0 ? (
            <>
              {rounds.map((round) => {
                const matchesInRound = roundMatches.filter((m) => m.round_id === round.id);
                
                if (matchesInRound.length === 0) return null;
                
                return (
                  <div key={round.id} className="round-matches-section">
                    <h3>Round {round.round_number} - {round.round_type}</h3>
                    <table className="matches-table">
                      <thead>
                        <tr>
                          <th>Player 1</th>
                          <th>vs</th>
                          <th>Player 2</th>
                          <th>Winner</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchesInRound.map((match) => (
                          <tr key={match.id}>
                            <td>
                              <strong>{match.player1_nickname}</strong>
                              {(match as any).player1_wins !== undefined && (
                                <span style={{ color: '#666', fontSize: '0.85em' }}>
                                  {' '}({(match as any).player1_wins})
                                </span>
                              )}
                            </td>
                            <td>vs</td>
                            <td>
                              <strong>{match.player2_nickname}</strong>
                              {(match as any).player2_wins !== undefined && (
                                <span style={{ color: '#666', fontSize: '0.85em' }}>
                                  {' '}({(match as any).player2_wins})
                                </span>
                              )}
                            </td>
                            <td>
                              {match.winner_id === match.player1_id ? (
                                <strong style={{ color: '#28a745' }}>{match.player1_nickname}</strong>
                              ) : match.winner_id === match.player2_id ? (
                                <strong style={{ color: '#28a745' }}>{match.player2_nickname}</strong>
                              ) : (
                                <span style={{ color: '#999' }}>-</span>
                              )}
                            </td>
                            <td>
                              <span className={`status-badge status-${(match as any).series_status || 'pending'}`}>
                                {(match as any).series_status || 'pending'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </>
          ) : (
            <p>No rounds configured for this tournament yet.</p>
          )}
        </div>
      )}

      {/* Ranking Section */}
      {activeTab === 'ranking' && (
        <div className="tab-content">
          {participants.length > 0 ? (
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Nickname</th>
                  <th>Wins</th>
                  <th>Losses</th>
                  <th>Points</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {participants
                  .sort((a, b) => {
                    const pointsDiff = (b.tournament_points || 0) - (a.tournament_points || 0);
                    if (pointsDiff !== 0) return pointsDiff;
                    return (b.tournament_wins || 0) - (a.tournament_wins || 0);
                  })
                  .map((participant, index) => (
                    <tr key={participant.id}>
                      <td>
                        <strong>#{index + 1}</strong>
                      </td>
                      <td>{participant.nickname}</td>
                      <td>{participant.tournament_wins || 0}</td>
                      <td>{participant.tournament_losses || 0}</td>
                      <td><strong>{participant.tournament_points || 0}</strong></td>
                      <td>
                        <span className={`status-badge status-${participant.participation_status || 'pending'}`}>
                          {participant.participation_status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <p>No participants in this tournament.</p>
          )}
        </div>
      )}

      {/* Report Match Modal */}
      {showReportModal && reportMatchData && (
        <TournamentMatchReportModal
          tournamentMatchId={reportMatchData.tournamentMatchId}
          tournamentId={reportMatchData.tournamentId}
          tournamentName={reportMatchData.tournamentName}
          player1Id={reportMatchData.player1Id}
          player1Name={reportMatchData.player1Name}
          player2Id={reportMatchData.player2Id}
          player2Name={reportMatchData.player2Name}
          currentUserId={userId!}
          onClose={handleCloseReportModal}
          onSuccess={handleReportMatchSuccess}
        />
      )}

      {/* Confirm/Dispute Match Modal */}
      {showConfirmModal && confirmMatchData && (
        <MatchConfirmationModal
          currentPlayerId={userId!}
          match={confirmMatchData}
          onClose={handleCloseConfirmModal}
          onSubmit={handleConfirmSuccess}
        />
      )}

      {/* Determine Winner Modal */}
      {showDetermineWinnerModal && determineWinnerData && (
        <div className="modal-overlay" onClick={() => { setShowDetermineWinnerModal(false); setDetermineWinnerData(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Determine Match Winner</h3>
              <button
                className="modal-close"
                onClick={() => { setShowDetermineWinnerModal(false); setDetermineWinnerData(null); }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1.5rem', color: '#666' }}>
                Select the winner for this match between <strong>{determineWinnerData.player1_nickname}</strong> and <strong>{determineWinnerData.player2_nickname}</strong>
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  className="btn-winner-select"
                  onClick={() => handleDetermineWinner(determineWinnerData.player1_id)}
                  style={{ flex: 1 }}
                >
                  {determineWinnerData.player1_nickname} Wins
                </button>
                <button
                  className="btn-winner-select"
                  onClick={() => handleDetermineWinner(determineWinnerData.player2_id)}
                  style={{ flex: 1 }}
                >
                  {determineWinnerData.player2_nickname} Wins
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetail;

