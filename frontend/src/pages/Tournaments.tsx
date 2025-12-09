import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { publicService } from '../services/api';
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

interface FilterState {
  name: string;
  status: string;
  type: string;
}

const Tournaments: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Input state (updates immediately as user types)
  const [inputFilters, setInputFilters] = useState<FilterState>({
    name: '',
    status: '',
    type: '',
  });
  
  // Applied filters state (updates with debounce)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    name: '',
    status: '',
    type: '',
  });
  
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce filter changes
  const handleFilterInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setInputFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new timer to apply filters after 500ms
    debounceTimer.current = setTimeout(() => {
      setAppliedFilters(prev => ({
        ...prev,
        [name]: value,
      }));
      setCurrentPage(1);
    }, 500);
  };

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await publicService.getTournaments(currentPage, appliedFilters);
        setTournaments(res.data?.data || []);
        
        // Set pagination info
        if (res.data?.pagination) {
          setTotalPages(res.data.pagination.totalPages);
          setTotal(res.data.pagination.total);
        }
      } catch (err: any) {
        console.error('Error fetching tournaments:', err);
        setError('Error loading tournaments');
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, [currentPage, appliedFilters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // update both input and applied filters immediately for non-debounced use
    setInputFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    setAppliedFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setInputFilters({
      name: '',
      status: '',
      type: '',
    });
    setAppliedFilters({
      name: '',
      status: '',
      type: '',
    });
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': 'En preparación',
      'active': 'En curso',
      'completed': 'Completado',
      'cancelled': 'Cancelado',
      'registration_open': 'Registration Open',
      'registration_closed': 'Registration Closed',
      'prepared': 'Prepared',
      'approved': 'Approved',
      'in_progress': 'In Progress',
      'finished': 'Finished',
    };
    return statusMap[status] || status;
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
    return <div className="admin-container"><p>Loading...</p></div>;
  }

  return (
    <div className="admin-container">
      <h1>{t('tournaments', 'Tournaments')}</h1>

      {error && <p className="error-message">{error}</p>}

      {/* Pagination Controls - Top */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button 
            className="page-btn"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            First
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            ← Prev
          </button>
          
          <div className="page-info">
            Page <span className="current-page">{currentPage}</span> of <span className="total-pages">{totalPages}</span>
          </div>
          
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="name">Tournament Name</label>
          <input
            type="text"
            id="name"
            name="name"
            placeholder="Search by name..."
            value={inputFilters.name}
            onChange={handleFilterInputChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="status">Status</label>
          <select 
            id="status"
            name="status"
            value={inputFilters.status}
            onChange={handleFilterInputChange}
          >
            <option value="">All Statuses</option>
            <option value="registration_open">Registration Open</option>
            <option value="registration_closed">Registration Closed</option>
            <option value="prepared">Prepared</option>
            <option value="approved">Approved</option>
            <option value="in_progress">In Progress</option>
            <option value="finished">Finished</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="type">Tournament Type</label>
          <select 
            id="type"
            name="type"
            value={inputFilters.type}
            onChange={handleFilterInputChange}
          >
            <option value="">All Types</option>
            <option value="elimination">Elimination</option>
            <option value="league">League</option>
            <option value="swiss">Swiss</option>
          </select>
        </div>

        <button className="reset-btn" onClick={handleResetFilters}>
          Reset Filters
        </button>
      </div>

      <div className="tournaments-info">
        <p>Showing {tournaments.length} of {total} total tournaments (Page {currentPage} of {totalPages})</p>
      </div>

      <section className="tournaments-section">
        {tournaments.length > 0 ? (
          <table className="tournaments-table">
            <thead>
              <tr>
                <th>Tournament Name</th>
                <th>Organizer</th>
                <th>Status</th>
                <th>Type</th>
                <th>Winner</th>
                <th>Runner Up</th>
                <th>Last Updated</th>
                <th>Action</th>
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
                  <td>
                    <button 
                      onClick={() => navigate(`/tournament/${tournament.id}`, { state: { from: 'tournaments' } })}
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

      {/* Pagination Controls - Bottom */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button 
            className="page-btn"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            First
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            ← Prev
          </button>
          
          <div className="page-info">
            Page <span className="current-page">{currentPage}</span> of <span className="total-pages">{totalPages}</span>
          </div>
          
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
};

export default Tournaments;
