import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { tournamentService } from '../services/api';
import MainLayout from '../components/MainLayout';
import TournamentList, { Tournament } from '../components/TournamentList';
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
  
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
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

  // Update round type config defaults when tournament type changes
  const handleTournamentTypeChange = (newType: string) => {
    setFormData({ ...formData, tournament_type: newType });
    
    // Set sensible defaults based on tournament type
    if (newType === 'swiss') {
      setRoundTypeConfig({
        generalRounds: 5, // Default 5 Swiss rounds
        generalRoundsFormat: 'bo3',
        finalRounds: 0,
        finalRoundsFormat: 'bo5',
      });
    } else if (newType === 'league') {
      setRoundTypeConfig({
        generalRounds: 2, // Default double round (ida y vuelta)
        generalRoundsFormat: 'bo3',
        finalRounds: 0,
        finalRoundsFormat: 'bo5',
      });
    } else if (newType === 'swiss_elimination') {
      setRoundTypeConfig({
        generalRounds: 4, // Default 4 Swiss rounds
        generalRoundsFormat: 'bo3',
        finalRounds: 2, // Default 2 elimination rounds (Semifinals, Final)
        finalRoundsFormat: 'bo5',
      });
    } else if (newType === 'elimination') {
      setRoundTypeConfig({
        generalRounds: 0,
        generalRoundsFormat: 'bo3',
        finalRounds: 1, // At least 1 for pure elimination
        finalRoundsFormat: 'bo5',
      });
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchTournaments();
  }, [isAuthenticated, navigate]);

  // Initialize roundTypeConfig with sensible defaults when form opens
  useEffect(() => {
    if (showCreateForm) {
      // Always set defaults based on the current tournament_type
      handleTournamentTypeChange(formData.tournament_type);
    }
  }, [showCreateForm, formData.tournament_type]);

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

  // Valida si se puede configurar rondas (ahora es opcional, solo usa defaults si no hay max_participants)
  const canConfigureRounds = (): boolean => {
    // Ahora siempre se puede configurar rondas, solo que sin cálculos automáticos si no hay participantes
    return true;
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
      setError(t('error_name_description_required'));
      return;
    }

    // Final rounds are now optional (can be 0) even for elimination tournaments
    // Max participants is optional - will be set during tournament preparation

    // Calcula rondas generales según el tipo de torneo
    let generalRounds = 0;
    
    if (formData.tournament_type === 'elimination') {
      // For pure Elimination, general rounds are auto-calculated from participant count
      generalRounds = formData.max_participants && (formData.max_participants > 0)
        ? getAdjustedGeneralRounds()
        : 0;
    } else if (formData.tournament_type === 'swiss_elimination') {
      // For Swiss-Elimination Mix, use the user-configured Swiss rounds
      generalRounds = roundTypeConfig.generalRounds;
    } else if (formData.tournament_type === 'swiss' || formData.tournament_type === 'league') {
      // For Swiss and League, use the user-configured rounds
      generalRounds = roundTypeConfig.generalRounds;
    } else {
      generalRounds = 0;
    }

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
      // Reset to elimination defaults
      setRoundTypeConfig({
        generalRounds: 0,
        generalRoundsFormat: 'bo3',
        finalRounds: 1,
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
          <form className="tournament-form expanded-form" onSubmit={handleCreateTournament}>
            <div className="form-section">
              <h3>{t('tournament.basic_info')}</h3>
              <input
                type="text"
                placeholder={t('tournament_name')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <textarea
                placeholder={t('tournament_description')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
                required
              />
              <div className="form-row">
                <select
                  value={formData.tournament_type}
                  onChange={(e) => handleTournamentTypeChange(e.target.value)}
                  required
                >
                  <option value="">{t('option_all_types')}</option>
                  <option value="elimination">{t('option_type_elimination')}</option>
                  <option value="league">{t('option_type_league')}</option>
                  <option value="swiss">{t('option_type_swiss')}</option>
                  <option value="swiss_elimination">{t('option_type_swiss_elimination', 'Swiss-Elimination Mix')}</option>
                </select>
                <input
                  type="number"
                  placeholder={t('label_max_participants')}
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
              <div className="section-header">
                <h3>{t('tournament.round_configuration', 'Round Configuration')}</h3>
                {!formData.max_participants && (
                  <span className="info-note">{t('tournaments.round_config_optional', 'Optional - set when preparing the tournament')}</span>
                )}
              </div>

              <div className="form-row-inline-align">
                <div className="form-group-column">
                  <label>{t('label_round_duration', 'Round Duration (days)')}</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={formData.round_duration_days}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      round_duration_days: parseInt(e.target.value) 
                    })}
                  />
                </div>

                <div className="form-group-column">
                  <label>{t('label_auto_advance_rounds')}</label>
                  <input
                    type="checkbox"
                    checked={formData.auto_advance_round}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      auto_advance_round: e.target.checked 
                    })}
                    className="checkbox-large"
                  />
                </div>
              </div>

              {/* ELIMINATION TOURNAMENT - Auto-calculated rounds */}
              {canConfigureRounds() && formData.tournament_type === 'elimination' && (
                <div className="round-types-config">
                  <h4>Round Type Configuration</h4>
                  <p className="info-text">Configure which types of rounds your tournament will have</p>
                  
                  <div className="info-box info">
                    <p>ℹ️ For elimination tournaments, general rounds are auto-calculated based on participant count. Currently: <strong>{getCalculatedGeneralRounds()} rounds</strong></p>
                  </div>

                  <div className="form-group">
                    <label>General Rounds</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={getCalculatedGeneralRounds()}
                      disabled={true}
                      onChange={() => {}}
                    />
                    <small>Auto-calculated for elimination tournaments</small>
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
                      <option value="bo1">{t('match_format.bo1')}</option>
                      <option value="bo3">{t('match_format.bo3')}</option>
                      <option value="bo5">{t('match_format.bo5')}</option>
                    </select>
                    <small>Number of games in each general round match</small>
                  </div>

                  <div className="form-group">
                    <label>Final Rounds Count</label>
                    <input
                      type="number"
                      min="1"
                      max="3"
                      value={roundTypeConfig.finalRounds}
                      onChange={(e) => {
                        const newFinalRounds = parseInt(e.target.value) || 1;
                        // For pure elimination, final rounds are limited to 1-3
                        const validFinalRounds = Math.max(1, Math.min(newFinalRounds, 3));
                        setRoundTypeConfig({
                          ...roundTypeConfig,
                          finalRounds: validFinalRounds
                        });
                      }}
                    />
                    <small>Number of elimination rounds (1-3). For pure elimination tournaments, this determines the tournament structure.</small>
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
                      <option value="bo1">{t('match_format.bo1')}</option>
                      <option value="bo3">{t('match_format.bo3')}</option>
                      <option value="bo5">{t('match_format.bo5')}</option>
                    </select>
                    <small>Number of games in each final round match</small>
                  </div>

                  <div className="round-summary">
                    <div>
                      <p><strong>Total Rounds (Fixed):</strong> {getCalculatedGeneralRounds()}</p>
                      {roundTypeConfig.finalRounds > 0 && (
                        <div>
                          <p className="info-text">General Rounds ({roundTypeConfig.generalRoundsFormat.toUpperCase()}): {getAdjustedGeneralRounds()} rounds</p>
                          <p className="info-text">Final Rounds ({roundTypeConfig.finalRoundsFormat.toUpperCase()}): {roundTypeConfig.finalRounds} rounds</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SWISS TOURNAMENT - User chooses number of rounds */}
              {canConfigureRounds() && formData.tournament_type === 'swiss' && (
                <div className="round-types-config">
                  <h4>Swiss Rounds Configuration</h4>
                  <p className="info-text">Configure the Swiss round tournament</p>
                  
                  <div className="form-group">
                    <label>Number of Swiss Rounds</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={roundTypeConfig.generalRounds}
                      onChange={(e) => setRoundTypeConfig({
                        ...roundTypeConfig,
                        generalRounds: parseInt(e.target.value) || 1
                      })}
                    />
                    <small>Number of Swiss system rounds to run (typically 3-7 rounds for Swiss tournaments)</small>
                  </div>

                  <div className="form-group">
                    <label>Match Format</label>
                    <select
                      value={roundTypeConfig.generalRoundsFormat}
                      onChange={(e) => setRoundTypeConfig({
                        ...roundTypeConfig,
                        generalRoundsFormat: e.target.value as 'bo1' | 'bo3' | 'bo5'
                      })}
                    >
                      <option value="bo1">{t('match_format.bo1')}</option>
                      <option value="bo3">{t('match_format.bo3')}</option>
                      <option value="bo5">{t('match_format.bo5')}</option>
                    </select>
                    <small>Number of games in each match</small>
                  </div>

                  <div className="round-summary">
                    <p><strong>Total Rounds:</strong> {roundTypeConfig.generalRounds} Swiss rounds ({roundTypeConfig.generalRoundsFormat.toUpperCase()})</p>
                  </div>
                </div>
              )}

              {/* LEAGUE TOURNAMENT - User chooses single or double round */}
              {canConfigureRounds() && formData.tournament_type === 'league' && (
                <div className="round-types-config">
                  <h4>League Format Configuration</h4>
                  <p className="info-text">Configure the League tournament format</p>
                  
                  <div className="form-group">
                    <label>League Format</label>
                    <select
                      value={roundTypeConfig.generalRounds}
                      onChange={(e) => setRoundTypeConfig({
                        ...roundTypeConfig,
                        generalRounds: parseInt(e.target.value) || 1
                      })}
                    >
                      <option value="1">Single Round (Ida) - Each team plays once</option>
                      <option value="2">Double Round (Ida y Vuelta) - Each team plays twice</option>
                    </select>
                    <small>Select whether teams play once or twice against each other</small>
                  </div>

                  <div className="form-group">
                    <label>Match Format</label>
                    <select
                      value={roundTypeConfig.generalRoundsFormat}
                      onChange={(e) => setRoundTypeConfig({
                        ...roundTypeConfig,
                        generalRoundsFormat: e.target.value as 'bo1' | 'bo3' | 'bo5'
                      })}
                    >
                      <option value="bo1">{t('match_format.bo1')}</option>
                      <option value="bo3">{t('match_format.bo3')}</option>
                      <option value="bo5">{t('match_format.bo5')}</option>
                    </select>
                    <small>Number of games in each match</small>
                  </div>

                  <div className="round-summary">
                    <p><strong>Format:</strong> {roundTypeConfig.generalRounds === 1 ? 'Single Round (Ida)' : 'Double Round (Ida y Vuelta)'} ({roundTypeConfig.generalRoundsFormat.toUpperCase()})</p>
                    {formData.max_participants && (
                      <p><strong>Calculated Rounds:</strong> {(() => {
                        const n = formData.max_participants;
                        const combinations = (n * (n - 1)) / 2;
                        const totalRounds = combinations * roundTypeConfig.generalRounds;
                        return `${combinations} combinations × ${roundTypeConfig.generalRounds} phase(s) = ${totalRounds} rounds`;
                      })()}</p>
                    )}
                  </div>
                </div>
              )}

              {/* SWISS-ELIMINATION MIX - User chooses both Swiss and elimination rounds */}
              {canConfigureRounds() && formData.tournament_type === 'swiss_elimination' && (
                <div className="round-types-config">
                  <h4>Swiss-Elimination Mix Configuration</h4>
                  <p className="info-text">Configure both the Swiss phase and the Elimination phase</p>
                  
                  <div className="info-box info">
                    <p>ℹ️ This tournament combines a Swiss phase for qualification with an elimination phase for final ranking</p>
                  </div>

                  <div style={{border: '1px solid #ddd', padding: '15px', borderRadius: '4px', marginBottom: '15px'}}>
                    <h5 style={{marginTop: 0}}>Swiss Phase (Qualifying)</h5>
                    <div className="form-group">
                      <label>Number of Swiss Rounds</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={roundTypeConfig.generalRounds}
                        onChange={(e) => setRoundTypeConfig({
                          ...roundTypeConfig,
                          generalRounds: parseInt(e.target.value) || 1
                        })}
                      />
                      <small>Number of Swiss rounds in the qualifying phase</small>
                    </div>

                    <div className="form-group">
                      <label>Match Format</label>
                      <select
                        value={roundTypeConfig.generalRoundsFormat}
                        onChange={(e) => setRoundTypeConfig({
                          ...roundTypeConfig,
                          generalRoundsFormat: e.target.value as 'bo1' | 'bo3' | 'bo5'
                        })}
                      >
                        <option value="bo1">{t('match_format.bo1')}</option>
                        <option value="bo3">{t('match_format.bo3')}</option>
                        <option value="bo5">{t('match_format.bo5')}</option>
                      </select>
                      <small>Number of games in each Swiss match</small>
                    </div>
                  </div>

                  <div style={{border: '1px solid #ddd', padding: '15px', borderRadius: '4px'}}>
                    <h5 style={{marginTop: 0}}>Elimination Phase (Finals)</h5>
                    <div className="form-group">
                      <label>Number of Elimination Rounds</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={roundTypeConfig.finalRounds}
                        onChange={(e) => setRoundTypeConfig({
                          ...roundTypeConfig,
                          finalRounds: parseInt(e.target.value) || 1
                        })}
                      />
                      <small>Number of elimination rounds (e.g., Quarterfinals, Semifinals, Finals)</small>
                    </div>

                    <div className="form-group">
                      <label>Match Format</label>
                      <select
                        value={roundTypeConfig.finalRoundsFormat}
                        onChange={(e) => setRoundTypeConfig({
                          ...roundTypeConfig,
                          finalRoundsFormat: e.target.value as 'bo1' | 'bo3' | 'bo5'
                        })}
                      >
                        <option value="bo1">{t('match_format.bo1')}</option>
                        <option value="bo3">{t('match_format.bo3')}</option>
                        <option value="bo5">{t('match_format.bo5')}</option>
                      </select>
                      <small>Number of games in each elimination match</small>
                    </div>
                  </div>

                  <div className="round-summary" style={{marginTop: '15px'}}>
                    <p><strong>Total Rounds:</strong> {roundTypeConfig.generalRounds + roundTypeConfig.finalRounds}</p>
                    <p className="info-text">Swiss Phase: {roundTypeConfig.generalRounds} rounds ({roundTypeConfig.generalRoundsFormat.toUpperCase()})</p>
                    <p className="info-text">Elimination Phase: {roundTypeConfig.finalRounds} rounds ({roundTypeConfig.finalRoundsFormat.toUpperCase()})</p>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="btn-submit">{t('tournament_create')}</button>
          </form>
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
