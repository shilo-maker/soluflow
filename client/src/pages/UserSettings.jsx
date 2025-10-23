import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';
import './UserSettings.css';

const UserSettings = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [selectedLanguage, setSelectedLanguage] = useState(user?.language || 'en');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleLanguageChange = (e) => {
    setSelectedLanguage(e.target.value);
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Update profile on server
      const response = await api.put('/auth/profile', {
        language: selectedLanguage
      });

      // Update language in context (this will also update the UI direction)
      await setLanguage(selectedLanguage);

      // Update user in auth context
      if (updateUser) {
        updateUser(response.data.user);
      }

      setMessage({ type: 'success', text: t('userSettings.successMessage') });
    } catch (error) {
      console.error('Failed to update settings:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.error || t('userSettings.errorMessage')
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-settings-page">
      <div className="user-settings-container">
        <button className="btn-back" onClick={() => navigate(-1)}>
          ← {t('common.back')}
        </button>
        <h1 className="user-settings-title">{t('userSettings.title')}</h1>

        <div className="user-settings-card">
          {message.text && (
            <div className={`settings-message ${message.type}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="settings-section">
              <h2 className="section-title">{t('userSettings.profile')}</h2>

              <div className="form-group">
                <label htmlFor="username">{t('userSettings.username')}</label>
                <input
                  type="text"
                  id="username"
                  value={user?.username || ''}
                  disabled
                  className="readonly-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">{t('userSettings.email')}</label>
                <input
                  type="email"
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="readonly-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="language">{t('userSettings.language')}</label>
                <select
                  id="language"
                  name="language"
                  value={selectedLanguage}
                  onChange={handleLanguageChange}
                  disabled={loading}
                  className="language-select"
                >
                  <option value="en">{t('userSettings.languageEnglish')}</option>
                  <option value="he">{t('userSettings.languageHebrew')}</option>
                </select>
              </div>
            </div>

            <div className="settings-actions">
              <button
                type="submit"
                className="btn-save"
                disabled={loading}
              >
                {loading ? t('userSettings.saving') : t('userSettings.saveChanges')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;
