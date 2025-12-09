import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { tournamentService } from '../services/api';
import MainLayout from '../components/MainLayout';
import '../styles/Auth.css';

interface RoundTypeConfig {
  generalRounds: number;
  generalRoundsFormat: 'bo1' | 'bo3' | 'bo5';
  finalRounds: number;
  finalRoundsFormat: 'bo1' | 'bo3' | 'bo5';
}

const MyTournaments: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tournament_type: 'elimination',
    max_participants: null as number | null,
    round_duration_days: 7,
    auto_advance_round: false,
  });
  const [roundTypeConfig, setRoundTypeConfig] = useState<RoundTypeConfig>({
    generalRounds: 0,
    generalRoundsFormat: 'bo3',
    finalRounds: 0,
    finalRoundsFormat: 'bo5',
  });

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

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'pending': '#FF9800',
      'registration_open': '#4CAF50',
      'registration_closed': '#2196F3',
      'prepared': '#9C27B0',
      'in_progress': '#00BCD4',
      'finished': '#757575',
      'cancelled': '#f44336',
    };
    return colorMap[status] || '#999';
  };

  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  // Determina qué tipos de rondas son disponibles según el tipo de torneo
  const getAvailableRoundTypes = (): string[] => {
    const { tournament_type } = formData;
    if (tournament_type === 'league' || tournament_type === 'swiss') {
      return ['general'];
    }
    if (tournament_type === 'elimination' || tournament_type === 'swiss_elimination') {
      return ['general', 'final'];
    }
    return ['general'];
  };

  // Valida si se puede configurar rondas (requiere max_participants)
  const canConfigureRounds = (): boolean => {
    return formData.max_participants !== null && formData.max_participants > 0;
  };

  // Calcula el número de rondas generales para un torneo de eliminación
  // Basado en el número de participantes (potencia de 2)
  const calculateEliminationRounds = (participants: number): number => {
    if (participants <= 0) return 0;
    // Math.log2(participants) redondea hacia arriba
    return Math.ceil(Math.log2(participants));
  };

  // Obtiene el número de rondas generales calculadas automáticamente
  const getCalculatedGeneralRounds = (): number => {
    if (formData.tournament_type === 'elimination' || formData.tournament_type === 'swiss_elimination') {
      return calculateEliminationRounds(formData.max_participants || 0);
    }
    // Para otros tipos, usa el valor del usuario
    return roundTypeConfig.generalRounds;
  };

  // Calcula las rondas generales reales (total - rondas finales)
  // Solo para torneos de eliminación
  const getAdjustedGeneralRounds = (): number => {
    if (formData.tournament_type === 'elimination' || formData.tournament_type === 'swiss_elimination') {
      const totalRounds = getCalculatedGeneralRounds();
      const finalRounds = roundTypeConfig.finalRounds;
      const adjustedGeneral = Math.max(0, totalRounds - finalRounds);
      return adjustedGeneral;
    }
    return getCalculatedGeneralRounds();
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.description || !formData.tournament_type) {
      setError('Name, description and tournament type are required');
      return;
    }

    if (!formData.max_participants || formData.max_participants <= 0) {
      setError('Max participants is required and must be greater than 0');
      return;
    }

    // Final rounds are now optional (can be 0) even for elimination tournaments

    // Calcula rondas generales para eliminación
    // Para eliminación: usa rondas generales ajustadas (total - finales)
    // Para otros: usa rondas generales configuradas
    const generalRounds = (formData.tournament_type === 'elimination' || formData.tournament_type === 'swiss_elimination') 
      ? getAdjustedGeneralRounds()
      : getCalculatedGeneralRounds();

    try {
      const payload = {
        ...formData,
        general_rounds: generalRounds,
        general_rounds_format: roundTypeConfig.generalRoundsFormat,
        final_rounds: roundTypeConfig.finalRounds,
        final_rounds_format: roundTypeConfig.finalRoundsFormat,
        total_rounds: generalRounds + roundTypeConfig.finalRounds,
      };
      console.log('Creating tournament with payload:', payload);
      await tournamentService.createTournament(payload);
      setError('');
      setFormData({ 
        name: '', 
        description: '', 
        tournament_type: 'elimination',
        max_participants: null,
        round_duration_days: 7,
        auto_advance_round: false,
      });
      setRoundTypeConfig({
        generalRounds: 0,
        generalRoundsFormat: 'bo3',
        finalRounds: 0,
        finalRoundsFormat: 'bo5',
      });
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
    return <MainLayout><div className="auth-container"><p>Loading...</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="auth-container">
        <h1>Tournaments</h1>

        {error && <p className="error">{error}</p>}

        <section className="tournaments-section">
        <div className="tournaments-header">
          <h2>My Tournaments</h2>
          <button 
            className="btn-create"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? 'Cancel' : 'Create Tournament'}
          </button>
        </div>

        {showCreateForm && (
          <form className="tournament-form expanded-form" onSubmit={handleCreateTournament}>
            <div className="form-section">
              <h3>Basic Information</h3>
              <input
                type="text"
                placeholder="Tournament Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <textarea
                placeholder="Description (e.g., Liga, Eliminación, Suizo, etc.)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
                required
              />
              <div className="form-row">
                <select
                  value={formData.tournament_type}
                  onChange={(e) => setFormData({ ...formData, tournament_type: e.target.value })}
                  required
                >
                  <option value="">Select Tournament Type</option>
                  <option value="elimination">Elimination</option>
                  <option value="league">League</option>
                  <option value="swiss">Swiss</option>
                  <option value="swiss_elimination">Swiss-Elimination Mix</option>
                </select>
                <input
                  type="number"
                  placeholder="Max Participants (optional)"
                  min="2"
                  max="256"
                  value={formData.max_participants || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    max_participants: e.target.value ? parseInt(e.target.value) : null 
                  })}
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Round Configuration</h3>
              
              {!canConfigureRounds() && (
                <div className="info-box warning">
                  <p>⚠️ Max participants is required to configure rounds. Set it first in the Basic Information section.</p>
                </div>
              )}

              <div className="form-group">
                <label>Round Duration (days)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={formData.round_duration_days}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    round_duration_days: parseInt(e.target.value) 
                  })}
                  disabled={!canConfigureRounds()}
                />
              </div>

              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.auto_advance_round}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      auto_advance_round: e.target.checked 
                    })}
                    disabled={!canConfigureRounds()}
                  />
                  Auto-advance to next round after deadline
                </label>
              </div>

              {canConfigureRounds() && (formData.tournament_type !== 'league' && formData.tournament_type !== 'swiss') && (
                <div className="round-types-config">
                  <h4>Round Type Configuration</h4>
                  <p className="info-text">Configure which types of rounds your tournament will have</p>
                  
                  {(formData.tournament_type === 'elimination' || formData.tournament_type === 'swiss_elimination') && (
                    <div className="info-box info">
                      <p>ℹ️ For elimination tournaments, general rounds are auto-calculated based on participant count. Currently: <strong>{getCalculatedGeneralRounds()} rounds</strong></p>
                    </div>
                  )}

                  <div className="form-group">
                    <label>General Rounds</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={getCalculatedGeneralRounds()}
                      disabled={formData.tournament_type === 'elimination' || formData.tournament_type === 'swiss_elimination'}
                      onChange={(e) => {
                        // Solo editable si NO es eliminación
                        if (formData.tournament_type !== 'elimination' && formData.tournament_type !== 'swiss_elimination') {
                          setRoundTypeConfig({
                            ...roundTypeConfig,
                            generalRounds: parseInt(e.target.value) || 0
                          });
                        }
                      }}
                    />
                    <small>{formData.tournament_type === 'elimination' || formData.tournament_type === 'swiss_elimination' ? 'Auto-calculated for elimination' : 'Regular qualifying rounds'}</small>
                  </div>

                  <div className="form-group">
                    <label>General Rounds Match Format</label>
                    <select
                      value={roundTypeConfig.generalRoundsFormat}
                      onChange={(e) => setRoundTypeConfig({
                        ...roundTypeConfig,
                        generalRoundsFormat: e.target.value as 'bo1' | 'bo3' | 'bo5'
                      })}
                    >
                      <option value="bo1">Best of 1 (Single match)</option>
                      <option value="bo3">Best of 3 (First to 2 wins)</option>
                      <option value="bo5">Best of 5 (First to 3 wins)</option>
                    </select>
                    <small>Number of games in each general round match</small>
                  </div>

                  <div className="form-group">
                    <label>Final Rounds Count (optional)</label>
                    <input
                      type="number"
                      min="0"
                      max={getCalculatedGeneralRounds()}
                      value={roundTypeConfig.finalRounds}
                      onChange={(e) => {
                        const newFinalRounds = parseInt(e.target.value) || 0;
                        const totalRounds = getCalculatedGeneralRounds();
                        // No permitir que las rondas finales superen el total
                        const validFinalRounds = Math.min(newFinalRounds, totalRounds);
                        setRoundTypeConfig({
                          ...roundTypeConfig,
                          finalRounds: validFinalRounds
                        });
                      }}
                    />
                    <small>Number of final stages (max: {getCalculatedGeneralRounds()}). For elimination tournaments, this is subtracted from the total rounds.</small>
                  </div>

                  <div className="form-group">
                    <label>Final Rounds Match Format</label>
                    <select
                      value={roundTypeConfig.finalRoundsFormat}
                      onChange={(e) => setRoundTypeConfig({
                        ...roundTypeConfig,
                        finalRoundsFormat: e.target.value as 'bo1' | 'bo3' | 'bo5'
                      })}
                    >
                      <option value="bo1">Best of 1 (Single match)</option>
                      <option value="bo3">Best of 3 (First to 2 wins)</option>
                      <option value="bo5">Best of 5 (First to 3 wins)</option>
                    </select>
                    <small>Number of games in each final round match</small>
                  </div>

                  <div className="round-summary">
                    {(formData.tournament_type === 'elimination' || formData.tournament_type === 'swiss_elimination') ? (
                      <div>
                        <p><strong>Total Rounds (Fixed):</strong> {getCalculatedGeneralRounds()}</p>
                        {roundTypeConfig.finalRounds > 0 && (
                          <div>
                            <p className="info-text">General Rounds ({roundTypeConfig.generalRoundsFormat.toUpperCase()}): {getAdjustedGeneralRounds()} rounds</p>
                            <p className="info-text">Final Rounds ({roundTypeConfig.finalRoundsFormat.toUpperCase()}): {roundTypeConfig.finalRounds} rounds</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p><strong>Total Rounds:</strong> {getCalculatedGeneralRounds() + roundTypeConfig.finalRounds}</p>
                        {roundTypeConfig.finalRounds > 0 && (
                          <div>
                            <p className="info-text">General Rounds ({roundTypeConfig.generalRoundsFormat.toUpperCase()}): {getCalculatedGeneralRounds()} rounds</p>
                            <p className="info-text">Final Rounds ({roundTypeConfig.finalRoundsFormat.toUpperCase()}): {roundTypeConfig.finalRounds} rounds</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {canConfigureRounds() && (formData.tournament_type === 'league' || formData.tournament_type === 'swiss') && (
                <div className="info-box info">
                  <p>ℹ️ {formData.tournament_type === 'league' ? 'League' : 'Swiss'} tournaments use general rounds only. Rounds will be calculated based on max participants.</p>
                </div>
              )}
            </div>

            <button type="submit" className="btn-submit" disabled={!canConfigureRounds()}>Create Tournament</button>
          </form>
        )}

        {tournaments.length > 0 ? (
          <table className="tournaments-table">
            <thead>
              <tr>
                <th>Tournament Name</th>
                <th>Status</th>
                <th>Type</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((tournament) => (
                <tr key={tournament.id}>
                  <td className="tournament-name">{tournament.name}</td>
                  <td>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(tournament.status) }}
                    >
                      {tournament.status}
                    </span>
                  </td>
                  <td>{tournament.tournament_type}</td>
                  <td>{formatDate(tournament.created_at)}</td>
                  <td>
                    <button 
                      onClick={() => navigate(`/tournament/${tournament.id}`, { state: { from: 'my-tournaments' } })}
                      className="btn-view"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No tournaments available</p>
        )}
      </section>
    </div>
    </MainLayout>
  );
};

export default MyTournaments;
