import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/FileUploadInput.css';

interface FileUploadInputProps {
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
}

const FileUploadInput: React.FC<FileUploadInputProps> = ({ value, onChange, accept = '.gz' }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onChange(e.target.files[0]);
    }
  };

  const handleClearFile = () => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload-input">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        accept={accept}
        className="hidden-file-input"
      />
      <button
        type="button"
        className="file-upload-button"
        onClick={handleButtonClick}
      >
        {t('file_upload.select_file')}
      </button>
      <div className="file-info">
        {value ? (
          <div className="file-selected">
            <span className="file-name">{value.name}</span>
            <button
              type="button"
              className="file-clear-button"
              onClick={handleClearFile}
              title={t('file_upload.clear_file')}
            >
              ✕
            </button>
          </div>
        ) : (
          <span className="file-empty">{t('report.no_file_selected')}</span>
        )}
      </div>
    </div>
  );
};

export default FileUploadInput;
