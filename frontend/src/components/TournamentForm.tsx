import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import UnrankedFactionSelect from './UnrankedFactionSelect';
import UnrankedMapSelect from './UnrankedMapSelect';

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

interface RoundTypeConfig {
  generalRoundsFormat: 'bo1' | 'bo3' | 'bo5';
  finalRoundsFormat: 'bo1' | 'bo3' | 'bo5';
}

interface TournamentFormProps {
  mode: 'create' | 'edit';
  formData: TournamentFormData;
  onFormDataChange: (data: TournamentFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  unrankedFactions: string[];
  onUnrankedFactionsChange: (factionIds: string[]) => void;
  unrankedMaps: string[];
  onUnrankedMapsChange: (mapIds: string[]) => void;
  isLoading?: boolean;
}

const TournamentForm: React.FC<TournamentFormProps> = ({
  mode,
  formData,
  onFormDataChange,
  onSubmit,
  unrankedFactions,
  onUnrankedFactionsChange,
  unrankedMaps,
  onUnrankedMapsChange,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [roundTypeConfig, setRoundTypeConfig] = useState<RoundTypeConfig>({
    generalRoundsFormat: 'bo3',
    finalRoundsFormat: 'bo5',
  });

  // Determine tournament type options based on mode and status
  const canConfigureRounds = () => {
    if (mode === 'create') return true;
    // In edit mode, only allow if tournament is not started
    return true; // You can add status check if needed
  };

  const handleTournamentTypeChange = (newType: string) => {
    onFormDataChange({ ...formData, tournament_type: newType });
    
    // Reset round config when type changes
    if (newType === 'elimination') {
      setRoundTypeConfig({
        generalRoundsFormat: 'bo3',
        finalRoundsFormat: 'bo5',
      });
    }
  };

  return (
    <form className="tournament-form expanded-form" onSubmit={onSubmit}>
      <div className="form-section">
        <h3>{t('tournament.basic_info')}</h3>
        <input
          type="text"
          placeholder={t('tournament_name')}
          value={formData.name}
          onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
          required
          disabled={isLoading || (mode === 'edit')}
        />
        <textarea
          placeholder={t('tournament_description')}
          value={formData.description}
          onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
          rows={5}
          required
          disabled={isLoading}
        />
        
        {/* Match Type (Ranked/Unranked/Team) - FIRST choice */}
        <div className="form-row">
          <label>{t('tournament.match_type', 'Match Type')}:</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                value="ranked"
                checked={formData.tournament_mode === 'ranked'}
                onChange={(e) => onFormDataChange({ ...formData, tournament_mode: e.target.value as any })}
                disabled={isLoading || mode === 'edit'}
              />
              {t('tournament.ranked', 'Ranked (1v1, ELO impact)')}
            </label>
            <label className="radio-label">
              <input
                type="radio"
                value="unranked"
                checked={formData.tournament_mode === 'unranked'}
                onChange={(e) => onFormDataChange({ ...formData, tournament_mode: e.target.value as any })}
                disabled={isLoading || mode === 'edit'}
              />
              {t('tournament.unranked', 'Unranked (1v1, no ELO)')}
            </label>
            <label className="radio-label">
              <input
                type="radio"
                value="team"
                checked={formData.tournament_mode === 'team'}
                onChange={(e) => onFormDataChange({ ...formData, tournament_mode: e.target.value as any })}
                disabled={isLoading || mode === 'edit'}
              />
              {t('tournament.team', 'Team (2v2)')}
            </label>
          </div>
        </div>

        {/* Unranked Tournament - Show faction and map selectors */}
        {formData.tournament_mode === 'unranked' && (
          <div className="form-section">
            <h3>{t('tournament.unranked_assets', 'Unranked Tournament Assets')}</h3>
            <p className="info-note">{t('tournament.select_allowed_factions_maps', 'Select which factions and maps are allowed in this tournament')}</p>
            <div className="unranked-assets-grid">
              <UnrankedFactionSelect 
                tournamentId={undefined}
                selectedFactionIds={unrankedFactions}
                onChange={onUnrankedFactionsChange}
                disabled={isLoading}
              />
              <UnrankedMapSelect 
                tournamentId={undefined}
                selectedMapIds={unrankedMaps}
                onChange={onUnrankedMapsChange}
                disabled={isLoading}
              />
            </div>
          </div>
        )}
      </div>

      <div className="form-section">
        {/* Tournament Format (Swiss, Elimination, League) - SECOND choice */}
        <div className="form-row">
          <select
            value={formData.tournament_type}
            onChange={(e) => handleTournamentTypeChange(e.target.value)}
            required
            disabled={isLoading || mode === 'edit'}
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
            onChange={(e) => onFormDataChange({ 
              ...formData, 
              max_participants: e.target.value ? parseInt(e.target.value) : null 
            })}
            disabled={isLoading}
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
              onChange={(e) => onFormDataChange({ 
                ...formData, 
                round_duration_days: parseInt(e.target.value) 
              })}
              disabled={isLoading}
            />
          </div>

          <div className="form-group-column">
            <label>{t('label_auto_advance_rounds')}</label>
            <input
              type="checkbox"
              checked={formData.auto_advance_round}
              onChange={(e) => onFormDataChange({ 
                ...formData, 
                auto_advance_round: e.target.checked 
              })}
              className="checkbox-large"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Edit mode: Show started_at field */}
        {mode === 'edit' && (
          <div className="form-group">
            <label>{t('label_tournament_start_date')}</label>
            <input
              type="datetime-local"
              value={formData.started_at ? formData.started_at.substring(0, 16) : ''}
              onChange={(e) => onFormDataChange({ ...formData, started_at: e.target.value })}
              disabled={isLoading}
            />
          </div>
        )}

        {/* ELIMINATION TOURNAMENT - Auto-calculated rounds */}
        {canConfigureRounds() && formData.tournament_type === 'elimination' && (
          <div className="round-types-config">
            <h4>Round Configuration</h4>
            <p className="info-text">Configure match formats for your elimination tournament</p>
            
            <div className="info-box info">
              <p>ℹ️ Tournament rounds are automatically calculated based on the number of participants.</p>
            </div>

            <div className="form-group">
              <label>Preliminary Rounds Match Format</label>
              <select
                value={roundTypeConfig.generalRoundsFormat}
                onChange={(e) => setRoundTypeConfig({
                  ...roundTypeConfig,
                  generalRoundsFormat: e.target.value as 'bo1' | 'bo3' | 'bo5'
                })}
                disabled={isLoading}
              >
                <option value="bo1">{t('match_format.bo1')}</option>
                <option value="bo3">{t('match_format.bo3')}</option>
                <option value="bo5">{t('match_format.bo5')}</option>
              </select>
            </div>

            <div className="form-group">
              <label>Finals Match Format</label>
              <select
                value={roundTypeConfig.finalRoundsFormat}
                onChange={(e) => setRoundTypeConfig({
                  ...roundTypeConfig,
                  finalRoundsFormat: e.target.value as 'bo1' | 'bo3' | 'bo5'
                })}
                disabled={isLoading}
              >
                <option value="bo1">{t('match_format.bo1')}</option>
                <option value="bo3">{t('match_format.bo3')}</option>
                <option value="bo5">{t('match_format.bo5')}</option>
              </select>
            </div>
          </div>
        )}

        {/* NON-ELIMINATION TOURNAMENT - Manual round configuration */}
        {canConfigureRounds() && formData.tournament_type !== 'elimination' && (
          <div className="round-types-config">
            <div className="form-row">
              <div className="form-group">
                <label>{t('label_general_rounds')}</label>
                <input
                  type="number"
                  min="1"
                  value={formData.general_rounds}
                  onChange={(e) => onFormDataChange({
                    ...formData,
                    general_rounds: parseInt(e.target.value),
                  })}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label>{t('tournament.general_rounds_format') || 'General Rounds Format'}</label>
                <select
                  value={formData.general_rounds_format}
                  onChange={(e) => onFormDataChange({
                    ...formData,
                    general_rounds_format: e.target.value as 'bo1' | 'bo3' | 'bo5'
                  })}
                  disabled={isLoading}
                >
                  <option value="bo1">{t('match_format.bo1')}</option>
                  <option value="bo3">{t('match_format.bo3')}</option>
                  <option value="bo5">{t('match_format.bo5')}</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('label_final_rounds')}</label>
                <input
                  type="number"
                  min="0"
                  value={formData.final_rounds}
                  onChange={(e) => onFormDataChange({
                    ...formData,
                    final_rounds: parseInt(e.target.value),
                  })}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label>{t('tournament.final_rounds_format') || 'Final Rounds Format'}</label>
                <select
                  value={formData.final_rounds_format}
                  onChange={(e) => onFormDataChange({
                    ...formData,
                    final_rounds_format: e.target.value as 'bo1' | 'bo3' | 'bo5'
                  })}
                  disabled={isLoading}
                >
                  <option value="bo1">{t('match_format.bo1')}</option>
                  <option value="bo3">{t('match_format.bo3')}</option>
                  <option value="bo5">{t('match_format.bo5')}</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="form-section button-group">
        <button type="submit" className="btn-submit" disabled={isLoading}>
          {isLoading ? t('loading') : (mode === 'create' ? t('btn_create') : t('btn_confirm'))}
        </button>
      </div>
    </form>
  );
};

export default TournamentForm;
