import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { matchService, userService } from '../services/api';
import MainLayout from '../components/MainLayout';
import OpponentSelector from '../components/OpponentSelector';
import '../styles/ReportMatch.css';

const ReportMatch: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [maps, setMaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    opponent_id: '',
    map: '',
    winner_faction: '',
    loser_faction: '',
    comments: '',
    rating: '',
    replay: null as File | null,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        // For now, we'll have predefined maps - in a real app, fetch from API
        setMaps(['Map 1', 'Map 2', 'Map 3', 'Siege', 'Dueling Grounds']);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Error loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData((prev) => ({
        ...prev,
        replay: e.target.files![0],
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.opponent_id || !formData.map || !formData.winner_faction || !formData.loser_faction) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const data = new FormData();
      data.append('opponent_id', formData.opponent_id);
      data.append('map', formData.map);
      data.append('winner_faction', formData.winner_faction);
      data.append('loser_faction', formData.loser_faction);
      data.append('comments', formData.comments);
      if (formData.rating) {
        data.append('rating', formData.rating);
      }
      if (formData.replay) {
        data.append('replay', formData.replay);
      }

      const response = await matchService.reportMatch(data);
      setMessage('Match reported successfully! Redirecting...');
      setFormData({
        opponent_id: '',
        map: '',
        winner_faction: '',
        loser_faction: '',
        comments: '',
        rating: '',
        replay: null,
      });
      
      // Redirect to home after 1.5 seconds using navigate instead of window.location.href
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error reporting match');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <MainLayout><div className="report-match-container"><p>Loading...</p></div></MainLayout>;
  }

  if (!isAuthenticated) {
    return <MainLayout><div className="report-match-container"><p>Please log in to report matches</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="report-match-container">
      <div className="report-match-form-wrapper">
        <h1>Report Match Result</h1>
        
        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}

        <form onSubmit={handleSubmit} className="report-match-form">
          <div className="form-group">
            <label htmlFor="opponent_id">Opponent *</label>
            <OpponentSelector
              value={formData.opponent_id}
              onChange={(userId) => {
                setFormData((prev) => ({
                  ...prev,
                  opponent_id: userId,
                }));
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="map">Map *</label>
            <select
              id="map"
              name="map"
              value={formData.map}
              onChange={handleInputChange}
              required
            >
              <option value="">Select map...</option>
              {maps.map((map) => (
                <option key={map} value={map}>
                  {map}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="winner_faction">Your Faction *</label>
              <select
                id="winner_faction"
                name="winner_faction"
                value={formData.winner_faction}
                onChange={handleInputChange}
                required
              >
                <option value="">Select faction...</option>
                <option value="Elves">Elves</option>
                <option value="Humans">Humans</option>
                <option value="Orcs">Orcs</option>
                <option value="Undead">Undead</option>
                <option value="Dwarves">Dwarves</option>
                <option value="Drakes">Drakes</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="loser_faction">Opponent Faction *</label>
              <select
                id="loser_faction"
                name="loser_faction"
                value={formData.loser_faction}
                onChange={handleInputChange}
                required
              >
                <option value="">Select faction...</option>
                <option value="Elves">Elves</option>
                <option value="Humans">Humans</option>
                <option value="Orcs">Orcs</option>
                <option value="Undead">Undead</option>
                <option value="Dwarves">Dwarves</option>
                <option value="Drakes">Drakes</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="comments">Comments</label>
            <textarea
              id="comments"
              name="comments"
              value={formData.comments}
              onChange={handleInputChange}
              placeholder="Any additional comments about the match..."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label htmlFor="rating">Rate Your Opponent (1-5)</label>
            <select
              id="rating"
              name="rating"
              value={formData.rating}
              onChange={handleInputChange}
            >
              <option value="">No rating</option>
              <option value="1">1 - Poor</option>
              <option value="2">2 - Fair</option>
              <option value="3">3 - Good</option>
              <option value="4">4 - Very Good</option>
              <option value="5">5 - Excellent</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="replay">Replay File</label>
            <input
              type="file"
              id="replay"
              name="replay"
              onChange={handleFileChange}
              accept=".gz"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={() => navigate('/')}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={submitting}
            >
              {submitting ? 'Reporting...' : 'Report Match'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </MainLayout>
  );
};

export default ReportMatch;
