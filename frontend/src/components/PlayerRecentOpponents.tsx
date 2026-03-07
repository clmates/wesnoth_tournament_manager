import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

interface Props {
  playerId: string;
  limit?: number;
}

const PlayerRecentOpponents: React.FC<Props> = ({ playerId, limit = 10 }) => {
  const { t } = useTranslation();
  const [opponents, setOpponents] = useState<RecentOpponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOpponents = async () => {
      try {
        setLoading(true);
        console.log('PlayerRecentOpponents: Fetching for playerId:', playerId, 'limit:', limit);
        const data = await playerStatisticsService.getRecentOpponents(playerId, limit);
        console.log('PlayerRecentOpponents: Raw data received:', data);
        console.log('PlayerRecentOpponents: Data length:', data?.length);
        console.log('PlayerRecentOpponents: Data is array:', Array.isArray(data));
        
        // Convert string numbers to actual numbers
        console.log('PlayerRecentOpponents: Starting conversion...');
        const converted = (data || []).map((item: any) => {
          console.log('PlayerRecentOpponents: Converting item:', item);
          const result = {
            ...item,
            winrate: typeof item.winrate === 'string' ? parseFloat(item.winrate) : item.winrate,
            total_games: typeof item.total_games === 'string' ? parseInt(item.total_games) : item.total_games,
            wins: typeof item.wins === 'string' ? parseInt(item.wins) : item.wins,
            losses: typeof item.losses === 'string' ? parseInt(item.losses) : item.losses,
          };
          console.log('PlayerRecentOpponents: Converted item:', result);
          return result;
        });
        console.log('PlayerRecentOpponents: All converted data:', converted);
        console.log('PlayerRecentOpponents: About to setOpponents');
        setOpponents(converted);
        console.log('PlayerRecentOpponents: setOpponents called successfully');
      } catch (err) {
        console.error('PlayerRecentOpponents: Error in catch block:', err);
        setError('Error loading recent opponents');
      } finally {
        console.log('PlayerRecentOpponents: Finally block, setting loading to false');
        setLoading(false);
      }
    };

    console.log('PlayerRecentOpponents: useEffect triggered with playerId:', playerId);
    fetchOpponents();
  }, [playerId, limit]);

  console.log('Rendering PlayerRecentOpponents with opponents:', opponents);
  console.log('Loading:', loading, 'Error:', error);

  if (loading) return <div className="max-w-6xl mx-auto p-8 bg-white rounded-lg shadow-md"><p className="text-gray-600">{t('loading')}</p></div>;
  if (error) return <div className="max-w-6xl mx-auto p-8 bg-white rounded-lg shadow-md border border-red-200"><p className="text-red-600">{error}</p></div>;

  return (
    <div className="max-w-6xl mx-auto">
      <h3 className="text-2xl font-semibold text-gray-800 mb-6">{t('recent_opponents') || 'Recent Opponents'}</h3>
      
      {opponents.length === 0 ? (
        <p className="text-center text-gray-500 italic py-8">{t('no_data') || 'No data available'}</p>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th>{t('player') || 'Player'}</th>
                <th>{t('games') || 'Games'}</th>
                <th>{t('wins') || 'Wins'}</th>
                <th>{t('losses') || 'Losses'}</th>
                <th>{t('winrate') || 'W/R %'}</th>
                <th>ELO Gained</th>
                <th>ELO Lost</th>
              </tr>
            </thead>
            <tbody>
              {opponents.map((opponent) => (
                <tr key={opponent.opponent_id}>
                  <td className="px-4 py-3 font-semibold text-gray-700">
                    {opponent.opponent_name}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {opponent.total_games}
                  </td>
                  <td className="px-4 py-3 text-center text-green-600 font-semibold">
                    {opponent.wins}
                  </td>
                  <td className="px-4 py-3 text-center text-red-600 font-semibold">
                    {opponent.losses}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${
                      typeof opponent.winrate === 'number' 
                        ? (opponent.winrate > 55 ? 'text-green-600' : opponent.winrate < 45 ? 'text-red-600' : 'text-gray-600')
                        : (parseFloat(opponent.winrate as string) > 55 ? 'text-green-600' : parseFloat(opponent.winrate as string) < 45 ? 'text-red-600' : 'text-gray-600')
                    }`}>
                      {typeof opponent.winrate === 'number' 
                        ? opponent.winrate.toFixed(1)
                        : parseFloat(opponent.winrate as string).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-green-600 font-semibold">
                    +{typeof opponent.elo_gained === 'number' 
                      ? opponent.elo_gained.toFixed(2)
                      : parseFloat(opponent.elo_gained as string).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center text-red-600 font-semibold">
                    -{typeof opponent.elo_lost === 'number' 
                      ? opponent.elo_lost.toFixed(2)
                      : parseFloat(opponent.elo_lost as string).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlayerRecentOpponents;
