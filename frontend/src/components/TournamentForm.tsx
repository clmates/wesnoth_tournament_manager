import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import UnrankedFactionSelect from './UnrankedFactionSelect';
import UnrankedMapSelect from './UnrankedMapSelect';
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
  started_at?: string;
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

  // Determine tournament type options based on mode and status
  const canConfigureRounds = () => {
    if (mode === 'create') return true;
    // In edit mode, only allow if tournament is not started
    return true; // You can add status check if needed
  };

  const handleTournamentTypeChange = (newType: string) => {
    onFormDataChange({ ...formData, tournament_type: newType });
  };

  return (
    <form className="tournament-form expanded-form" onSubmit={onSubmit}>
      {/* SECTION 1: BASIC INFORMATION */}
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
        
        {/* Tournament Mode Selector (Ranked/Unranked/Team) */}
        <div className="form-group">
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
              {t('tournament.team', 'Team (2v2, no ELO)')}
            </label>
          </div>
        </div>
      </div>

      {/* SECTION 2: TOURNAMENT TYPE AND PARTICIPANTS */}
      <div className="form-section">
        <h3>{t('tournament.format_settings', 'Format Settings')}</h3>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>{t('tournament.tournament_format', 'Tournament Format')}</label>
            <select
              value={formData.tournament_type}
              onChange={(e) => handleTournamentTypeChange(e.target.value)}
              required
              disabled={isLoading || mode === 'edit'}
            >
              <option value="elimination">Elimination</option>
              <option value="league">League</option>
              <option value="swiss">Swiss</option>
              <option value="swiss_elimination">Swiss-Elimination Mix</option>
            </select>
          </div>
          <div className="form-group">
            <label>Max Participants</label>
            <input
              type="number"
              placeholder="Max Participants"
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
      </div>

      {/* SECTION 3: UNRANKED ASSETS (conditional) */}
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

      {/* SECTION 3B: TEAM ASSETS (same as unranked) */}
      {formData.tournament_mode === 'team' && (
        <div className="form-section">
          <h3>{t('tournament.team_assets', 'Team Tournament Assets')}</h3>
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

      {/* SECTION 3C: RANKED ASSETS (only ranked factions/maps) */}
      {formData.tournament_mode === 'ranked' && (
        <div className="form-section">
          <h3>{t('tournament.ranked_assets', 'Ranked Tournament Assets')}</h3>
          <p className="info-note">{t('tournament.select_allowed_ranked_factions_maps', 'Select which ranked factions and maps are allowed in this tournament')}</p>
          <div className="unranked-assets-grid">
            <UnrankedFactionSelect 
              tournamentId={undefined}
              selectedFactionIds={unrankedFactions}
              onChange={onUnrankedFactionsChange}
              disabled={isLoading}
              isRankedOnly={true}
            />
            <UnrankedMapSelect 
              tournamentId={undefined}
              selectedMapIds={unrankedMaps}
              onChange={onUnrankedMapsChange}
              disabled={isLoading}
              isRankedOnly={true}
            />
          </div>
        </div>
      )}

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
                value={formData.general_rounds_format}
                onChange={(e) => onFormDataChange({
                  ...formData,
                  general_rounds_format: e.target.value as 'bo1' | 'bo3' | 'bo5'
                })}
                disabled={isLoading}
              >
                <option value="bo1">Best of 1 (Single match)</option>
                <option value="bo3">Best of 3 (First to 2 wins)</option>
                <option value="bo5">Best of 5 (First to 3 wins)</option>
              </select>
              <small>Best of format for all preliminary elimination rounds</small>
            </div>

            <div className="form-group">
              <label>Final Match Format</label>
              <select
                value={formData.final_rounds_format}
                onChange={(e) => onFormDataChange({
                  ...formData,
                  final_rounds_format: e.target.value as 'bo1' | 'bo3' | 'bo5'
                })}
                disabled={isLoading}
              >
                <option value="bo1">Best of 1 (Single match)</option>
                <option value="bo3">Best of 3 (First to 2 wins)</option>
                <option value="bo5">Best of 5 (First to 3 wins)</option>
              </select>
              <small>Best of format for the final match</small>
            </div>
          </div>
        )}

        {/* NON-ELIMINATION TOURNAMENT - Manual round configuration */}
        {canConfigureRounds() && formData.tournament_type !== 'elimination' && (
          <div className="round-types-config">
            {/* LEAGUE TOURNAMENT */}
            {formData.tournament_type === 'league' && (
              <>
                <h4>League Format Configuration</h4>
                <p className="info-text">Configure the League tournament format</p>
                <div className="form-group">
                  <label>League Format</label>
                  <select
                    value={formData.general_rounds}
                    onChange={(e) => onFormDataChange({
                      ...formData,
                      general_rounds: parseInt(e.target.value),
                    })}
                    disabled={isLoading}
                  >
                    <option value="1">Single Round (Ida) - Each team plays once</option>
                    <option value="2">Double Round (Ida y Vuelta) - Each team plays twice</option>
                  </select>
                  <small>Select whether teams play once or twice against each other</small>
                </div>
                <div className="form-group">
                  <label>Match Format</label>
                  <select
                    value={formData.general_rounds_format}
                    onChange={(e) => onFormDataChange({
                      ...formData,
                      general_rounds_format: e.target.value as 'bo1' | 'bo3' | 'bo5'
                    })}
                    disabled={isLoading}
                  >
                    <option value="bo1">Best of 1 (Single match)</option>
                    <option value="bo3">Best of 3 (First to 2 wins)</option>
                    <option value="bo5">Best of 5 (First to 3 wins)</option>
                  </select>
                  <small>Number of games in each match</small>
                </div>
                <div className="round-summary">
                  <p><strong>Format:</strong> {formData.general_rounds === 2 ? 'Double Round (Ida y Vuelta)' : 'Single Round (Ida)'} ({formData.general_rounds_format?.toUpperCase()})</p>
                </div>
              </>
            )}

            {/* SWISS TOURNAMENT */}
            {formData.tournament_type === 'swiss' && (
              <>
                <h4>Swiss Rounds Configuration</h4>
                <p className="info-text">Configure the Swiss round tournament</p>
                <div className="form-group">
                  <label>Number of Swiss Rounds</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.general_rounds}
                    onChange={(e) => onFormDataChange({
                      ...formData,
                      general_rounds: parseInt(e.target.value),
                    })}
                    disabled={isLoading}
                  />
                  <small>Number of Swiss system rounds to run (typically 3-7 rounds for Swiss tournaments)</small>
                </div>
                <div className="form-group">
                  <label>Match Format</label>
                  <select
                    value={formData.general_rounds_format}
                    onChange={(e) => onFormDataChange({
                      ...formData,
                      general_rounds_format: e.target.value as 'bo1' | 'bo3' | 'bo5'
                    })}
                    disabled={isLoading}
                  >
                    <option value="bo1">Best of 1 (Single match)</option>
                    <option value="bo3">Best of 3 (First to 2 wins)</option>
                    <option value="bo5">Best of 5 (First to 3 wins)</option>
                  </select>
                  <small>Number of games in each match</small>
                </div>
                <div className="round-summary">
                  <p><strong>Total Rounds:</strong> {formData.general_rounds} Swiss rounds ({formData.general_rounds_format?.toUpperCase()})</p>
                </div>
              </>
            )}

            {/* SWISS-ELIMINATION HYBRID TOURNAMENT */}
            {formData.tournament_type === 'swiss_elimination' && (
              <>
                <h4>Swiss-Elimination Mix Configuration</h4>
                <p className="info-text">Configure Swiss qualifying rounds and elimination bracket with different match formats</p>
                <div className="info-box info">
                  <p>ℹ️ This tournament combines a Swiss phase for qualification with an elimination phase for final ranking. You can set different match formats for qualification and the grand final.</p>
                </div>
                
                {/* Rounds Configuration */}
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', marginBottom: '15px' }}>
                  <h5 style={{ marginTop: 0 }}>Rounds Configuration</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div className="form-group">
                      <label>Number of Swiss Rounds</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={formData.general_rounds}
                        onChange={(e) => onFormDataChange({
                          ...formData,
                          general_rounds: parseInt(e.target.value),
                        })}
                        disabled={isLoading}
                      />
                      <small>Qualifying rounds using Swiss system</small>
                    </div>
                    <div className="form-group">
                      <label>Number of Elimination Rounds</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={formData.final_rounds}
                        onChange={(e) => onFormDataChange({
                          ...formData,
                          final_rounds: parseInt(e.target.value),
                        })}
                        disabled={isLoading}
                      />
                      <small>Total elimination rounds (includes grand final)</small>
                    </div>
                  </div>
                </div>

                {/* Match Formats */}
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', marginBottom: '15px' }}>
                  <h5 style={{ marginTop: 0 }}>Match Formats</h5>
                  <div className="form-group">
                    <label>General Format (Swiss Rounds + Elimination except Final)</label>
                    <select
                      value={formData.general_rounds_format}
                      onChange={(e) => onFormDataChange({
                        ...formData,
                        general_rounds_format: e.target.value as 'bo1' | 'bo3' | 'bo5'
                      })}
                      disabled={isLoading}
                    >
                      <option value="bo1">Best of 1 (Single match)</option>
                      <option value="bo3">Best of 3 (First to 2 wins)</option>
                      <option value="bo5">Best of 5 (First to 3 wins)</option>
                    </select>
                    <small>Used for Swiss rounds and all elimination rounds except the grand final</small>
                  </div>
                  <div className="form-group">
                    <label>Final Format (Grand Final)</label>
                    <select
                      value={formData.final_rounds_format}
                      onChange={(e) => onFormDataChange({
                        ...formData,
                        final_rounds_format: e.target.value as 'bo1' | 'bo3' | 'bo5'
                      })}
                      disabled={isLoading}
                    >
                      <option value="bo1">Best of 1 (Single match)</option>
                      <option value="bo3">Best of 3 (First to 2 wins)</option>
                      <option value="bo5">Best of 5 (First to 3 wins)</option>
                    </select>
                    <small>Used only for the grand final match</small>
                  </div>
                </div>

                {/* Summary */}
                <div className="round-summary" style={{ marginTop: '15px' }}>
                  <p><strong>Tournament Structure:</strong></p>
                  <p className="info-text">• Swiss Phase: {formData.general_rounds} rounds ({formData.general_rounds_format?.toUpperCase()})</p>
                  {formData.final_rounds > 1 && (
                    <p className="info-text">• Qualification Phase: {formData.final_rounds - 1} rounds ({formData.general_rounds_format?.toUpperCase()}) [Quarters, Semis, etc]</p>
                  )}
                  <p className="info-text">• Grand Final: 1 round ({formData.final_rounds_format?.toUpperCase()})</p>
                  <p className="info-text"><strong>Total Rounds:</strong> {formData.general_rounds + formData.final_rounds}</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="form-section button-group" style={{ display: 'flex', width: '100%' }}>
        <button type="submit" className="btn-submit" disabled={isLoading} style={{ width: '100%' }}>
          {isLoading ? t('loading') : (mode === 'create' ? t('tournament_create') : t('btn_confirm'))}
        </button>
      </div>
    </form>
  );
};

export default TournamentForm;
