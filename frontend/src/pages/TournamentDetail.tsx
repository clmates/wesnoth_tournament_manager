import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { publicService, tournamentService, api } from '../services/api';
import TournamentForm from '../components/TournamentForm';
import TournamentMatchReportModal from '../components/TournamentMatchReportModal';
import MatchConfirmationModal from '../components/MatchConfirmationModal';
import MatchDetailsModal from '../components/MatchDetailsModal';
import { TeamJoinModal } from '../components/TeamJoinModal';
import PlayerLink from '../components/PlayerLink';
import StarDisplay from '../components/StarDisplay';

interface Tournament {
  id: string;
  name: string;
  description: string;
  creator_id: string;
  creator_nickname: string;
  status: string;
  tournament_type: string;
  tournament_mode?: 'ranked' | 'unranked' | 'team';
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

interface TournamentFormData {
  name: string;
  description: string;
  tournament_type: string;
  tournament_mode: 'ranked' | 'unranked' | 'team';
  max_participants: number | null;
  round_duration_days: number;
  auto_advance_round: boolean;
  general_rounds: number;
  final_rounds: number;
  general_rounds_format: 'bo1' | 'bo3' | 'bo5';
  final_rounds_format: 'bo1' | 'bo3' | 'bo5';
  started_at?: string;
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
  team_id?: string | null;
  team_position?: number | null;
  omp?: number;
  gwp?: number;
  ogp?: number;
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
  loser_nickname?: string;
  match_status_from_matches?: 'confirmed' | 'disputed' | 'unconfirmed' | 'cancelled' | null;
  winner_faction?: string;
  loser_faction?: string;
  is_team_mode?: boolean;
  map?: string;
  winner_comments?: string;
  loser_comments?: string;
  replay_file_path?: string;
  replay_downloads?: number;
  player1_rating?: number | null;
  player2_rating?: number | null;
  winner_rating?: number | null;
  loser_rating?: number | null;
}

const TournamentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { userId, user } = useAuthStore();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [roundMatches, setRoundMatches] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [unrankedFactions, setUnrankedFactions] = useState<Array<{ id: string; name: string }>>([]);
  const [unrankedMaps, setUnrankedMaps] = useState<Array<{ id: string; name: string }>>([]);
  const [allFactions, setAllFactions] = useState<Array<{ id: string; name: string }>>([]);
  const [allMaps, setAllMaps] = useState<Array<{ id: string; name: string }>>([]);
  const [showTeamJoinModal, setShowTeamJoinModal] = useState(false);
  const [joiningTeamLoading, setJoiningTeamLoading] = useState(false);
  const [matchConfirmationMap, setMatchConfirmationMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'participants' | 'matches' | 'rounds' | 'roundMatches' | 'ranking' | 'teams'>('participants');
  const [userParticipationStatus, setUserParticipationStatus] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [reportMatchData, setReportMatchData] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [confirmMatchData, setConfirmMatchData] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [matchDetailsModal, setMatchDetailsModal] = useState<{ isOpen: boolean; match: TournamentMatch | null }>({ isOpen: false, match: null });
  const [determineWinnerData, setDetermineWinnerData] = useState<any>(null);
  const [showDetermineWinnerModal, setShowDetermineWinnerModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editData, setEditData] = useState<TournamentFormData>({
    name: '',
    description: '',
    tournament_type: 'elimination',
    tournament_mode: 'ranked',
    max_participants: 0,
    round_duration_days: 7,
    auto_advance_round: false,
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
        tournamentService.getTournamentStandings(id!),
        tournamentService.getTournamentMatches(id!),
        tournamentService.getTournamentRoundMatches(id!),
        tournamentService.getTournamentRounds(id!),
      ]);

      setTournament(tournamentRes.data);
      console.log('📋 Tournament loaded:', {
        id: tournamentRes.data.id,
        name: tournamentRes.data.name,
        tournament_type: tournamentRes.data.tournament_type,
        tournament_mode: tournamentRes.data.tournament_mode
      });
      setParticipants(participantsRes.data?.standings || []);
      setMatches(matchesRes.data || []);
      setRoundMatches(roundMaturesRes.data || []);
      setRounds(roundsRes.data || []);
      
      // For team mode, extract user's team_id from standings
      if (tournamentRes.data.tournament_mode === 'team' && userId) {
        const userTeam = (participantsRes.data?.standings || []).find((p: any) => 
          p.member_user_ids && p.member_user_ids.includes(userId)
        );
        if (userTeam) {
          setUserTeamId(userTeam.id);
          console.log('🎯 User team found:', { teamId: userTeam.id, teamName: userTeam.nickname });
        }
      }
      
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
        name: tournamentRes.data.name || '',
        description: tournamentRes.data.description || '',
        tournament_type: tournamentRes.data.tournament_type || 'elimination',
        tournament_mode: tournamentRes.data.tournament_mode || 'ranked',
        max_participants: tournamentRes.data.max_participants || 0,
        round_duration_days: tournamentRes.data.round_duration_days || 7,
        auto_advance_round: tournamentRes.data.auto_advance_round || false,
        started_at: tournamentRes.data.started_at || '',
        general_rounds: tournamentRes.data.general_rounds || 0,
        final_rounds: tournamentRes.data.final_rounds || 0,
        general_rounds_format: tournamentRes.data.general_rounds_format || 'bo3',
        final_rounds_format: tournamentRes.data.final_rounds_format || 'bo5'
      });
      
      // Check user's participation status
      if (userId) {
        const userParticipant = participantsRes.data?.standings?.find((p: TournamentParticipant) => p.user_id === userId);
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
    console.log('🔍 handleJoinTournament called with tournament_mode:', tournament?.tournament_mode);
    console.log('📋 Full tournament object:', tournament);
    
    if (tournament?.tournament_mode === 'team') {
      // Show team join modal for team tournaments
      console.log('✅ Showing team join modal for team tournament');
      setShowTeamJoinModal(true);
    } else {
      // Direct join for ranked/unranked tournaments
      console.log('❌ Direct join (not team mode)');
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
    }
  };

  // Fetch tournament assets for all modes
  useEffect(() => {
    if (tournament && id) {
      const fetchAssets = async () => {
        try {
          // Fetch selected assets for this tournament
          const selectedRes = await publicService.getTournamentUnrankedAssets(id);
          if (selectedRes.data.success) {
            console.log('Tournament assets loaded:', {
              factions: selectedRes.data.data.factions,
              maps: selectedRes.data.data.maps
            });
            setUnrankedFactions(selectedRes.data.data.factions || []);
            setUnrankedMaps(selectedRes.data.data.maps || []);
          }
        } catch (err) {
          console.error('Error fetching tournament assets:', err);
        }
      };
      fetchAssets();
    }
  }, [tournament?.id, id]);

  // Fetch ALL available assets only in edit mode
  useEffect(() => {
    if (editMode && tournament) {
      const fetchAllAssets = async () => {
        try {
          console.log('📥 Fetching assets for edit mode. Tournament mode:', tournament.tournament_mode);
          
          if (tournament.tournament_mode === 'ranked') {
            // For ranked tournaments, fetch only ranked assets
            const factionsRes = await api.get('/public/factions?is_ranked=true');
            const mapsRes = await api.get('/public/maps?is_ranked=true');
            console.log('✅ Ranked - Factions:', factionsRes.data.length, 'Maps:', mapsRes.data.length);
            setAllFactions(factionsRes.data || []);
            setAllMaps(mapsRes.data || []);
          } else if (tournament.tournament_mode === 'unranked' || tournament.tournament_mode === 'team') {
            // For unranked/team tournaments, fetch ALL assets (so organizer can choose which to allow)
            const factionsRes = await api.get('/admin/unranked-factions');
            const mapsRes = await api.get('/admin/unranked-maps');
            console.log('🔵 Unranked/Team - ALL Factions:', factionsRes.data.data?.length, 'ALL Maps:', mapsRes.data.data?.length);
            setAllFactions(factionsRes.data.data || []);
            setAllMaps(mapsRes.data.data || []);
          }
        } catch (err) {
          console.error('❌ Error fetching available assets:', err);
        }
      };
      fetchAllAssets();
    }
  }, [editMode, tournament?.id, tournament?.tournament_mode]);

  const handleTeamJoinSubmit = async (teamName: string, teammateName: string) => {
    try {
      setJoiningTeamLoading(true);
      setError('');
      
      await tournamentService.requestJoinTournament(id!, {
        team_name: teamName,
        teammate_name: teammateName
      });
      
      setSuccess(t('success_join_request_sent'));
      setUserParticipationStatus('pending');
      setShowTeamJoinModal(false);
      
      // Refresh the page after 2 seconds
      setTimeout(() => {
        fetchTournamentData();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_failed_join_tournament'));
    } finally {
      setJoiningTeamLoading(false);
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
    // First call without confirmation
    const response = await tournamentService.closeRegistration(id!);
    
    if (response.data?.requiresConfirmation) {
      // Show confirmation modal
      setShowDeleteConfirmModal(true);
    } else if (response.data?.action === 'closed') {
      // Tournament registration closed normally (had participants)
      setSuccess(t('success_registration_closed'));
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    }
  } catch (err: any) {
    setError(err.response?.data?.error || t('error_failed_close_registration'));
  }
};

const handleConfirmDelete = async () => {
  try {
    // Second call with confirmation
    const response = await tournamentService.closeRegistration(id!, true);
    
    if (response.data?.action === 'deleted') {
      setSuccess(t('tournaments.tournament_deleted_no_participants'));
      setShowDeleteConfirmModal(false);
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/my-tournaments');
      }, 2000);
    }
  } catch (err: any) {
    setError(err.response?.data?.error || t('error_failed_close_registration'));
    setShowDeleteConfirmModal(false);
  }
};

const handleDownloadReplay = async (matchId: string | null, replayFilePath: string | null | undefined) => {
  try {
    if (!matchId || !replayFilePath) return;
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

  const handlePrepareAndStart = async () => {
    try {
      // Save edit data first if any changes (but exclude started_at if empty)
      if (editData.description !== tournament?.description || 
          editData.max_participants !== tournament?.max_participants ||
          editData.general_rounds !== tournament?.general_rounds ||
          editData.final_rounds !== tournament?.final_rounds ||
          editData.general_rounds_format !== tournament?.general_rounds_format ||
          editData.final_rounds_format !== tournament?.final_rounds_format) {
        // Build update object, excluding started_at if empty
        const updateObj: any = {
          description: editData.description,
          max_participants: editData.max_participants,
          general_rounds: editData.general_rounds,
          final_rounds: editData.final_rounds,
          general_rounds_format: editData.general_rounds_format,
          final_rounds_format: editData.final_rounds_format
        };
        if (editData.started_at) {
          updateObj.started_at = editData.started_at;
        }
        await tournamentService.updateTournament(id!, updateObj);
      }
      
      // Call backend to prepare tournament (create rounds based on type and configuration)
      await tournamentService.prepareTournament(id!);
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
      // Build update object, excluding started_at if empty
      const updateObj: any = {
        description: editData.description,
        max_participants: editData.max_participants,
        general_rounds: editData.general_rounds,
        final_rounds: editData.final_rounds,
        general_rounds_format: editData.general_rounds_format,
        final_rounds_format: editData.final_rounds_format
      };
      if (editData.started_at) {
        updateObj.started_at = editData.started_at;
      }
      
      // Save tournament configuration
      await tournamentService.updateTournament(id!, updateObj);

      // Save assets if tournament mode is unranked or team
      if ((tournament?.tournament_mode === 'unranked' || tournament?.tournament_mode === 'team') && 
          (unrankedFactions.length > 0 || unrankedMaps.length > 0)) {
        try {
          await api.put(`/admin/tournaments/${id}/unranked-assets`, {
            faction_ids: unrankedFactions.map(f => f.id),
            map_ids: unrankedMaps.map(m => m.id)
          });
        } catch (assetErr) {
          console.error('Error updating assets:', assetErr);
          // Don't fail the whole operation if asset update fails
        }
      }

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

  const handleConfirmParticipation = async (participantId: string) => {
    try {
      await tournamentService.confirmParticipation(id!, participantId);
      setSuccess(t('success_participation_confirmed') || 'Participation confirmed!');
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_failed_confirm_participation') || 'Failed to confirm participation');
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
      // For Swiss/Swiss-Elimination tournaments in general phase, calculate tiebreakers first
      if (tournament && (tournament.tournament_type === 'swiss' || tournament.tournament_type === 'swiss_elimination')) {
        // Check if we're in general phase (not final elimination phase)
        const currentRound = rounds.find(r => r.round_number === currentRoundNumber);
        if (currentRound && currentRound.round_type === 'general') {
          console.log('🎲 Calculating tiebreakers before generating Swiss pairings...');
          await api.post(`/admin/tournaments/${id}/calculate-tiebreakers`);
          console.log('✅ Tiebreakers calculated');
        }
      }

      await tournamentService.startNextRound(id!);

      setSuccess(t('success_round_started', { number: currentRoundNumber + 1 }));
      fetchTournamentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || t('error_failed_start_next_round'));
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
      'unconfirmed': '#2196F3',
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

  const getModeLabel = (mode?: string) => {
    switch (mode) {
      case 'ranked':
        return 'Ranked (1v1)';
      case 'unranked':
        return 'Unranked (1v1)';
      case 'team':
        return 'Team (2v2)';
      default:
        return mode || 'Unknown';
    }
  };

  const isCreator = userId === tournament?.creator_id;
  const isAcceptedParticipant = userParticipationStatus === 'accepted';

  if (loading) {
    return <div className="w-full min-h-screen px-4 py-8 bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200"><p>{t('loading')}</p></div>;
  }

  if (!tournament) {
    return (
      <div className="w-full min-h-screen px-4 py-8 bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200">
        <p>{error || t('tournament_title')}</p>
        <button onClick={() => navigate('/tournaments')}>{t('tournaments.back_to_tournaments')}</button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen px-4 py-8 bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200">
      <div className="flex justify-between items-center mb-8 pb-4 border-b-2 border-gray-300">
        <button onClick={handleBackButton} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">← {t('tournaments.back_to_tournaments')}</button>
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold text-gray-800">{tournament.name}</h1>
          <span 
            className="inline-block px-3 py-1 text-white rounded-full text-xs font-semibold"
            style={{ backgroundColor: getStatusColor(tournament.status) }}
          >
            {t(`option_${normalizeStatus(tournament.status)}`) !== `option_${normalizeStatus(tournament.status)}` ? t(`option_${normalizeStatus(tournament.status)}`) : (tournament.status || t('option_pending'))}
          </span>
        </div>
      </div>

      {error && <p className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6">{error}</p>}
      {success && <p className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded mb-6">{success}</p>}

      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <p><strong>{t('tournament.col_organizer')}:</strong> <PlayerLink nickname={tournament.creator_nickname} userId={tournament.creator_id} /></p>
        <p><strong>{t('tournament.col_type')}:</strong> {tournament.tournament_type}</p>
        <p><strong>{t('tournament.mode', 'Tournament Mode')}:</strong> {getModeLabel(tournament.tournament_mode)}</p>
        <p><strong>{t('label_max_participants')}:</strong> {tournament.max_participants || t('unlimited')}</p>
        <p><strong>{t('label_created')}:</strong> {formatDate(tournament.created_at)}</p>
        {tournament.started_at && <p><strong>{t('label_started')}:</strong> {formatDate(tournament.started_at)}</p>}
        {tournament.finished_at && <p><strong>{t('label_finished')}:</strong> {formatDate(tournament.finished_at)}</p>}
        <p><strong>{t('label_description')}:</strong> {tournament.description}</p>
      </div>

      {/* Tournament Assets Section */}
      {(unrankedFactions.length > 0 || unrankedMaps.length > 0) && (
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h3>{t('tournament.unranked_assets', 'Tournament Assets')}</h3>
          
          <div className="flex flex-col gap-6">
            {unrankedFactions.length > 0 && (
              <div className="flex flex-col gap-3">
                <h4 className="text-lg font-semibold text-gray-800">{t('tournament.allowed_factions', 'Allowed Factions')}</h4>
                <div className="flex flex-wrap gap-2">
                  {unrankedFactions.map((faction) => (
                    <span key={faction.id} className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">{faction.name}</span>
                  ))}
                </div>
              </div>
            )}

            {unrankedMaps.length > 0 && (
              <div className="flex flex-col gap-3">
                <h4 className="text-lg font-semibold text-gray-800">{t('tournament.allowed_maps', 'Allowed Maps')}</h4>
                <div className="flex flex-wrap gap-2">
                  {unrankedMaps.map((map) => (
                    <span key={map.id} className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">{map.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tournament Configuration Section */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <h3>{t('tournament_title')} {t('tournament.basic_info') ? '- ' + t('tournament.basic_info') : ''}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <strong className="font-semibold text-gray-700">{t('label_round_duration')}:</strong> <span className="text-gray-600">{tournament.round_duration_days} {t('label_days')}</span>
          </div>
          <div className="flex flex-col gap-2">
            <strong className="font-semibold text-gray-700">{t('label_auto_advance_rounds')}:</strong> <span className="text-gray-600">{tournament.auto_advance_round ? t('yes') : t('no')}</span>
          </div>

          {/* For swiss_elimination tournaments, show structured information */}
          {tournament.tournament_type === 'swiss_elimination' ? (
            <>
              <div className="flex flex-col gap-2">
                <strong className="font-semibold text-gray-700">{t('tournament.number_swiss_rounds', 'Swiss Rounds')}:</strong> <span className="text-gray-600">{tournament.general_rounds}</span>
              </div>
              <div className="flex flex-col gap-2">
                <strong className="font-semibold text-gray-700">{t('tournament.number_elimination_rounds', 'Elimination Rounds')}:</strong> <span className="text-gray-600">{tournament.final_rounds}</span>
              </div>
              <div className="flex flex-col gap-2">
                <strong className="font-semibold text-gray-700">{t('tournament.general_format', 'General Format (Swiss + Elimination except Final)')}:</strong> <span className="text-gray-600">{t('match_format.' + tournament.general_rounds_format)}</span>
              </div>
              <div className="flex flex-col gap-2">
                <strong className="font-semibold text-gray-700">{t('tournament.final_format', 'Final Format (Grand Final)')}:</strong> <span className="text-gray-600">{t('match_format.' + tournament.final_rounds_format)}</span>
              </div>
              <div className="flex flex-col gap-2" style={{ gridColumn: '1 / -1' }}>
                <strong className="font-semibold text-gray-700">{t('tournament.tournament_structure', 'Tournament Structure')}:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  <li>{t('tournament.swiss_phase', 'Swiss Phase')}: {tournament.general_rounds} {t('tournament.rounds', 'rounds')} ({t('match_format.' + tournament.general_rounds_format)})</li>
                  {tournament.final_rounds > 1 && (
                    <li>{t('tournament.qualification_phase', 'Qualification Phase')}: {tournament.final_rounds - 1} {t('tournament.rounds', 'rounds')} ({t('match_format.' + tournament.general_rounds_format)})</li>
                  )}
                  <li>{t('tournament.grand_final', 'Grand Final')}: 1 {t('tournament.round', 'round')} ({t('match_format.' + tournament.final_rounds_format)})</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* For other tournament types, show standard fields */}
              <div className="flex flex-col gap-2">
                <strong className="font-semibold text-gray-700">{t('label_general_rounds')}:</strong> <span className="text-gray-600">{tournament.general_rounds}</span>
              </div>
              <div className="flex flex-col gap-2">
                <strong className="font-semibold text-gray-700">{t('label_general_rounds_format')}:</strong> <span className="text-gray-600">{t('match_format.' + tournament.general_rounds_format)}</span>
              </div>
              {tournament.final_rounds > 0 && (
                <>
                  <div className="flex flex-col gap-2">
                    <strong className="font-semibold text-gray-700">{t('label_final_rounds')}:</strong> <span className="text-gray-600">{tournament.final_rounds}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <strong className="font-semibold text-gray-700">{t('label_final_rounds_format')}:</strong> <span className="text-gray-600">{t('match_format.' + tournament.final_rounds_format)}</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Organizer Controls Section */}
      {isCreator && (
        <div>
          <h3>{t('tournaments.management')}</h3>
          
          {editMode && tournament.status !== 'in_progress' ? (
            <TournamentForm 
              mode="edit"
              formData={editData}
              onFormDataChange={setEditData}
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveChanges();
              }}
              unrankedFactions={unrankedFactions.map(f => f.id)}
              onUnrankedFactionsChange={(factionIds: string[]) => {
                // Convert selected IDs back to objects by filtering allFactions
                const selected = allFactions.filter(f => factionIds.includes(f.id));
                setUnrankedFactions(selected);
              }}
              unrankedMaps={unrankedMaps.map(m => m.id)}
              onUnrankedMapsChange={(mapIds: string[]) => {
                // Convert selected IDs back to objects by filtering allMaps
                const selected = allMaps.filter(m => mapIds.includes(m.id));
                setUnrankedMaps(selected);
              }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {tournament.status !== 'prepared' && tournament.status !== 'in_progress' && tournament.status !== 'finished' && (
                <button onClick={() => setEditMode(true)} className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">{t('btn_edit', 'Edit')}</button>
              )}

              {tournament.status === 'registration_open' && (
                <button onClick={handleCloseRegistration} className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">{t('tournaments.btn_close_registration')}</button>
              )}

              {tournament.status === 'registration_closed' && (
                <button onClick={handlePrepareAndStart} className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">{t('tournaments.btn_prepare')}</button>
              )}

              {tournament.status === 'prepared' && (
                <button onClick={handleStartTournament} className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">{t('tournaments.btn_start')}</button>
              )}

              {tournament.status === 'in_progress' && (
                <p className="text-green-600">✓ {t('tournaments.started_locked')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Join button for non-creators (only if logged in) */}
      {!isCreator && tournament.status === 'registration_open' && !userParticipationStatus && userId && (
        <button className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors" onClick={handleJoinTournament}>
          {t('tournaments.request_join')}
        </button>
      )}

      {userParticipationStatus === 'pending' && (
        <p className="text-orange-600">⏳ {t('join_pending_msg')}</p>
      )}

      {userParticipationStatus === 'denied' && (
        <p className="text-red-600">❌ {t('join_denied_msg')}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-8 mb-6">
        <button 
          className={`px-4 py-2 rounded font-semibold cursor-pointer transition-all ${activeTab === 'participants' ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
          onClick={() => setActiveTab('participants')}
        >
          {tournament?.tournament_mode === 'team' ? 'Teams' : t('tabs.participants', { count: participants.length })}
        </button>
        <button 
          className={`px-4 py-2 rounded font-semibold cursor-pointer transition-all ${activeTab === 'matches' ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
          onClick={() => setActiveTab('matches')}
        >
          {t('tabs.matches', { count: matches.length })}
        </button>
        <button 
          className={`px-4 py-2 rounded font-semibold cursor-pointer transition-all ${activeTab === 'rounds' ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
          onClick={() => setActiveTab('rounds')}
        >
          {t('tabs.rounds', { count: rounds.length })}
        </button>
        <button 
          className={`px-4 py-2 rounded font-semibold cursor-pointer transition-all ${activeTab === 'roundMatches' ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
          onClick={() => setActiveTab('roundMatches')}
        >
          {t('tabs.round_details')}
        </button>
        <button 
          className={`px-4 py-2 rounded font-semibold cursor-pointer transition-all ${activeTab === 'ranking' ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
          onClick={() => setActiveTab('ranking')}
        >
          {t('tabs.ranking')}
        </button>
      </div>

      {activeTab === 'participants' && (
        <div className="mb-8 mt-6">
          {tournament?.tournament_mode === 'team' ? (
            // Team view: Group participants by team from standings (which has team_total_elo and members_with_elo)
            participants.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {participants.map((team: any) => (
                  <div key={team.id} className="border-2 border-blue-400 rounded-lg p-6 bg-gray-50 shadow hover:shadow-lg transition-all hover:-translate-y-1">
                    <div className="flex justify-between items-start gap-6 mb-4 pb-3 border-b-2 border-blue-400 flex-wrap">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-semibold text-gray-800">
                          {team.nickname}
                        </h3>
                        <span className="text-sm text-gray-600">({team.team_size}/2 members)</span>
                        {team.team_total_elo && (
                          <div className="text-sm text-gray-700 mt-2">
                            <strong>Total ELO:</strong> {team.team_total_elo}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-6 items-center flex-wrap">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-600 font-semibold uppercase tracking-wider">{t('label_wins')}</span>
                          <span className="text-lg font-semibold text-gray-800">{team.tournament_wins || 0}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-600 font-semibold uppercase tracking-wider">{t('label_losses')}</span>
                          <span className="text-lg font-semibold text-gray-800">{team.tournament_losses || 0}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-600 font-semibold uppercase tracking-wider">{t('label_points')}</span>
                          <span className="text-lg font-semibold text-gray-800">{team.tournament_points || 0}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-600 font-semibold uppercase tracking-wider">{t('label_status')}</span>
                          <span 
                            className="inline-block px-2 py-1 text-white rounded-full text-xs font-semibold"
                            style={{ 
                              backgroundColor: team.status === 'eliminated' ? '#dc3545' : '#28a745'
                            }}
                          >
                            {team.status === 'eliminated' ? 'Eliminated' : 'Active'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {team.members_with_elo && team.members_with_elo.length > 0 ? (
                      <table className="w-full text-sm mt-4">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_nickname')}</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_elo')}</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">Position</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_status')}</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {team.members_with_elo.map((member: any) => (
                            <tr key={member.user_id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-700"><PlayerLink nickname={member.nickname} userId={member.user_id} /></td>
                              <td className="px-4 py-3 text-gray-700">{member.elo_rating || '-'}</td>
                              <td className="px-4 py-3 text-gray-700">{member.team_position || '-'}</td>
                              <td className="px-4 py-3 text-gray-700">
                                <span
                                  className="inline-block px-3 py-1 text-white rounded-full text-xs font-semibold"
                                  style={{ backgroundColor: getParticipationStatusColor(member.participation_status || 'pending') }}
                                >
                                  {member.participation_status === 'unconfirmed' ? 'Unconfirmed' :
                                   member.participation_status === 'pending' ? 'Pending' :
                                   member.participation_status === 'accepted' ? 'Accepted' : 'Pending'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                <div className="flex gap-2 flex-wrap">
                                  {member.participation_status === 'unconfirmed' && member.user_id === userId && (
                                    <button
                                      className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                                      onClick={() => handleConfirmParticipation(member.participant_id)}
                                      title="Confirm your participation"
                                    >
                                      {t('btn_confirm') || 'Confirm'}
                                    </button>
                                  )}
                                  {isCreator && member.participation_status === 'pending' && (
                                    <>
                                      <button
                                        className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                                        onClick={() => handleAcceptParticipant(member.participant_id)}
                                        title={t('btn_accept')}
                                      >
                                        {t('btn_accept')}
                                      </button>
                                      <button
                                        className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                                        onClick={() => handleRejectParticipant(member.participant_id)}
                                        title={t('btn_reject')}
                                      >
                                        {t('btn_reject')}
                                      </button>
                                    </>
                                  )}
                                  {isCreator && member.participation_status === 'unconfirmed' && (
                                    <span title="Awaiting player confirmation" className="text-sm text-gray-600">
                                      Awaiting confirmation
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-gray-600 text-center py-4">No members</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">{t('no_participants_yet')}</p>
            )
          ) : (
            // Individual view for ranked/unranked
            participants.length > 0 ? (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_nickname')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_status')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_elo')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_classification')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_wins')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_losses')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_points')}</th>
                    {isCreator && <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700"><PlayerLink nickname={p.nickname} userId={p.id} /></td>
                      <td className="px-4 py-3 text-gray-700">
                        <span 
                          className="inline-block px-3 py-1 text-white rounded-full text-xs font-semibold"
                          style={{ backgroundColor: getParticipationStatusColor(p.participation_status) }}
                        >
                          {t(`option_${normalizeStatus(p.participation_status)}`) !== `option_${normalizeStatus(p.participation_status)}` ? t(`option_${normalizeStatus(p.participation_status)}`) : (p.participation_status || t('option_pending'))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.elo_rating || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs">
                          {p.status ? (p.status === 'active' ? '✓ ' + t('label_active') : '✗ ' + t('label_eliminated')) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.tournament_wins}</td>
                      <td className="px-4 py-3 text-gray-700">{p.tournament_losses}</td>
                      <td className="px-4 py-3 text-gray-700">{p.tournament_points}</td>
                      {isCreator && p.participation_status === 'pending' && (
                      <td className="px-4 py-3 text-gray-700">
                        <button 
                          className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors mr-2"
                          onClick={() => handleAcceptParticipant(p.id)}
                        >
                          {t('btn_accept')}
                        </button>
                        <button 
                          className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
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
              </div>
            ) : (
              <p className="text-gray-600">{t('no_participants_yet')}</p>
            )
          )}
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 mt-6">
          {tournament?.status !== 'in_progress' && tournament?.status !== 'finished' ? (
            <p className="bg-gray-100 text-gray-700 text-center py-8 px-4 rounded">{t('matches_will_be_generated')}</p>
          ) : (
          <>
            {/* Scheduled Matches Section */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-blue-500">{t('matches.scheduled')}</h3>
              {rounds.length > 0 ? (
                  <>
                    {rounds.map((round) => {
                      const roundMatches = matches.filter(
                        (m) => m.round_id === round.id && m.match_status === 'pending'
                      );
                      
                      if (roundMatches.length === 0) return null;
                      
                      return (
                        <div key={round.id} className="mb-6 p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                          <h4 className="text-lg font-semibold text-gray-800 mb-4 uppercase tracking-wide">
                            {t('label_round')} {round.round_number}
                            {round.round_phase_label && ` [${round.round_phase_label}]`}
                            {round.round_classification && ` (${round.round_classification})`}
                            {' '}-{' '}
                            {t(`option_${normalizeStatus(round.round_status)}`) !== `option_${normalizeStatus(round.round_status)}` ? t(`option_${normalizeStatus(round.round_status)}`) : (round.round_status || t('option_pending'))}
                          </h4>
                          <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-200">
                              <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">{roundMatches.length > 0 && roundMatches[0].is_team_mode ? t('label_team1') : t('label_player1')}</th>
                                <th className="px-4 py-3 text-center font-semibold text-gray-700">vs</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">{roundMatches.length > 0 && roundMatches[0].is_team_mode ? t('label_team2') : t('label_player2')}</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('label_play_before')}</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('label_status')}</th>
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

                                // Check if current user is one of the players/teams
                                let isPlayer = false;
                                if (match.is_team_mode) {
                                  // Team mode: compare user's team_id against match player1_id and player2_id
                                  isPlayer = userTeamId === match.player1_id || userTeamId === match.player2_id;
                                } else {
                                  // 1v1 mode: compare user_id directly
                                  isPlayer = userId === match.player1_id || userId === match.player2_id;
                                }

                                console.log('Match Debug:', {
                                  matchId: match.id,
                                  player1_id: match.player1_id,
                                  player2_id: match.player2_id,
                                  userId: userId,
                                  isPlayer: isPlayer,
                                  match_status: match.match_status,
                                  round_status: round.round_status,
                                  is_team_mode: match.is_team_mode
                                });
                                
                                return (
                                  <tr key={match.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-gray-700">
                                      <div className="flex items-center gap-2">
                                        <strong>{match.is_team_mode ? match.player1_nickname : <PlayerLink nickname={match.player1_nickname} userId={match.player1_id} />}</strong>
                                        <StarDisplay rating={match.player1_rating} size="sm" />
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">vs</td>
                                    <td className="px-4 py-3 text-gray-700">
                                      <div className="flex items-center gap-2">
                                        <strong>{match.is_team_mode ? match.player2_nickname : <PlayerLink nickname={match.player2_nickname} userId={match.player2_id} />}</strong>
                                        <StarDisplay rating={match.player2_rating} size="sm" />
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{playBeforeDate}</td>
                                    <td className="px-4 py-3 text-gray-700">
                                      <div className="flex gap-2 items-center flex-wrap">
                                        <span className="inline-block px-3 py-1 text-white rounded-full text-xs font-semibold" style={{ backgroundColor: '#FFC107' }}>
                                          {match.match_status_from_matches === 'confirmed' ? t('match_status_confirmed') :
                                           match.match_status_from_matches === 'disputed' ? t('match_status_disputed') :
                                           match.match_status_from_matches === 'unconfirmed' ? t('match_status_unconfirmed') :
                                           match.match_status_from_matches === 'cancelled' ? t('match_status_cancelled') :
                                           t('option_pending')}
                                        </span>
                                        {isPlayer && (round.round_status === 'pending' || round.round_status === 'in_progress') && (
                                          <button
                                            className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                                            onClick={() => handleOpenReportMatch(match)}
                                            title={t('report_match_link')}
                                          >
                                            {t('report_match_link')}
                                          </button>
                                        )}
                                        {isCreator && (round.round_status === 'completed' || round.round_status === 'in_progress') && !match.winner_id && (
                                          <button
                                            className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
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
                        </div>
                      );
                    })}
                    {matches.filter((m) => m.match_status === 'pending').length === 0 && (
                      <p className="text-gray-600">{t('no_scheduled_matches')}</p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-600">{t('no_rounds_configured')}</p>
                )}
              </div>

              {/* Completed Matches Section */}
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-blue-500">{t('matches.completed')}</h3>
                {matches.filter((m) => m.match_status === 'completed').length > 0 ? (
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('label_round')}</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('label_winner')}</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('label_loser')}</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">{tournament?.tournament_mode === 'unranked' ? `${t('label_map')} / Factions` : t('label_map')}</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status / Actions</th>
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
                          const winnerId = match.winner_nickname === match.player1_nickname 
                            ? match.player1_id 
                            : match.player2_id;
                          
                          // Determine if current user is the loser (for team mode, check team_id)
                          let isCurrentUserLoser = false;
                          if (match.is_team_mode) {
                            isCurrentUserLoser = userTeamId === loserId;
                          } else {
                            isCurrentUserLoser = userId === loserId;
                          }
                          
                          // If no match_id and status is pending, it was determined by admin, show "ADMIN" status
                          const isAdminDetermined = !match.match_id && match.match_status === 'pending';
                          const hasReportedMatch = match.match_id || (['unranked', 'team'].includes(tournament?.tournament_mode) && match.match_status === 'completed');
                          // Use match_status_from_matches from the matches table (confirmed, disputed, unconfirmed, cancelled)
                          const confirmationStatus = isAdminDetermined ? 'admin' : (match.match_status_from_matches || 'unconfirmed');

                          return (
                            <tr key={match.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-700">{t('label_round')} {match.round_number}</td>
                              <td className="px-4 py-3 text-gray-700">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <strong className="text-green-600">{match.is_team_mode ? match.winner_nickname : <PlayerLink nickname={match.winner_nickname || '-'} userId={winnerId} />}</strong>
                                    <StarDisplay rating={match.winner_rating} size="sm" />
                                  </div>
                                  {match.winner_comments && (
                                    <div className="text-xs text-gray-600 italic">
                                      {match.winner_comments}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <strong className="text-red-600">{match.is_team_mode ? loserNickname : <PlayerLink nickname={loserNickname} userId={loserId} />}</strong>
                                    <StarDisplay rating={match.loser_rating} size="sm" />
                                  </div>
                                  {match.loser_comments && (
                                    <div className="text-xs text-gray-600 italic">
                                      {match.loser_comments}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                <div className="flex flex-col gap-1">
                                  <span>{match.map || '-'}</span>
                                  {tournament?.tournament_mode === 'unranked' && !match.is_team_mode && (match.winner_faction || match.loser_faction) && (
                                    <span className="text-xs text-gray-600">
                                      {match.winner_faction || '-'} vs {match.loser_faction || '-'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                <div className="flex flex-col gap-2">
                                  <div>
                                    {isAdminDetermined ? (
                                      <span className="inline-block px-3 py-1 text-white rounded-full text-xs font-semibold bg-purple-500">{t('admin_tag')}</span>
                                    ) : confirmationStatus === 'confirmed' ? (
                                      <span className="inline-block px-3 py-1 text-white rounded-full text-xs font-semibold bg-green-500">{t('match_status_confirmed')}</span>
                                    ) : confirmationStatus === 'disputed' ? (
                                      <span className="inline-block px-3 py-1 text-white rounded-full text-xs font-semibold bg-orange-500">{t('match_status_disputed')}</span>
                                    ) : (
                                      <span className="inline-block px-3 py-1 text-white rounded-full text-xs font-semibold bg-gray-400">{t('match_status_unconfirmed')}</span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {hasReportedMatch ? (
                                      <>
                                        <button
                                          className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                                          onClick={() => setMatchDetailsModal({ isOpen: true, match })}
                                          title={t('view_match_details')}
                                        >
                                          {t('details_btn')}
                                        </button>
                                        {match.replay_file_path ? (
                                          <button
                                            className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                                            onClick={() => handleDownloadReplay(match.match_id, match.replay_file_path)}
                                            title={`${t('downloads')}: ${match.replay_downloads || 0}`}
                                          >
                                            ⬇️
                                          </button>
                                        ) : (
                                          <span className="text-xs text-gray-500">{t('no_replay')}</span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-xs text-gray-500">-</span>
                                    )}
                                    {!isAdminDetermined && isCurrentUserLoser && confirmationStatus === 'unconfirmed' && (
                                      <button
                                        className="px-2 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded transition-colors"
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
                  </div>
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
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 mt-6 overflow-x-auto">
          {rounds.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_round_number')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_type')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_status')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_start_date')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_end_date')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_format')}</th>
                  {isCreator && <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => (
                  <tr key={round.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700">
                      <strong>{round.round_number}</strong>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{round.round_phase_label || round.round_type || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="inline-block px-3 py-1 text-white rounded-full text-xs font-semibold" style={{ backgroundColor: getStatusColor(round.round_status) }}>
                        {t(`option_${normalizeStatus(round.round_status)}`) !== `option_${normalizeStatus(round.round_status)}` ? t(`option_${normalizeStatus(round.round_status)}`) : (round.round_status || t('option_pending'))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{round.round_start_date ? formatDate(round.round_start_date) : '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{round.round_end_date ? formatDate(round.round_end_date) : '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{(round as any)?.match_format ? t('match_format.' + (round as any).match_format) : '-'}</td>
                    {isCreator && (
                      <td className="px-4 py-3 text-gray-700">
                        {round.round_status === 'completed' && round.round_number < rounds.length ? (
                          (() => {
                            const nextRound = rounds.find(r => r.round_number === round.round_number + 1);
                            return nextRound && nextRound.round_status === 'pending' ? (
                              <button
                                className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                                onClick={() => handleStartNextRound(round.round_number)}
                                title={t('start_next_round')}
                              >
                                {t('start_round')} {round.round_number + 1}
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            );
                          })()
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-600">{t('no_rounds_configured_tournament')}</p>
          )}
        </div>
      )}

      {/* Round Matches Section */}
      {activeTab === 'roundMatches' && (
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 mt-6 overflow-x-auto">
          {rounds.length > 0 ? (
            <>
              {rounds.map((round) => {
                const matchesInRound = roundMatches.filter((m) => m.round_id === round.id);
                
                if (matchesInRound.length === 0) return null;
                
                return (
                  <div key={round.id} className="mb-8">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-gray-300">{t('label_round')} {round.round_number} - {round.round_phase_label || round.round_type || 'Round'}</h3>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{matchesInRound.length > 0 && matchesInRound[0].is_team_mode ? t('label_team1') : t('label_player1')}</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('vs')}</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{matchesInRound.length > 0 && matchesInRound[0].is_team_mode ? t('label_team2') : t('label_player2')}</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_winner')}</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchesInRound.map((match) => (
                          <tr key={match.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-700">
                              <div>
                                <strong>{match.is_team_mode ? match.player1_nickname : <PlayerLink nickname={match.player1_nickname} userId={match.player1_id} />}</strong>
                              </div>
                              {(match as any).player1_wins !== undefined && (
                                <span className="text-gray-600 text-sm">
                                  {' '}({(match as any).player1_wins})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700">vs</td>
                            <td className="px-4 py-3 text-gray-700">
                              <div>
                                <strong>{match.is_team_mode ? match.player2_nickname : <PlayerLink nickname={match.player2_nickname} userId={match.player2_id} />}</strong>
                              </div>
                              {(match as any).player2_wins !== undefined && (
                                <span className="text-gray-600 text-sm">
                                  {' '}({(match as any).player2_wins})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {match.winner_id === match.player1_id ? (
                                <strong className="text-green-600">{match.is_team_mode ? match.player1_nickname : <PlayerLink nickname={match.player1_nickname} userId={match.player1_id} />}</strong>
                              ) : match.winner_id === match.player2_id ? (
                                <strong className="text-green-600">{match.is_team_mode ? match.player2_nickname : <PlayerLink nickname={match.player2_nickname} userId={match.player2_id} />}</strong>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              <span className="inline-block px-3 py-1 text-white rounded-full text-xs font-semibold" style={{ backgroundColor: getStatusColor((match as any).series_status) }}>
                                {t(`option_${normalizeStatus((match as any).series_status)}`) !== `option_${normalizeStatus((match as any).series_status)}` ? t(`option_${normalizeStatus((match as any).series_status)}`) : ((match as any).series_status || t('option_pending'))}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <p className="text-gray-600">{t('no_rounds_configured_tournament')}</p>
          )}
        </div>
      )}

      {/* Ranking Section */}
      {activeTab === 'ranking' && (
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 mt-6 overflow-x-auto">
          {tournament?.tournament_mode === 'team' ? (
            // Team ranking
            participants.length > 0 ? (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_rank')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">Team Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">Members</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_wins')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_losses')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_points')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300" title="Opponent Match Points">OMP</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300" title="Game Win Percentage">GWP</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300" title="Opponent Game Percentage">OGP</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {participants
                    .sort((a, b) => {
                      const pointsDiff = (b.tournament_points || 0) - (a.tournament_points || 0);
                      if (pointsDiff !== 0) return pointsDiff;
                      const ompDiff = (Number(b.omp) || 0) - (Number(a.omp) || 0);
                      if (ompDiff !== 0) return ompDiff;
                      const gwpDiff = (Number(b.gwp) || 0) - (Number(a.gwp) || 0);
                      if (gwpDiff !== 0) return gwpDiff;
                      const ogpDiff = (Number(b.ogp) || 0) - (Number(a.ogp) || 0);
                      if (ogpDiff !== 0) return ogpDiff;
                      return (b.tournament_wins || 0) - (a.tournament_wins || 0);
                    })
                    .map((team, index) => {
                      // Get team members from the participants list
                      const teamMembers = participants.filter((p: any) => p.team_id === team.id && p.team_id !== team.id ? p : p.team_position);
                      const membersList = teamMembers.map((p: any) => p.nickname).join(', ') || team.nickname || 'N/A';
                      
                      return (
                        <tr key={team.id}>
                          <td><strong>#{index + 1}</strong></td>
                          <td className="px-4 py-3 text-gray-700"><strong>{team.nickname}</strong></td>
                          <td className="px-4 py-3 text-gray-700">{membersList}</td>
                          <td className="px-4 py-3 text-gray-700">{team.tournament_wins || 0}</td>
                          <td className="px-4 py-3 text-gray-700">{team.tournament_losses || 0}</td>
                          <td className="px-4 py-3 text-gray-700"><strong>{team.tournament_points || 0}</strong></td>
                          <td className="px-4 py-3 text-gray-700">{team.omp != null ? Number(team.omp).toFixed(2) : '-'}</td>
                          <td className="px-4 py-3 text-gray-700">{team.gwp != null ? Number(team.gwp).toFixed(2) : '-'}</td>
                          <td className="px-4 py-3 text-gray-700">{team.ogp != null ? Number(team.ogp).toFixed(2) : '-'}</td>
                          <td className="px-4 py-3 text-gray-700">
                            <span className="inline-block px-3 py-1 text-white rounded-full text-xs font-semibold" style={{ backgroundColor: getStatusColor(team.status || undefined) }}>
                              {t(`option_${normalizeStatus(team.status || undefined)}`) !== `option_${normalizeStatus(team.status || undefined)}` ? t(`option_${normalizeStatus(team.status || undefined)}`) : (team.status || t('option_active'))}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              </div>
            ) : (
              <p className="text-gray-600">{t('no_participants_in_tournament')}</p>
            )
          ) : (
            // Individual ranking
            participants.length > 0 ? (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_rank')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_nickname')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_wins')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_losses')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_points')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300" title="Opponent Match Points">OMP</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300" title="Game Win Percentage">GWP</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300" title="Opponent Game Percentage">OGP</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-300">{t('label_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {participants
                    .sort((a, b) => {
                      const pointsDiff = (b.tournament_points || 0) - (a.tournament_points || 0);
                      if (pointsDiff !== 0) return pointsDiff;
                      const ompDiff = (Number(b.omp) || 0) - (Number(a.omp) || 0);
                      if (ompDiff !== 0) return ompDiff;
                      const gwpDiff = (Number(b.gwp) || 0) - (Number(a.gwp) || 0);
                      if (gwpDiff !== 0) return gwpDiff;
                      const ogpDiff = (Number(b.ogp) || 0) - (Number(a.ogp) || 0);
                      if (ogpDiff !== 0) return ogpDiff;
                      return (b.tournament_wins || 0) - (a.tournament_wins || 0);
                    })
                    .map((participant, index) => (
                      <tr key={participant.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700">
                          <strong>#{index + 1}</strong>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{participant.nickname}</td>
                        <td className="px-4 py-3 text-gray-700">{participant.tournament_wins || 0}</td>
                        <td className="px-4 py-3 text-gray-700">{participant.tournament_losses || 0}</td>
                        <td className="px-4 py-3 text-gray-700"><strong>{participant.tournament_points || 0}</strong></td>
                        <td className="px-4 py-3 text-gray-700">{participant.omp != null ? Number(participant.omp).toFixed(2) : '-'}</td>
                        <td className="px-4 py-3 text-gray-700">{participant.gwp != null ? Number(participant.gwp).toFixed(2) : '-'}</td>
                        <td className="px-4 py-3 text-gray-700">{participant.ogp != null ? Number(participant.ogp).toFixed(2) : '-'}</td>
                        <td className="px-4 py-3 text-gray-700">
                          <span className="inline-block px-3 py-1 text-white rounded-full text-xs font-semibold" style={{ backgroundColor: getParticipationStatusColor(participant.participation_status) }}>
                            {t(`option_${normalizeStatus(participant.participation_status)}`) !== `option_${normalizeStatus(participant.participation_status)}` ? t(`option_${normalizeStatus(participant.participation_status)}`) : (participant.participation_status || t('option_pending'))}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
            ) : (
              <p className="text-gray-600">{t('no_participants_in_tournament')}</p>
            )
          )}
        </div>
      )}

      {/* Team Join Modal */}
      {showTeamJoinModal && tournament && (
        <TeamJoinModal
          tournamentId={id!}
          onSubmit={handleTeamJoinSubmit}
          onClose={() => setShowTeamJoinModal(false)}
          isLoading={joiningTeamLoading}
          currentUserId={userId || undefined}
          currentUserNickname={user?.nickname || undefined}
          externalError={error}
        />
      )}

      {/* Report Match Modal */}
      {showReportModal && reportMatchData && tournament && (
        <TournamentMatchReportModal
          tournamentMatchId={reportMatchData.tournamentMatchId}
          tournamentId={reportMatchData.tournamentId}
          tournamentName={reportMatchData.tournamentName}
          tournamentMode={tournament.tournament_mode || 'ranked'}
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
              <h3>{t('determine_winner_title')} / {t('tournaments.player_abandoned') || 'Player Abandoned'}</h3>
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
              <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#999' }}>
                {t('tournaments.abandonment_note') || 'Select the winner. If a player abandoned, their opponent automatically wins (no ELO impact, tournament points awarded).'}
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

      <MatchDetailsModal match={matchDetailsModal.match} isOpen={matchDetailsModal.isOpen} onClose={() => setMatchDetailsModal({ isOpen: false, match: null })} onDownloadReplay={handleDownloadReplay} />

      {/* Delete Tournament Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-small">
            <div className="modal-header">
              <h2>{t('tournaments.confirm_delete_title') || 'Confirm Tournament Deletion'}</h2>
            </div>
            <div className="modal-body">
              <p>{t('tournaments.no_participants_message') || 'No participants have registered for this tournament. Delete it?'}</p>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowDeleteConfirmModal(false)}>
                {t('cancel_btn') || 'Cancel'}
              </button>
              <button className="delete-btn" onClick={handleConfirmDelete}>
                {t('delete_btn') || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetail;

