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
  status: string | null;
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
  winner_comments?: string;
  loser_comments?: string;
  replay_file_path?: string;
  replay_downloads?: number;
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
  const [matchDetailsModal, setMatchDetailsModal] = useState<{ isOpen: boolean; match: TournamentMatch | null }>({ isOpen: false, match: null });
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
      setError(t('error_loading_tournament'));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTournament = async () => {
    try {
      await tournamentService.requestJoinTournament(id!);
      setSuccess(t('success_join_request_sent'));
      setUserParticipationStatus('pending');
      // Refresh the page after 2 seconds
      setTimeout(() => {
        fetchTournamentData();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_failed_join_tournament'));
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
      setSuccess(t('success_registration_closed'));
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_failed_close_registration'));
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
      setSuccess(t('success_tournament_prepared'));
      setEditMode(false);
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_failed_prepare_tournament'));
    }
  };

  const handleStartTournament = async () => {
    try {
      // Call backend to create rounds and start tournament
      await tournamentService.startTournament(id!);
      setSuccess(t('success_tournament_started'));
      setEditMode(false);
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_failed_start_tournament'));
    }
  };

  const handleSaveChanges = async () => {
    try {
      await tournamentService.updateTournament(id!, editData);
      setSuccess(t('success_tournament_configuration_updated'));
      setEditMode(false);
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_failed_save_changes'));
    }
  };

  const handleAcceptParticipant = async (participantId: string) => {
    try {
      await tournamentService.acceptParticipant(id!, participantId);
      setSuccess(t('success_participant_accepted'));
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_failed_accept_participant'));
    }
  };

  const handleRejectParticipant = async (participantId: string) => {
    try {
      await tournamentService.rejectParticipant(id!, participantId);
      setSuccess(t('success_participant_rejected'));
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_failed_reject_participant'));
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
    setSuccess(t('success_match_reported'));
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
      setSuccess(t('success_match_confirmed'));
    handleCloseConfirmModal(); // Close the modal
    fetchTournamentData();
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDetermineWinner = async (winnerId: string) => {
    try {
      if (!determineWinnerData) return;
      
      await tournamentService.determineMatchWinner(id!, determineWinnerData.id, { winner_id: winnerId });
      setSuccess(t('success_match_winner_determined'));
      setShowDetermineWinnerModal(false);
      setDetermineWinnerData(null);
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_failed_determine_winner'));
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

      setSuccess(t('success_round_started', { number: currentRoundNumber + 1 }));
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || t('error_failed_start_next_round'));
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
    if (!date) return t('not_available');
    return new Date(date).toLocaleDateString();
  };

  // Normalize status values to match locale keys like `option_in_progress`
  const normalizeStatus = (s?: string) => {
    if (!s) return 'pending';
    return s.toString().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
  };

  const isCreator = userId === tournament?.creator_id;
  const isAcceptedParticipant = userParticipationStatus === 'accepted';

  if (loading) {
    return <div className="admin-container"><p>{t('loading')}</p></div>;
  }

  if (!tournament) {
    return (
      <div className="admin-container">
        <p>{error || t('tournament_title')}</p>
        <button onClick={() => navigate('/tournaments')}>{t('tournaments.back_to_tournaments')}</button>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="tournament-header">
        <button onClick={handleBackButton} className="btn-back">← {t('tournaments.back_to_tournaments')}</button>
        <h1>{tournament.name}</h1>
        <span 
          className="status-badge"
          style={{ backgroundColor: getStatusColor(tournament.status) }}
        >
          {t(`option_${normalizeStatus(tournament.status)}`) !== `option_${normalizeStatus(tournament.status)}` ? t(`option_${normalizeStatus(tournament.status)}`) : (tournament.status || t('option_pending'))}
        </span>
      </div>

      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      <div className="tournament-info">
        <p><strong>{t('tournament.col_organizer')}:</strong> {tournament.creator_nickname}</p>
        <p><strong>{t('tournament.col_type')}:</strong> {tournament.tournament_type}</p>
        <p><strong>{t('label_max_participants')}:</strong> {tournament.max_participants || t('unlimited')}</p>
        <p><strong>{t('label_created')}:</strong> {formatDate(tournament.created_at)}</p>
        {tournament.started_at && <p><strong>{t('label_started')}:</strong> {formatDate(tournament.started_at)}</p>}
        {tournament.finished_at && <p><strong>{t('label_finished')}:</strong> {formatDate(tournament.finished_at)}</p>}
        <p><strong>{t('label_description')}:</strong> {tournament.description}</p>
      </div>

      {/* Tournament Configuration Section */}
      <div className="tournament-config">
        <h3>{t('tournament_title')} {t('tournament.basic_info') ? '- ' + t('tournament.basic_info') : ''}</h3>
        <div className="config-grid">
          <div className="config-item">
            <strong>{t('label_round_duration')}:</strong> {tournament.round_duration_days} {t('label_days')}
          </div>
          <div className="config-item">
            <strong>{t('label_auto_advance_rounds')}:</strong> {tournament.auto_advance_round ? t('yes') : t('no')}
          </div>
          <div className="config-item">
            <strong>{t('label_general_rounds')}:</strong> {tournament.general_rounds}
          </div>
          <div className="config-item">
            <strong>{t('label_general_rounds_format')}:</strong> {t('match_format.' + tournament.general_rounds_format)}
          </div>
          <div className="config-item">
            <strong>{t('label_final_rounds')}:</strong> {tournament.final_rounds}
          </div>
          <div className="config-item">
            <strong>{t('label_final_rounds_format')}:</strong> {t('match_format.' + tournament.final_rounds_format)}
          </div>
        </div>
      </div>

      {/* Organizer Controls Section */}
      {isCreator && (
        <div className="organizer-controls">
          <h3>{t('tournaments.management')}</h3>
          
          {editMode && tournament.status !== 'in_progress' ? (
            <div className="edit-form">
              <div className="form-group">
                <label>{t('label_description')}</label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label>{t('label_max_participants')}</label>
                <input
                  type="number"
                  min="2"
                  max="256"
                  value={editData.max_participants}
                  onChange={(e) => setEditData({ ...editData, max_participants: parseInt(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>{t('label_tournament_start_date')}</label>
                <input
                  type="datetime-local"
                  value={editData.started_at ? editData.started_at.substring(0, 16) : ''}
                  onChange={(e) => setEditData({ ...editData, started_at: e.target.value })}
                />
              </div>

              <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #ddd' }} />

              <h4 style={{ marginTop: '1rem', marginBottom: '1rem' }}>{t('tournament.round_configuration')}</h4>

              <div className="form-group">
                <label>{t('label_general_rounds')}</label>
                <input
                  type="number"
                  min="0"
                  value={editData.general_rounds}
                  onChange={(e) => setEditData({ ...editData, general_rounds: parseInt(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>{t('tournament.general_rounds_format') || 'General Rounds Format'}</label>
                <select
                  value={editData.general_rounds_format}
                  onChange={(e) => setEditData({ ...editData, general_rounds_format: e.target.value as 'bo1' | 'bo3' | 'bo5' })}
                >
                  <option value="bo1">{t('match_format.bo1')}</option>
                  <option value="bo3">{t('match_format.bo3')}</option>
                  <option value="bo5">{t('match_format.bo5')}</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t('label_final_rounds')}</label>
                <input
                  type="number"
                  min="0"
                  value={editData.final_rounds}
                  onChange={(e) => setEditData({ ...editData, final_rounds: parseInt(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>{t('tournament.final_rounds_format') || 'Final Rounds Format'}</label>
                <select
                  value={editData.final_rounds_format}
                  onChange={(e) => setEditData({ ...editData, final_rounds_format: e.target.value as 'bo1' | 'bo3' | 'bo5' })}
                >
                  <option value="bo1">{t('match_format.bo1')}</option>
                  <option value="bo3">{t('match_format.bo3')}</option>
                  <option value="bo5">{t('match_format.bo5')}</option>
                </select>
              </div>

              <div className="button-group">
                <button onClick={handleSaveChanges} className="btn-save">{t('btn_confirm')}</button>
                <button onClick={() => setEditMode(false)} className="btn-cancel">{t('btn_cancel')}</button>
              </div>
            </div>
          ) : (
            <div className="control-buttons">
              {tournament.status !== 'in_progress' && tournament.status !== 'finished' && (
                <button onClick={() => setEditMode(true)} className="btn-edit">{t('tournament_create')}</button>
              )}

              {tournament.status === 'registration_open' && (
                <button onClick={handleCloseRegistration} className="btn-close-reg">{t('tournaments.btn_close_registration')}</button>
              )}

              {tournament.status === 'registration_closed' && (
                <button onClick={handlePrepareAndStart} className="btn-prepare">{t('tournaments.btn_prepare')}</button>
              )}

              {tournament.status === 'prepared' && (
                <button onClick={handleStartTournament} className="btn-start">{t('tournaments.btn_start')}</button>
              )}

              {tournament.status === 'in_progress' && (
                <p className="tournament-started-message">✓ {t('tournaments.started_locked')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Join button for non-creators (only if logged in) */}
      {!isCreator && tournament.status === 'registration_open' && !userParticipationStatus && userId && (
        <button className="btn-join-tournament" onClick={handleJoinTournament}>
          {t('tournaments.request_join')}
        </button>
      )}

      {userParticipationStatus === 'pending' && (
        <p className="pending-status">⏳ {t('join_pending_msg')}</p>
      )}

      {userParticipationStatus === 'denied' && (
        <p className="denied-status">❌ {t('join_denied_msg')}</p>
      )}

      <div className="tabs-section">
        <button 
          className={`tab-btn ${activeTab === 'participants' ? 'active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          {t('tabs.participants', { count: participants.length })}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          {t('tabs.matches', { count: matches.length })}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'rounds' ? 'active' : ''}`}
          onClick={() => setActiveTab('rounds')}
        >
          {t('tabs.rounds', { count: rounds.length })}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'roundMatches' ? 'active' : ''}`}
          onClick={() => setActiveTab('roundMatches')}
        >
          {t('tabs.round_details')}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'ranking' ? 'active' : ''}`}
          onClick={() => setActiveTab('ranking')}
        >
          {t('tabs.ranking')}
        </button>
      </div>

      {activeTab === 'participants' && (
        <div className="tab-content">
          {participants.length > 0 ? (
            <table className="participants-table">
              <thead>
                <tr>
                  <th>{t('label_nickname')}</th>
                  <th>{t('label_status')}</th>
                  <th>{t('label_elo')}</th>
                  <th>{t('label_classification')}</th>
                  <th>{t('label_wins')}</th>
                  <th>{t('label_losses')}</th>
                  <th>{t('label_points')}</th>
                  {isCreator && <th>{t('label_actions')}</th>}
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
                        {t(`option_${normalizeStatus(p.participation_status)}`) !== `option_${normalizeStatus(p.participation_status)}` ? t(`option_${normalizeStatus(p.participation_status)}`) : (p.participation_status || t('option_pending'))}
                      </span>
                    </td>
                    <td>{p.elo_rating || '-'}</td>
                    <td>
                      <span className="classification-badge">
                        {p.status ? (p.status === 'active' ? '✓ ' + t('label_active') : '✗ ' + t('label_eliminated')) : '-'}
                      </span>
                    </td>
                    <td>{p.tournament_wins}</td>
                    <td>{p.tournament_losses}</td>
                    <td>{p.tournament_points}</td>
                    {isCreator && p.participation_status === 'pending' && (
                      <td>
                        <button 
                          className="btn-accept"
                          onClick={() => handleAcceptParticipant(p.id)}
                        >
                          {t('btn_accept')}
                        </button>
                        <button 
                          className="btn-reject"
                          onClick={() => handleRejectParticipant(p.id)}
                        >
                          {t('btn_reject')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>{t('no_participants_yet')}</p>
          )}
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="tab-content">
          {tournament?.status !== 'in_progress' && tournament?.status !== 'finished' ? (
            <p className="no-matches-message">{t('matches_will_be_generated')}</p>
          ) : (
            <>
              {/* Scheduled Matches Section */}
              <div className="matches-section">
                <h3>{t('matches.scheduled')}</h3>
                {rounds.length > 0 ? (
                  <>
                    {rounds.map((round) => {
                      const roundMatches = matches.filter(
                        (m) => m.round_id === round.id && m.match_status === 'pending'
                      );
                      
                      if (roundMatches.length === 0) return null;
                      
                      return (
                        <div key={round.id} className="round-matches">
                          <h4>
                            {t('label_round')} {round.round_number}
                            {round.round_phase_label && ` [${round.round_phase_label}]`}
                            {round.round_classification && ` (${round.round_classification})`}
                            {' '}-{' '}
                            {t(`option_${normalizeStatus(round.round_status)}`) !== `option_${normalizeStatus(round.round_status)}` ? t(`option_${normalizeStatus(round.round_status)}`) : (round.round_status || t('option_pending'))}
                          </h4>
                          <table className="matches-table">
                            <thead>
                              <tr>
                                <th>{t('label_player1')}</th>
                                <th>{t('vs')}</th>
                                <th>{t('label_player2')}</th>
                                <th>{t('label_play_before')}</th>
                                <th>{t('label_status')}</th>
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
                                  round_status: round.round_status,
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
                                           t('option_pending')}
                                        </span>
                                        {isPlayer && (round.round_status === 'pending' || round.round_status === 'in_progress') && (
                                          <button
                                            className="btn-report-match"
                                            onClick={() => handleOpenReportMatch(match)}
                                            title={t('report_match_link')}
                                          >
                                            {t('report_match_link')}
                                          </button>
                                        )}
                                        {isCreator && (round.round_status === 'completed') && !match.winner_id && (
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
                      <p>{t('no_scheduled_matches')}</p>
                    )}
                  </>
                ) : (
                  <p>{t('no_rounds_configured')}</p>
                )}
              </div>

              {/* Completed Matches Section */}
              <div className="matches-section">
                <h3>{t('matches.completed')}</h3>
                {matches.filter((m) => m.match_status === 'completed').length > 0 ? (
                  <table className="matches-table completed-matches">
                    <thead>
                      <tr>
                        <th>{t('label_round')}</th>
                        <th>{t('label_winner')}</th>
                        <th>{t('label_loser')}</th>
                        <th>{t('label_map')}</th>
                        <th>Status / Actions</th>
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

                          const handleDownloadReplay = async (matchId: string, replayFilePath: string) => {
                            try {
                              const filename = replayFilePath.split('/').pop() || `replay_${matchId}`;
                              const downloadUrl = `/api/matches/${matchId}/replay/download`;
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

                          return (
                            <tr key={match.id}>
                              <td>{t('label_round')} {match.round_number}</td>
                              <td>
                                <div className="player-block">
                                  <div className="first-row">
                                    <strong>{match.winner_nickname || '-'}</strong>
                                  </div>
                                  {match.winner_comments && (
                                    <div className="comments-row winner-comments">
                                      <small>{match.winner_comments}</small>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="player-block">
                                  <div className="first-row">
                                    <strong>{loserNickname}</strong>
                                  </div>
                                  {match.loser_comments && (
                                    <div className="comments-row loser-comments">
                                      <small>{match.loser_comments}</small>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>{match.map || '-'}</td>
                              <td>
                                <div className="status-actions-col">
                                  <div className="status-item">
                                    {isAdminDetermined ? (
                                      <span className="badge-admin">{t('admin_tag')}</span>
                                    ) : confirmationStatus === 'confirmed' ? (
                                      <span className="badge-confirmed">{t('match_status_confirmed')}</span>
                                    ) : confirmationStatus === 'disputed' ? (
                                      <span className="badge-disputed">{t('match_status_disputed')}</span>
                                    ) : (
                                      <span className="badge-unconfirmed">{t('match_status_unconfirmed')}</span>
                                    )}
                                  </div>
                                  <div className="actions-item">
                                    {!isAdminDetermined && match.match_id ? (
                                      <>
                                        <button
                                          className="details-btn"
                                          onClick={() => setMatchDetailsModal({ isOpen: true, match })}
                                          title={t('view_match_details')}
                                        >
                                          {t('details_btn')}
                                        </button>
                                        {match.replay_file_path ? (
                                          <button
                                            className="download-btn"
                                            onClick={() => handleDownloadReplay(match.match_id, match.replay_file_path)}
                                            title={`${t('downloads')}: ${match.replay_downloads || 0}`}
                                          >
                                            ⬇️
                                          </button>
                                        ) : (
                                          <span className="no-replay">{t('no_replay')}</span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="no-link">-</span>
                                    )}
                                    {!isAdminDetermined && isCurrentUserLoser && confirmationStatus === 'unconfirmed' && (
                                      <button
                                        className="btn-confirm-dispute"
                                        onClick={() => handleOpenConfirmModal(match)}
                                      >
                                        {t('confirm_dispute')}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                ) : (
                  <p>{t('no_completed_matches')}</p>
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
                  <th>{t('label_round_number')}</th>
                  <th>{t('label_type')}</th>
                  <th>{t('label_status')}</th>
                  <th>{t('label_start_date')}</th>
                  <th>{t('label_end_date')}</th>
                  <th>{t('label_format')}</th>
                  {isCreator && <th>{t('label_actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => (
                  <tr key={round.id}>
                    <td>
                      <strong>{round.round_number}</strong>
                    </td>
                    <td>{round.round_phase_label || round.round_type || '-'}</td>
                    <td>
                      <span className={`status-badge status-${normalizeStatus(round.round_status)}`}>
                        {t(`option_${normalizeStatus(round.round_status)}`) !== `option_${normalizeStatus(round.round_status)}` ? t(`option_${normalizeStatus(round.round_status)}`) : (round.round_status || t('option_pending'))}
                      </span>
                    </td>
                    <td>{round.round_start_date ? formatDate(round.round_start_date) : '-'}</td>
                    <td>{round.round_end_date ? formatDate(round.round_end_date) : '-'}</td>
                    <td>{(round as any)?.match_format ? t('match_format.' + (round as any).match_format) : '-'}</td>
                    {isCreator && (
                      <td>
                        {round.round_status === 'completed' && round.round_number < rounds.length ? (
                          (() => {
                            const nextRound = rounds.find(r => r.round_number === round.round_number + 1);
                            return nextRound && nextRound.round_status === 'pending' ? (
                              <button
                                className="btn-start-round"
                                onClick={() => handleStartNextRound(round.round_number)}
                                title={t('start_next_round')}
                              >
                                {t('start_round')} {round.round_number + 1}
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
            <p>{t('no_rounds_configured_tournament')}</p>
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
                    <h3>{t('label_round')} {round.round_number} - {round.round_phase_label || round.round_type || 'Round'}</h3>
                    <table className="matches-table">
                      <thead>
                        <tr>
                          <th>{t('label_player1')}</th>
                          <th>{t('vs')}</th>
                          <th>{t('label_player2')}</th>
                          <th>{t('label_winner')}</th>
                          <th>{t('label_status')}</th>
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
                              <span className={`status-badge status-${normalizeStatus((match as any).series_status)}`}>
                                {t(`option_${normalizeStatus((match as any).series_status)}`) !== `option_${normalizeStatus((match as any).series_status)}` ? t(`option_${normalizeStatus((match as any).series_status)}`) : ((match as any).series_status || t('option_pending'))}
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
            <p>{t('no_rounds_configured_tournament')}</p>
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
                  <th>{t('label_rank')}</th>
                  <th>{t('label_nickname')}</th>
                  <th>{t('label_wins')}</th>
                  <th>{t('label_losses')}</th>
                  <th>{t('label_points')}</th>
                  <th>{t('label_status')}</th>
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
                        <span className={`status-badge status-${normalizeStatus(participant.participation_status)}`}>
                          {t(`option_${normalizeStatus(participant.participation_status)}`) !== `option_${normalizeStatus(participant.participation_status)}` ? t(`option_${normalizeStatus(participant.participation_status)}`) : (participant.participation_status || t('option_pending'))}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <p>{t('no_participants_in_tournament')}</p>
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
              <h3>{t('determine_winner_title')}</h3>
              <button
                className="modal-close"
                onClick={() => { setShowDetermineWinnerModal(false); setDetermineWinnerData(null); }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1.5rem', color: '#666' }}>
                {t('determine_winner_prompt', { p1: determineWinnerData.player1_nickname, p2: determineWinnerData.player2_nickname })}
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  className="btn-winner-select"
                  onClick={() => handleDetermineWinner(determineWinnerData.player1_id)}
                  style={{ flex: 1 }}
                >
                  {determineWinnerData.player1_nickname} {t('label_wins')}
                </button>
                <button
                  className="btn-winner-select"
                  onClick={() => handleDetermineWinner(determineWinnerData.player2_id)}
                  style={{ flex: 1 }}
                >
                  {determineWinnerData.player2_nickname} {t('label_wins')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match Details Modal */}
      {matchDetailsModal.isOpen && matchDetailsModal.match && (
        <div className="modal-overlay" onClick={() => setMatchDetailsModal({ isOpen: false, match: null })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('matches.details')}</h2>
              <button className="close-btn" onClick={() => setMatchDetailsModal({ isOpen: false, match: null })}>✕</button>
            </div>

            <div className="modal-body">
              <div className="match-details-container">
                {/* Row 1: Date, Map, Status */}
                <div className="detail-header-row">
                  <div className="detail-item">
                    <label>Date:</label>
                    <span>{matchDetailsModal.match.played_at ? new Date(matchDetailsModal.match.played_at).toLocaleString() : '-'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Map:</label>
                    <span>{matchDetailsModal.match.map || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Status:</label>
                    <span className={`status-badge ${matchDetailsModal.match.match_status_from_matches || 'unconfirmed'}`}>
                      {matchDetailsModal.match.match_status_from_matches === 'confirmed' && '✓ Confirmed'}
                      {matchDetailsModal.match.match_status_from_matches === 'unconfirmed' && '⏳ Unconfirmed'}
                      {matchDetailsModal.match.match_status_from_matches === 'disputed' && '⚠ Disputed'}
                      {matchDetailsModal.match.match_status_from_matches === 'cancelled' && '✗ Cancelled'}
                      {!matchDetailsModal.match.match_status_from_matches && '⏳ Unconfirmed'}
                    </span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="match-stats-grid">
                  <div className="grid-header label-col">Statistic</div>
                  <div className="grid-header winner-col">Winner</div>
                  <div className="grid-header loser-col">Loser</div>

                  <div className="grid-cell label-cell">Player</div>
                  <div className="grid-cell winner-cell">{matchDetailsModal.match.winner_nickname || '-'}</div>
                  <div className="grid-cell loser-cell">{matchDetailsModal.match.winner_nickname === matchDetailsModal.match.player1_nickname ? matchDetailsModal.match.player2_nickname : matchDetailsModal.match.player1_nickname}</div>

                  <div className="grid-cell label-cell">Faction</div>
                  <div className="grid-cell winner-cell"><span className="faction-badge">{matchDetailsModal.match.winner_faction || '-'}</span></div>
                  <div className="grid-cell loser-cell"><span className="faction-badge">{matchDetailsModal.match.loser_faction || '-'}</span></div>

                  {(matchDetailsModal.match.winner_comments || matchDetailsModal.match.loser_comments) && (
                    <>
                      <div className="grid-cell label-cell">Comments</div>
                      <div className="grid-cell winner-cell" title={matchDetailsModal.match.winner_comments || undefined}>{matchDetailsModal.match.winner_comments || '-'}</div>
                      <div className="grid-cell loser-cell" title={matchDetailsModal.match.loser_comments || undefined}>{matchDetailsModal.match.loser_comments || '-'}</div>
                    </>
                  )}

                  {matchDetailsModal.match.replay_file_path && (
                    <>
                      <div className="grid-cell label-cell">Replay</div>
                      <div className="grid-cell winner-cell" style={{ gridColumn: '2 / 4' }}>
                        <button 
                          className="download-btn-compact"
                          onClick={() => {
                            handleDownloadReplay(matchDetailsModal.match!.match_id, matchDetailsModal.match!.replay_file_path);
                            setMatchDetailsModal({ isOpen: false, match: null });
                          }}
                          title={`${t('downloads')}: ${matchDetailsModal.match.replay_downloads || 0}`}
                        >
                          ⬇️ {t('download')} ({matchDetailsModal.match.replay_downloads || 0})
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="close-modal-btn" onClick={() => setMatchDetailsModal({ isOpen: false, match: null })}>{t('close_btn')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetail;

