import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { tournamentService } from '../services/api';
import MainLayout from '../components/MainLayout';
import TournamentList, { Tournament } from '../components/TournamentList';
import TournamentForm from '../components/TournamentForm';
import '../styles/Auth.css';

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
}

const MyTournaments: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<TournamentFormData>({
    name: '',
    description: '',
    tournament_type: 'elimination',
    tournament_mode: 'ranked' as 'ranked' | 'unranked' | 'team',
    max_participants: null as number | null,
    round_duration_days: 7,
    auto_advance_round: false,
    general_rounds: 0,
    final_rounds: 0,
    general_rounds_format: 'bo3',
    final_rounds_format: 'bo5',
  });
  const [unrankedFactions, setUnrankedFactions] = useState<string[]>([]);
  const [unrankedMaps, setUnrankedMaps] = useState<string[]>([]);


  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchTournaments();
  }, [isAuthenticated, navigate]);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const res = await tournamentService.getMyTournaments();
      setTournaments(res.data || []);
      setError('');

    } catch (err: any) {
      console.error('Error fetching tournaments:', err);
      setError('Error loading tournaments');
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.description || !formData.tournament_type) {
      setError(t('error_name_description_required'));
      return;
    }

    try {
      const payload: any = {
        ...formData,
      };
      
      // Add assets for all tournament modes (ranked, unranked, team)
      // Assets are always included if selected
      if (unrankedFactions.length > 0 || unrankedMaps.length > 0) {
        payload.unranked_factions = unrankedFactions;
        payload.unranked_maps = unrankedMaps;
      }
      
      console.log('Creating tournament with payload:', payload);
      await tournamentService.createTournament(payload);
      setError('');
      setFormData({ 
        name: '', 
        description: '', 
        tournament_type: 'elimination',
        tournament_mode: 'ranked',
        max_participants: null,
        round_duration_days: 7,
        auto_advance_round: false,
        general_rounds: 0,
        final_rounds: 0,
        general_rounds_format: 'bo3',
        final_rounds_format: 'bo5',
      });
      setUnrankedFactions([]);
      setUnrankedMaps([]);
      setShowCreateForm(false);
      fetchTournaments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create tournament');
    }
  };

  const handleJoinTournament = async (tournamentId: string) => {
    try {
      await tournamentService.joinTournament(tournamentId);
      setError('');
      fetchTournaments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join tournament');
    }
  };

  if (loading) {
    return <MainLayout><div className="admin-container"><p>{t('loading')}</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="admin-container">
        <div className="tournament-header">
          <h1>{t('my_tournaments_title')}</h1>
          <button 
            className="btn-create"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? t('btn_cancel') : t('tournament_create')}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {showCreateForm && (
          <TournamentForm 
            mode="create"
            formData={formData}
            onFormDataChange={setFormData}
            onSubmit={handleCreateTournament}
            unrankedFactions={unrankedFactions}
            onUnrankedFactionsChange={setUnrankedFactions}
            unrankedMaps={unrankedMaps}
            onUnrankedMapsChange={setUnrankedMaps}
          />
        )}

        <TournamentList
          title=""
          tournaments={tournaments}
          loading={false}
          error=""
          currentPage={1}
          totalPages={1}
          total={tournaments.length}
          showFilters={false}
          onPageChange={() => {}}
        />
      </div>
    </MainLayout>
  );
};

export default MyTournaments;
