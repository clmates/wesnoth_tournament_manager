import React from 'react';
import '../styles/Matches.css';

interface MatchDetailsModalProps {
  match: any;
  isOpen: boolean;
  onClose: () => void;
}

const MatchDetailsModal: React.FC<MatchDetailsModalProps> = ({ match, isOpen, onClose }) => {
  if (!isOpen || !match) {
    return null;
  }

  const winnerEloChange = (match: any) => (match.winner_elo_after || 0) - (match.winner_elo_before || 0);
  const loserEloChange = (match: any) => (match.loser_elo_after || 0) - (match.loser_elo_before || 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Match Details</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="match-details-container">
            <div className="detail-header-row">
              <div className="detail-item">
                <label>Date:</label>
                <span>{new Date(match.created_at).toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <label>Map:</label>
                <span>{match.map}</span>
              </div>
              <div className="detail-item">
                <label>Status:</label>
                <span className={`status-badge ${match.status || 'unconfirmed'}`}>
                  {match.status === 'confirmed' && '✓ Confirmed'}
                  {match.status === 'unconfirmed' && '⏳ Unconfirmed'}
                  {match.status === 'disputed' && '⚠ Disputed'}
                  {match.status === 'cancelled' && '✗ Cancelled'}
                  {!match.status && '⏳ Unconfirmed'}
                </span>
              </div>
            </div>

            <div className="match-stats-grid">
              <div className="grid-header label-col">Statistic</div>
              <div className="grid-header winner-col">Winner</div>
              <div className="grid-header loser-col">Loser</div>

              <div className="grid-cell label-cell">Player</div>
              <div className="grid-cell winner-cell">{match.winner_nickname}</div>
              <div className="grid-cell loser-cell">{match.loser_nickname}</div>

              <div className="grid-cell label-cell">Faction</div>
              <div className="grid-cell winner-cell"><span className="faction-badge">{match.winner_faction}</span></div>
              <div className="grid-cell loser-cell"><span className="faction-badge">{match.loser_faction}</span></div>

              <div className="grid-cell label-cell">Rating</div>
              <div className="grid-cell winner-cell">{match.winner_rating || '-'}</div>
              <div className="grid-cell loser-cell">{match.loser_rating || '-'}</div>

              <div className="grid-cell label-cell">ELO Before</div>
              <div className="grid-cell winner-cell">{match.winner_elo_before || 'N/A'}</div>
              <div className="grid-cell loser-cell">{match.loser_elo_before || 'N/A'}</div>

              <div className="grid-cell label-cell">ELO After</div>
              <div className="grid-cell winner-cell">{match.winner_elo_after || 'N/A'}</div>
              <div className="grid-cell loser-cell">{match.loser_elo_after || 'N/A'}</div>

              <div className="grid-cell label-cell">ELO Change</div>
              <div className="grid-cell winner-cell">
                <span className={`rating-change ${winnerEloChange(match) >= 0 ? 'positive' : 'negative'}`}>
                  {winnerEloChange(match) >= 0 ? '+' : ''}{winnerEloChange(match)}
                </span>
              </div>
              <div className="grid-cell loser-cell">
                <span className={`rating-change ${loserEloChange(match) >= 0 ? 'positive' : 'negative'}`}>
                  {loserEloChange(match) >= 0 ? '+' : ''}{loserEloChange(match)}
                </span>
              </div>

              {(match.winner_comments || match.loser_comments) && (
                <>
                  <div className="grid-cell label-cell">Comments</div>
                  <div className="grid-cell winner-cell" title={match.winner_comments || undefined}>{match.winner_comments || '-'}</div>
                  <div className="grid-cell loser-cell" title={match.loser_comments || undefined}>{match.loser_comments || '-'}</div>
                </>
              )}

              {match.replay_file_path && (
                <>
                  <div className="grid-cell label-cell">Replay</div>
                  <div className="grid-cell winner-cell" style={{ gridColumn: '2 / 4' }}>
                    <button 
                      className="download-btn-compact"
                      onClick={() => {
                        onClose();
                      }}
                      title={`Downloads: ${match.replay_downloads || 0}`}
                    >
                      ⬇️ Download ({match.replay_downloads || 0})
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="close-modal-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default MatchDetailsModal;
