import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import '../styles/Tournaments.css';

export interface Tournament {
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
  created_at: string;
  updated_at: string;
  started_at: string;
  finished_at: string;
  approved_at: string;
  winner_id?: string;
  winner_nickname?: string;
  runner_up_id?: string;
  runner_up_nickname?: string;
}

export interface FilterState {
  name: string;
  status: string;
  type: string;
}

interface TournamentListProps {
  title: string;
  tournaments: Tournament[];
  loading: boolean;
  error: string;
  currentPage: number;
  totalPages: number;
  total: number;
  showFilters?: boolean;
  showCreateButton?: boolean;
  onFilterChange?: (filters: FilterState) => void;
  onPageChange?: (page: number) => void;
  onCreateClick?: () => void;
  onViewDetails?: (tournamentId: string) => void;
  onEdit?: (tournamentId: string) => void;
  onDelete?: (tournamentId: string) => void;
}

const TournamentList: React.FC<TournamentListProps> = ({
  title,
  tournaments,
  loading,
  error,
  currentPage,
  totalPages,
  total,
  showFilters = true,
  showCreateButton = false,
  onFilterChange,
  onPageChange,
  onCreateClick,
  onViewDetails,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [inputFilters, setInputFilters] = useState<FilterState>({
    name: '',
    status: '',
    type: '',
  });

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFilterInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setInputFilters(prev => ({
      ...prev,
      [name]: value,
    }));

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      onFilterChange?.({
        ...inputFilters,
        [name]: value,
      });
    }, 500);
  };

  const handleResetFilters = () => {
    setInputFilters({
      name: '',
      status: '',
      type: '',
    });
    onFilterChange?.({
      name: '',
      status: '',
      type: '',
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      onPageChange?.(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleViewDetails = (tournamentId: string) => {
    if (onViewDetails) {
      onViewDetails(tournamentId);
    } else {
      navigate(`/tournament/${tournamentId}`, { state: { from: 'tournaments' } });
    }
  };

  const getStatusLabel = (status: string) => {
    const normalizeStatus = (s: string) => {
      if (!s) return 'pending';
      return s.toString().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
    };

    const key = `option_${normalizeStatus(status)}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
    const human = (status || '').toString().replace(/_/g, ' ').replace(/-/g, ' ');
    return human.charAt(0).toUpperCase() + human.slice(1);
  };

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'pending': '#FF9800',
      'active': '#4CAF50',
      'completed': '#2196F3',
      'cancelled': '#f44336',
      'registration_open': '#FF9800',
      'registration_closed': '#9C27B0',
      'prepared': '#2196F3',
      'approved': '#4CAF50',
      'in_progress': '#4CAF50',
      'finished': '#607D8B',
    };
    return colorMap[status] || '#999';
  };

  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return <div className="admin-container"><p>{t('loading')}</p></div>;
  }

  return (
    <div className="admin-container">
      {title && (
        <div className="tournament-header">
          <h1>{title}</h1>
          {showCreateButton && (
            <button className="btn-create" onClick={onCreateClick}>
              {t('create_tournament')}
            </button>
          )}
        </div>
      )}

      {error && <p className="error-message">{error}</p>}

      {/* Pagination Controls - Top */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="page-btn"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            {t('pagination_first')}
          </button>
          <button
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            {t('pagination_prev')}
          </button>

          <div className="page-info">
            {t('pagination_page_info', { page: currentPage, totalPages })}
          </div>

          <button
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            {t('pagination_next')}
          </button>
          <button
            className="page-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            {t('pagination_last')}
          </button>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="filters-section">
          <div className="filter-group">
            <label htmlFor="name">{t('tournament_name')}</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder={t('filter_by_tournament_name')}
              value={inputFilters.name}
              onChange={handleFilterInputChange}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="status">{t('filter_status')}</label>
            <select
              id="status"
              name="status"
              value={inputFilters.status}
              onChange={handleFilterInputChange}
            >
              <option value="">{t('option_all_statuses')}</option>
              <option value="registration_open">{t('option_registration_open')}</option>
              <option value="registration_closed">{t('option_registration_closed')}</option>
              <option value="prepared">{t('option_prepared')}</option>
              <option value="approved">{t('option_approved')}</option>
              <option value="in_progress">{t('option_in_progress')}</option>
              <option value="finished">{t('option_finished')}</option>
              <option value="cancelled">{t('option_cancelled')}</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="type">{t('filter_type')}</label>
            <select
              id="type"
              name="type"
              value={inputFilters.type}
              onChange={handleFilterInputChange}
            >
              <option value="">{t('option_all_types')}</option>
              <option value="elimination">{t('option_type_elimination')}</option>
              <option value="league">{t('option_type_league')}</option>
              <option value="swiss">{t('option_type_swiss')}</option>
            </select>
          </div>

          <button className="reset-btn" onClick={handleResetFilters}>
            {t('reset_filters')}
          </button>
        </div>
      )}

      <div className="tournaments-info">
        <p>{t('showing_count', { count: tournaments.length, total, page: currentPage, totalPages })}</p>
      </div>

      <section className="tournaments-section">
        {tournaments.length > 0 ? (
          <table className="tournaments-table">
            <thead>
              <tr>
                <th>{t('tournament.col_name')}</th>
                <th>{t('tournament.col_organizer')}</th>
                <th>{t('tournament.col_status')}</th>
                <th>{t('tournament.col_type')}</th>
                <th>{t('tournament.col_winner')}</th>
                <th>{t('tournament.col_runner_up')}</th>
                <th>{t('tournament.col_last_updated')}</th>
                <th>{t('tournament.col_action')}</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((tournament) => (
                <tr key={tournament.id}>
                  <td className="tournament-name">{tournament.name}</td>
                  <td>{tournament.creator_nickname}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(tournament.status) }}
                    >
                      {getStatusLabel(tournament.status)}
                    </span>
                  </td>
                  <td>{tournament.tournament_type}</td>
                  <td>{tournament.winner_nickname || '-'}</td>
                  <td>{tournament.runner_up_nickname || '-'}</td>
                  <td>{formatDate(tournament.updated_at)}</td>
                  <td className="actions-cell">
                    <button
                      onClick={() => handleViewDetails(tournament.id)}
                      className="btn-view"
                    >
                      {t('tournaments.view_details')}
                    </button>
                    {onEdit && (
                      <button
                        onClick={() => onEdit(tournament.id)}
                        className="btn-edit"
                      >
                        {t('edit')}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(tournament.id)}
                        className="btn-delete"
                      >
                        {t('delete')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-data">{t('no_data')}</p>
        )}
      </section>

      {/* Pagination Controls - Bottom */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="page-btn"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            {t('pagination_first')}
          </button>
          <button
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            {t('pagination_prev')}
          </button>

          <div className="page-info">
            {t('pagination_page_info', { page: currentPage, totalPages })}
          </div>

          <button
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            {t('pagination_next')}
          </button>
          <button
            className="page-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            {t('pagination_last')}
          </button>
        </div>
      )}
    </div>
  );
};

export default TournamentList;
