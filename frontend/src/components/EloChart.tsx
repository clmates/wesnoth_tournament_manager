import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/EloChart.css';

interface EloChartProps {
  matches: any[];
  currentPlayerId: string;
}

const EloChart: React.FC<EloChartProps> = ({ matches, currentPlayerId }) => {
  const chartData = useMemo(() => {
    if (!matches || matches.length === 0) return [];

    // Sort matches by date ascending (oldest first)
    const sortedMatches = [...matches].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Build ELO evolution data
    const data = sortedMatches.map((match, index) => {
      const isWinner = match.winner_id === currentPlayerId;
      const currentElo = isWinner ? match.winner_elo_after : match.loser_elo_after;
      const opponent = isWinner ? match.loser_nickname : match.winner_nickname;
      const result = isWinner ? 'W' : 'L';

      return {
        date: new Date(match.created_at).toLocaleDateString('es-ES', { 
          month: 'short', 
          day: 'numeric'
        }),
        elo: currentElo || 1200,
        opponent: opponent,
        result: result,
        matchId: match.id,
      };
    });

    return data;
  }, [matches, currentPlayerId]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="elo-chart-container">
        <h3>ELO Evolution</h3>
        <div className="no-data-message">No match data available</div>
      </div>
    );
  }

  const minElo = Math.min(...chartData.map(d => d.elo)) - 50;
  const maxElo = Math.max(...chartData.map(d => d.elo)) + 50;

  return (
    <div className="elo-chart-container">
      <h3>ELO Evolution</h3>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
            <XAxis 
              dataKey="date" 
              stroke="#666"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              stroke="#666"
              domain={[Math.max(minElo, 800), maxElo]}
              tick={{ fontSize: 12 }}
              label={{ value: 'ELO Rating', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '8px'
              }}
              formatter={(value: any) => [`${value} ELO`, 'Rating']}
              labelFormatter={(label: string) => `Date: ${label}`}
            />
            <Line 
              type="monotone" 
              dataKey="elo" 
              stroke="#2196F3" 
              dot={{ fill: '#2196F3', r: 4 }}
              activeDot={{ r: 6 }}
              strokeWidth={2}
              isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-info">
        <div className="info-item">
          <span className="label">Total Matches:</span>
          <span className="value">{chartData.length}</span>
        </div>
        <div className="info-item">
          <span className="label">Current ELO:</span>
          <span className="value">{chartData[chartData.length - 1]?.elo || 'N/A'}</span>
        </div>
        <div className="info-item">
          <span className="label">ELO Range:</span>
          <span className="value">{Math.min(...chartData.map(d => d.elo))} - {Math.max(...chartData.map(d => d.elo))}</span>
        </div>
      </div>
    </div>
  );
};

export default EloChart;
