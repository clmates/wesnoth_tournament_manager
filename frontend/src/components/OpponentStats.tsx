import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PlayerLink from './PlayerLink';
import { playerStatisticsService } from '../services/playerStatisticsService';

interface RecentOpponent {
  opponent_id: string;
  opponent_name: string;
  total_games: number;
  wins: number;
  losses: number;
  winrate: number | string;
  current_elo: number;
  elo_gained: number | string;
  elo_lost: number | string;
  last_elo_against_me: number | string;
  last_match_date: string;
}

interface OpponentStatsProps {
  matches: any[];
  currentPlayerId: string;
}

const OpponentStats: React.FC<OpponentStatsProps> = ({ matches, currentPlayerId }) => {
  const { t } = useTranslation();
  const [opponents, setOpponents] = useState<RecentOpponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetchOpponents = async () => {
      try {
        console.log('OpponentStats: Fetching opponents for playerId:', currentPlayerId);
        setLoading(true);
        const data = await playerStatisticsService.getRecentOpponents(currentPlayerId, 100);
        console.log('OpponentStats: Raw data received:', data);
        console.log('OpponentStats: Data length:', data?.length);
        setOpponents(data || []);
        console.log('OpponentStats: State updated with opponents:', data);
      } catch (err) {
        console.error('OpponentStats: Error fetching recent opponents:', err);
        setError('Error loading opponent data');
      } finally {
        setLoading(false);
      }
    };

    if (currentPlayerId) {
      fetchOpponents();
    } else {
      console.log('OpponentStats: No currentPlayerId provided');
    }
  }, [currentPlayerId]);

  console.log('OpponentStats: Render with opponents:', opponents, 'loading:', loading, 'error:', error);

  const handleSort = (field: string) => {
    if (sortField === field) {
      // Si ya está ordenado por este campo, cambiar dirección
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Si es un nuevo campo, ordenar descendente por defecto
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedOpponents = () => {
    if (!sortField) return opponents;

    const sorted = [...opponents].sort((a, b) => {
      let aValue: any = (a as any)[sortField];
      let bValue: any = (b as any)[sortField];

      // Convertir strings numéricos a números
      if (typeof aValue === 'string' && !isNaN(parseFloat(aValue))) {
        aValue = parseFloat(aValue);
      }
      if (typeof bValue === 'string' && !isNaN(parseFloat(bValue))) {
        bValue = parseFloat(bValue);
      }

      // Comparar valores
      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  };

  const getSortIndicator = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };


  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 my-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-6 pb-4 border-b-2 border-gray-200">{t('my_opponents') || 'My Opponents'}</h3>
        <div className="text-center text-gray-400 py-8 italic">{t('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 my-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-6 pb-4 border-b-2 border-gray-200">{t('my_opponents') || 'My Opponents'}</h3>
        <div className="text-center text-gray-400 py-8 italic">{error}</div>
      </div>
    );
  }

  if (opponents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 my-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-6 pb-4 border-b-2 border-gray-200">{t('my_opponents') || 'My Opponents'}</h3>
        <div className="text-center text-gray-400 py-8 italic">{t('no_opponent_data') || 'No opponent data available'}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 my-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-6 pb-4 border-b-2 border-gray-200">{t('my_opponents') || 'My Opponents'}</h3>
      
      <div className="overflow-x-auto rounded-lg shadow-sm">
        <table className="w-full border-collapse text-sm bg-white">
          <thead>
            <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
              <th className="px-3 py-4 text-left font-semibold text-xs uppercase tracking-wider border-b-2 border-gray-900 cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => handleSort('opponent_name')}>{t('opponent_name') || 'Opponent'}{getSortIndicator('opponent_name')}</th>
              <th className="px-3 py-4 text-center font-semibold text-xs uppercase tracking-wider border-b-2 border-gray-900 cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => handleSort('total_games')}>{t('games') || 'Games'}{getSortIndicator('total_games')}</th>
              <th className="px-3 py-4 text-center font-semibold text-xs uppercase tracking-wider border-b-2 border-gray-900 cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => handleSort('wins')}>{t('wins') || 'Wins'}{getSortIndicator('wins')}</th>
              <th className="px-3 py-4 text-center font-semibold text-xs uppercase tracking-wider border-b-2 border-gray-900 cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => handleSort('losses')}>{t('losses') || 'Losses'}{getSortIndicator('losses')}</th>
              <th className="px-3 py-4 text-center font-semibold text-xs uppercase tracking-wider border-b-2 border-gray-900 cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => handleSort('winrate')}>{t('winrate') || 'W/R %'}{getSortIndicator('winrate')}</th>
              <th className="px-3 py-4 text-center font-semibold text-xs uppercase tracking-wider border-b-2 border-gray-900 cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => handleSort('current_elo')}>{t('current_elo') || 'Current ELO'}{getSortIndicator('current_elo')}</th>
              <th className="px-3 py-4 text-center font-semibold text-xs uppercase tracking-wider border-b-2 border-gray-900 cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => handleSort('elo_gained')}>ELO Gained{getSortIndicator('elo_gained')}</th>
              <th className="px-3 py-4 text-center font-semibold text-xs uppercase tracking-wider border-b-2 border-gray-900 cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => handleSort('elo_lost')}>ELO Lost{getSortIndicator('elo_lost')}</th>
              <th className="px-3 py-4 text-center font-semibold text-xs uppercase tracking-wider border-b-2 border-gray-900 cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => handleSort('last_elo_against_me')}>Last ELO vs Me{getSortIndicator('last_elo_against_me')}</th>
              <th className="px-3 py-4 text-left font-semibold text-xs uppercase tracking-wider border-b-2 border-gray-900 cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => handleSort('last_match_date')}>{t('last_match') || 'Last Match'}{getSortIndicator('last_match_date')}</th>
            </tr>
          </thead>
          <tbody>
            {getSortedOpponents().map((opponent, index) => {
              const winrate = typeof opponent.winrate === 'string' ? parseFloat(opponent.winrate) : opponent.winrate;
              const eloGained = typeof opponent.elo_gained === 'string' ? parseFloat(opponent.elo_gained) : opponent.elo_gained;
              const eloLost = typeof opponent.elo_lost === 'string' ? parseFloat(opponent.elo_lost) : opponent.elo_lost;
              const lastEloAgainstMe = typeof opponent.last_elo_against_me === 'string' ? parseFloat(opponent.last_elo_against_me) : opponent.last_elo_against_me;

              console.log('OpponentStats: Rendering opponent row:', {
                opponent_name: opponent.opponent_name,
                total_games: opponent.total_games,
                wins: opponent.wins,
                losses: opponent.losses,
                winrate,
                current_elo: opponent.current_elo,
                eloGained,
                eloLost,
                lastEloAgainstMe,
                last_match_date: opponent.last_match_date
              });

              return (
                <tr key={opponent.opponent_id} className={`border-b border-gray-200 transition-colors hover:bg-blue-50 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                  <td className="px-3 py-3 font-semibold text-gray-800 align-middle">
                    <span className="block break-words"><PlayerLink nickname={opponent.opponent_name} userId={opponent.opponent_id} /></span>
                  </td>
                  <td className="px-3 py-3 text-center font-medium text-gray-600">
                    <strong>{opponent.total_games}</strong>
                  </td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className="inline-block px-2.5 py-1 bg-gradient-to-br from-green-100 to-green-200 text-green-800 rounded font-semibold text-xs shadow-sm">{opponent.wins}</span>
                  </td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className="inline-block px-2.5 py-1 bg-gradient-to-br from-red-100 to-red-200 text-red-800 rounded font-semibold text-xs shadow-sm">{opponent.losses}</span>
                  </td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`inline-block px-2.5 py-1 rounded font-semibold text-xs shadow-sm ${
                      winrate > 55 
                        ? 'bg-gradient-to-br from-green-100 to-green-200 text-green-900' 
                        : winrate < 45 
                          ? 'bg-gradient-to-br from-red-100 to-red-200 text-red-900' 
                          : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700'
                    }`}>
                      {winrate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className="inline-block px-2.5 py-1 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-900 rounded font-bold shadow-sm">{opponent.current_elo}</span>
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-green-600">
                    +{eloGained.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-red-600">
                    -{eloLost.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700 font-semibold">
                    {lastEloAgainstMe.toFixed(0)}
                  </td>
                  <td className="px-3 py-3 text-gray-700 text-xs font-medium">
                    {new Date(opponent.last_match_date).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OpponentStats;
