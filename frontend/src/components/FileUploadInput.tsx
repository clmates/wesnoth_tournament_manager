import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface FileUploadInputProps {
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
}

const FileUploadInput: React.FC<FileUploadInputProps> = ({ value, onChange, accept = '.gz,.bz2' }) => {
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
    <div className="flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
      />
      <button
        type="button"
        className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm"
        onClick={handleButtonClick}
      >
        {t('file_upload.select_file')}
      </button>
      <div className="min-h-5 flex items-center justify-between">
        {value ? (
          <div className="flex items-center gap-2 w-full">
            <span className="text-green-600 font-semibold text-sm overflow-hidden text-ellipsis">{value.name}</span>
            <button
              type="button"
              className="ml-auto px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-xs font-semibold"
              onClick={handleClearFile}
              title={t('file_upload.clear_file')}
            >
              ✕
            </button>
          </div>
        ) : (
          <span className="text-gray-500 text-sm">{t('report.no_file_selected')}</span>
        )}
      </div>
    </div>
  );
};

export default FileUploadInput;
