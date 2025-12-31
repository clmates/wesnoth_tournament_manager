import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { avatarsService, Avatar } from '../services/countryAvatarService';
import '../styles/AvatarSelector.css';

interface AvatarSelectorProps {
  value?: string;
  onChange: (avatarId: string) => void;
  disabled?: boolean;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadAvatars = async () => {
      setIsLoading(true);
      const data = await avatarsService.getAvatars();
      console.log('Loaded avatars:', data.length);
      console.log('First avatar path:', data[0]?.path);
      setAvatars(data);

      // Set preview URL for selected avatar
      if (value) {
        const selected = data.find(a => a.id === value);
        if (selected) {
          console.log('Selected avatar path:', selected.path);
          setPreviewUrl(selected.path);
        }
      }

      setIsLoading(false);
    };

    loadAvatars();
  }, [value]);

  const handleSelect = (avatarId: string) => {
    onChange(avatarId);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    console.warn(`Failed to load avatar image: ${img.src}`);
    // Don't hide, just show broken image indicator
    img.classList.add('image-error');
  };

  if (isLoading) {
    return (
      <div className="avatar-selector">
        <label>{t('profile.avatar') || 'Avatar'}</label>
        <div className="avatar-loading">
          {t('common.loading') || 'Loading...'}
        </div>
      </div>
    );
  }

  return (
    <div className="avatar-selector">
      <label>{t('profile.avatar') || 'Avatar'}</label>

      <div className="avatar-preview">
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Selected Avatar"
            className="avatar-preview-image"
            onError={handleImageError}
          />
        )}
        {!previewUrl && <div className="avatar-preview-empty">No Avatar</div>}
      </div>

      <div className="avatar-grid">
        {avatars.length === 0 ? (
          <div className="avatar-empty">
            {t('common.noResults') || 'No avatars available'}
          </div>
        ) : (
          avatars.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              className={`avatar-option ${value === avatar.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => !disabled && handleSelect(avatar.id)}
              disabled={disabled}
              title={avatar.name}
            >
              <img
                src={avatar.path}
                alt={avatar.name}
                className="avatar-option-image"
                onError={handleImageError}
              />
              <span className="avatar-option-name">{avatar.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default AvatarSelector;
