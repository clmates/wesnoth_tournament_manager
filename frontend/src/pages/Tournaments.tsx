import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { publicService } from '../services/api';
import TournamentList, { Tournament, FilterState } from '../components/TournamentList';

const Tournaments: React.FC = () => {
  const { t } = useTranslation();
  
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
  const handleFilterInputChange = (filters: FilterState) => {
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new timer to apply filters after 500ms
    debounceTimer.current = setTimeout(() => {
      setAppliedFilters(filters);
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

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <TournamentList
      title={t('tournament_title')}
      tournaments={tournaments}
      loading={loading}
      error={error}
      currentPage={currentPage}
      totalPages={totalPages}
      total={total}
      showFilters={true}
      onFilterChange={handleFilterInputChange}
      onPageChange={handlePageChange}
    />
  );
};

export default Tournaments;
