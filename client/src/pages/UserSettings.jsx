import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme, GRADIENT_PRESETS } from '../contexts/ThemeContext';
import api from '../services/api';
import './UserSettings.css';

const UserSettings = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, updateTheme, resetTheme, defaultTheme } = useTheme();

  const [selectedLanguage, setSelectedLanguage] = useState(user?.language || 'en');
  const [themeSettings, setThemeSettings] = useState({
    gradientPreset: theme.gradientPreset || 'sunset',
    textColor: theme.textColor,
    chordColor: theme.chordColor,
    chordSize: theme.chordSize
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Update theme settings when theme context changes
  useEffect(() => {
    setThemeSettings({
      gradientPreset: theme.gradientPreset || 'sunset',
      textColor: theme.textColor,
      chordColor: theme.chordColor,
      chordSize: theme.chordSize
    });
  }, [theme]);

  const handleLanguageChange = (e) => {
    setSelectedLanguage(e.target.value);
    setMessage({ type: '', text: '' });
  };

  const handleThemeChange = (field, value) => {
    setThemeSettings(prev => ({
      ...prev,
      [field]: value
    }));
    setMessage({ type: '', text: '' });
  };

  const handleSaveProfile = async (e) => {
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

  const handleSaveTheme = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await updateTheme(themeSettings);
      setMessage({ type: 'success', text: t('userSettings.themeSuccessMessage') });
    } catch (error) {
      console.error('Failed to update theme:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.error || t('userSettings.themeErrorMessage')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetTheme = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await resetTheme();
      setThemeSettings(defaultTheme);
      setMessage({ type: 'success', text: t('userSettings.themeResetMessage') });
    } catch (error) {
      console.error('Failed to reset theme:', error);
      setMessage({
        type: 'error',
        text: t('userSettings.themeErrorMessage')
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

          {/* Profile Settings Section */}
          <form onSubmit={handleSaveProfile}>
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

          {/* Theme Customization Section */}
          <div className="settings-section theme-section">
            <h2 className="section-title">{t('userSettings.themeCustomization')}</h2>

            <div className="theme-controls">
              <div className="form-group">
                <label>{t('userSettings.gradientPreset')}</label>
                <div className="gradient-preset-grid">
                  {Object.entries(GRADIENT_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      className={`gradient-preset-button ${themeSettings.gradientPreset === key ? 'selected' : ''}`}
                      onClick={() => handleThemeChange('gradientPreset', key)}
                      disabled={loading}
                      style={{
                        background: `linear-gradient(-45deg, ${preset.colors.join(', ')})`,
                        backgroundSize: '200% 200%'
                      }}
                    >
                      <span className="preset-name">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="textColor">{t('userSettings.textColor')}</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    id="textColor"
                    value={themeSettings.textColor}
                    onChange={(e) => handleThemeChange('textColor', e.target.value)}
                    disabled={loading}
                  />
                  <input
                    type="text"
                    value={themeSettings.textColor}
                    onChange={(e) => handleThemeChange('textColor', e.target.value)}
                    disabled={loading}
                    className="color-text-input"
                    maxLength="7"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="chordColor">{t('userSettings.chordColor')}</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    id="chordColor"
                    value={themeSettings.chordColor}
                    onChange={(e) => handleThemeChange('chordColor', e.target.value)}
                    disabled={loading}
                  />
                  <input
                    type="text"
                    value={themeSettings.chordColor}
                    onChange={(e) => handleThemeChange('chordColor', e.target.value)}
                    disabled={loading}
                    className="color-text-input"
                    maxLength="7"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="chordSize">
                  {t('userSettings.chordSize')} ({themeSettings.chordSize}x)
                </label>
                <input
                  type="range"
                  id="chordSize"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={themeSettings.chordSize}
                  onChange={(e) => handleThemeChange('chordSize', parseFloat(e.target.value))}
                  disabled={loading}
                  className="size-slider"
                />
                <div className="slider-labels">
                  <span>0.5x</span>
                  <span>1.0x</span>
                  <span>2.0x</span>
                  <span>3.0x</span>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="theme-preview">
              <h3 className="preview-title">{t('userSettings.preview')}</h3>
              <div
                className="preview-content"
                style={{
                  backgroundColor: '#ffffff',
                  color: themeSettings.textColor,
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #ddd'
                }}
              >
                <div className="preview-verse">
                  <div className="preview-line">
                    <span
                      className="preview-chord"
                      style={{
                        color: themeSettings.chordColor,
                        fontSize: `${themeSettings.chordSize}em`,
                        fontWeight: 'bold'
                      }}
                    >
                      C
                    </span>
                    <span style={{ color: themeSettings.textColor }}>
                      {t('userSettings.previewLyrics1')}
                    </span>
                  </div>
                  <div className="preview-line">
                    <span
                      className="preview-chord"
                      style={{
                        color: themeSettings.chordColor,
                        fontSize: `${themeSettings.chordSize}em`,
                        fontWeight: 'bold'
                      }}
                    >
                      Am
                    </span>
                    <span style={{ color: themeSettings.textColor }}>
                      {t('userSettings.previewLyrics2')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="theme-actions">
              <button
                type="button"
                className="btn-reset"
                onClick={handleResetTheme}
                disabled={loading}
              >
                {t('userSettings.resetTheme')}
              </button>
              <button
                type="button"
                className="btn-save"
                onClick={handleSaveTheme}
                disabled={loading}
              >
                {loading ? t('userSettings.saving') : t('userSettings.saveTheme')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;
