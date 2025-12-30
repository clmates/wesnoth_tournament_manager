/**
 * Example integration of CountrySelector and AvatarSelector components
 * This shows how to integrate them into your existing pages
 */

// Example 1: Register.tsx integration
export const RegisterExample = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    nickname: '',
    email: '',
    password: '',
    language: 'en',
    country: '', // NEW
    avatar: '', // NEW
    discord_id: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authService.register(formData); // Backend now accepts country & avatar
      showSuccessMessage(t('register_success'));
      // Redirect to login
    } catch (error) {
      showErrorMessage(t('register_error'));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="register-form">
      {/* Existing fields */}
      <input
        name="nickname"
        placeholder={t('register_nickname')}
        value={formData.nickname}
        onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
      />

      {/* NEW: Country and Avatar Selectors */}
      <CountrySelector
        value={formData.country}
        onChange={(country) => setFormData({ ...formData, country })}
      />

      <AvatarSelector
        value={formData.avatar}
        onChange={(avatar) => setFormData({ ...formData, avatar })}
      />

      <button type="submit">{t('register_button')}</button>
    </form>
  );
};

// Example 2: Profile.tsx integration
export const ProfileExample = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const response = await userService.getProfile();
      setProfile(response.data);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCountryChange = async (country: string) => {
    setIsSaving(true);
    try {
      const response = await userService.updateProfile({ country });
      setProfile(response.data);
      showSuccessMessage(t('profile.updated'));
    } catch (error) {
      showErrorMessage(t('profile.updateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (avatar: string) => {
    setIsSaving(true);
    try {
      const response = await userService.updateProfile({ avatar });
      setProfile(response.data);
      showSuccessMessage(t('profile.updated'));
    } catch (error) {
      showErrorMessage(t('profile.updateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div>{t('common.loading')}</div>;
  }

  return (
    <div className="profile-container">
      <h2>{t('profile.title')}</h2>

      <section className="profile-section">
        <h3>{t('profile.info_title')}</h3>
        <div className="profile-info">
          <p>
            <strong>{t('profile.label_nickname')}:</strong> {profile.nickname}
          </p>
          <p>
            <strong>{t('profile.label_email')}:</strong> {profile.email}
          </p>
          <p>
            <strong>{t('profile.label_elo')}:</strong> {profile.elo_rating}
          </p>
          <p>
            <strong>{t('profile.label_level')}:</strong> {profile.level}
          </p>
        </div>
      </section>

      {/* NEW: Country and Avatar selectors */}
      <section className="profile-section">
        <h3>{t('profile.title')}</h3>

        <CountrySelector
          value={profile.country}
          onChange={handleCountryChange}
          disabled={isSaving}
        />

        <AvatarSelector
          value={profile.avatar}
          onChange={handleAvatarChange}
          disabled={isSaving}
        />
      </section>
    </div>
  );
};

// Example 3: Rankings.tsx - Display country flags and avatars
export const RankingsExample = () => {
  const { t, i18n } = useTranslation();
  const [rankings, setRankings] = useState([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadData();
  }, [i18n.language]);

  const loadData = async () => {
    try {
      // Load countries for display
      const countriesData = await countriesService.getCountriesByLanguage(i18n.language);
      setCountries(countriesData);

      // Load rankings
      const rankingsData = await userService.getGlobalRanking(page);
      setRankings(rankingsData.data.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const getCountryFlag = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    return country ? country.flag : '🌍';
  };

  return (
    <div className="rankings-container">
      <h2>{t('ranking_title')}</h2>

      <table className="rankings-table">
        <thead>
          <tr>
            <th>{t('ranking_position')}</th>
            <th colSpan={2}>{t('ranking_player')}</th>
            <th>{t('ranking_elo')}</th>
            <th>{t('ranking_wins')}</th>
            <th>{t('ranking_losses')}</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((player, index) => (
            <tr key={player.id}>
              <td>{index + 1}</td>

              {/* Country flag and avatar column */}
              <td className="player-avatar">
                {player.avatar && (
                  <img
                    src={`/wesnoth-units/${player.avatar}.png`}
                    alt="avatar"
                    className="avatar-thumbnail"
                    title={player.avatar}
                  />
                )}
              </td>

              {/* Nickname with country flag */}
              <td className="player-info">
                <div className="player-row">
                  <span className="country-flag" title={getCountryName(player.country)}>
                    {getCountryFlag(player.country)}
                  </span>
                  <span className="player-name">{player.nickname}</span>
                </div>
              </td>

              <td>{player.elo_rating}</td>
              <td>{player.total_wins}</td>
              <td>{player.total_losses}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="pagination">
        {/* pagination controls */}
      </div>
    </div>
  );
};

// Example 4: Players.tsx - Full player grid with avatars and flags
export const PlayersExample = () => {
  const { t, i18n } = useTranslation();
  const [players, setPlayers] = useState([]);
  const [countries, setCountries] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [i18n.language]);

  const loadData = async () => {
    try {
      const [playersData, countriesData] = await Promise.all([
        userService.getAllUsers(),
        countriesService.getCountriesByLanguage(i18n.language)
      ]);
      setPlayers(playersData.data.data);
      setCountries(countriesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const getCountryInfo = (countryCode: string) => {
    return countries.find(c => c.code === countryCode) || { flag: '🌍', name: 'Unknown' };
  };

  return (
    <div className="players-container">
      <h2>{t('navbar_players')}</h2>

      <div className="players-grid">
        {players.map((player) => {
          const country = getCountryInfo(player.country);

          return (
            <div key={player.id} className="player-card">
              {/* Avatar */}
              {player.avatar && (
                <div className="card-avatar">
                  <img
                    src={`/wesnoth-units/${player.avatar}.png`}
                    alt={player.avatar}
                    className="avatar-image"
                  />
                </div>
              )}

              {/* Country flag */}
              <div className="card-flag" title={country.name}>
                {country.flag}
              </div>

              {/* Player info */}
              <h3 className="card-nickname">{player.nickname}</h3>

              <div className="card-stats">
                <p>ELO: <strong>{player.elo_rating}</strong></p>
                <p>Matches: <strong>{player.matches_played}</strong></p>
              </div>

              <a href={`/player/${player.id}`} className="card-link">
                {t('view_all')}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
};
