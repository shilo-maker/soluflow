import React, { useState, useEffect, useRef } from 'react';
import { Settings, User, Globe, Palette, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme, GRADIENT_PRESETS } from '../contexts/ThemeContext';
import api from '../services/api';
import offlineQueue from '../utils/offlineQueue';
import { compressAvatar, getInitials, getAvatarColor } from '../utils/imageUtils';
import AvatarCropModal from '../components/AvatarCropModal';
import './UserSettings.css';

const UserSettings = () => {
  const { user, updateUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, updateTheme, resetTheme, defaultTheme } = useTheme();

  const [nameHe, setNameHe] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState(null);

  const [selectedLanguage, setSelectedLanguage] = useState(user?.language || language || 'en');
  const [themeSettings, setThemeSettings] = useState({
    gradientPreset: theme.gradientPreset || 'warm',
    textColor: theme.textColor,
    chordColor: theme.chordColor,
    chordSize: theme.chordSize
  });
  const [loading, setLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [themeMsg, setThemeMsg] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState(null);
  const [cropFile, setCropFile] = useState(null);
  const [cropImageUrl, setCropImageUrl] = useState(null);
  const avatarInputRef = useRef(null);

  // Initialize name fields from user data
  useEffect(() => {
    if (user) {
      setNameHe(user.name_he || '');
      setNameEn(user.name_en || '');
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveName = async () => {
    setNameSaving(true);
    setNameMsg(null);
    try {
      await api.put('/auth/preferences', { name_he: nameHe, name_en: nameEn });
      if (updateUser) updateUser({ name_he: nameHe, name_en: nameEn });
      setNameMsg({ type: 'success', text: t('userSettings.nameSaved') });
    } catch (error) {
      const isOffline = !navigator.onLine || error?.error === 'No response from server';
      if (isOffline) {
        if (updateUser) updateUser({ name_he: nameHe, name_en: nameEn });
        offlineQueue.enqueue({ method: 'PUT', url: '/auth/preferences', data: { name_he: nameHe, name_en: nameEn } }).catch(() => {});
        setNameMsg({ type: 'success', text: t('userSettings.nameSaved') + ' (offline)' });
      } else {
        setNameMsg({ type: 'error', text: error.response?.data?.error || t('userSettings.errorMessage') });
      }
    } finally {
      setNameSaving(false);
    }
  };

  // Update theme settings when theme context changes
  useEffect(() => {
    setThemeSettings({
      gradientPreset: theme.gradientPreset || 'warm',
      textColor: theme.textColor,
      chordColor: theme.chordColor,
      chordSize: theme.chordSize
    });
  }, [theme]);

  const handleLanguageSwitch = async (lang) => {
    setSelectedLanguage(lang);
    setProfileMsg(null);
    try {
      await setLanguage(lang); // LanguageContext handles API + offline queue
      if (updateUser) updateUser({ language: lang });
      setProfileMsg({ type: 'success', text: t('userSettings.successMessage') });
    } catch (error) {
      setProfileMsg({ type: 'error', text: error.response?.data?.error || t('userSettings.errorMessage') });
    }
  };

  const handleThemeChange = (field, value) => {
    setThemeSettings(prev => ({ ...prev, [field]: value }));
    setThemeMsg(null);
  };

  const handleSaveTheme = async () => {
    setLoading(true);
    setThemeMsg(null);
    try {
      await updateTheme(themeSettings);
      setThemeMsg({ type: 'success', text: t('userSettings.themeSuccessMessage') });
    } catch (error) {
      setThemeMsg({ type: 'error', text: error.response?.data?.error || t('userSettings.themeErrorMessage') });
    } finally {
      setLoading(false);
    }
  };

  const handleResetTheme = async () => {
    setLoading(true);
    setThemeMsg(null);
    try {
      await resetTheme();
      setThemeSettings(defaultTheme);
      setThemeMsg({ type: 'success', text: t('userSettings.themeResetMessage') });
    } catch (error) {
      setThemeMsg({ type: 'error', text: t('userSettings.themeErrorMessage') });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = '';
    setCropFile(file);
    setCropImageUrl(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (croppedAreaPixels) => {
    if (!cropFile) return;
    if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
    setCropImageUrl(null);
    setAvatarLoading(true);
    setAvatarMsg(null);
    try {
      const base64 = await compressAvatar(cropFile, 128, 0.6, croppedAreaPixels);
      const response = await api.put('/auth/preferences', { avatar_url: base64 });
      if (updateUser) updateUser({ avatar_url: response.data.avatar_url });
      setAvatarMsg({ type: 'success', text: t('userSettings.avatarUpdated') || 'Profile photo updated' });
    } catch (error) {
      setAvatarMsg({ type: 'error', text: error.response?.data?.error || 'Failed to update photo' });
    } finally {
      setAvatarLoading(false);
      setCropFile(null);
    }
  };

  const handleCropCancel = () => {
    if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
    setCropImageUrl(null);
    setCropFile(null);
  };

  const handleAvatarRemove = async () => {
    setAvatarLoading(true);
    setAvatarMsg(null);
    try {
      const response = await api.put('/auth/preferences', { avatar_url: null });
      if (updateUser) updateUser({ avatar_url: response.data.avatar_url });
      setAvatarMsg({ type: 'success', text: t('userSettings.avatarRemoved') || 'Profile photo removed' });
    } catch (error) {
      setAvatarMsg({ type: 'error', text: error.response?.data?.error || 'Failed to remove photo' });
    } finally {
      setAvatarLoading(false);
    }
  };

  return (
    <div className="user-settings-page">
      <div className="user-settings-container">
        {/* Page Header */}
        <div className="settings-page-header">
          <h1 className="settings-page-title">
            <Settings size={28} />
            {t('userSettings.title')}
          </h1>
          <p className="settings-page-subtitle">{t('userSettings.subtitle') || 'Manage your profile and preferences'}</p>
        </div>

        {/* Profile Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <User size={20} className="settings-card-icon" />
            <h2 className="settings-card-title">{t('userSettings.profile')}</h2>
          </div>

          <div className="profile-row">
            <div className="avatar-upload-area">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.username} className="avatar-preview" />
              ) : (
                <div
                  className="avatar-preview avatar-initials"
                  style={{ backgroundColor: getAvatarColor(user?.username || user?.email || '') }}
                >
                  {getInitials(user?.username || user?.email || '?')}
                </div>
              )}
              <div className="avatar-actions">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                />
                <button
                  type="button"
                  className="btn-avatar-change"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarLoading}
                >
                  {avatarLoading ? (t('userSettings.saving') || '...') : (t('userSettings.changePhoto') || 'Change Photo')}
                </button>
                {user?.avatar_url && (
                  <button
                    type="button"
                    className="btn-avatar-remove"
                    onClick={handleAvatarRemove}
                    disabled={avatarLoading}
                  >
                    {t('userSettings.removePhoto') || 'Remove'}
                  </button>
                )}
              </div>
            </div>
            <div className="profile-info">
              <p className="profile-email">{user?.email}</p>
              <p className="profile-role">{user?.role}</p>
            </div>
          </div>

          {avatarMsg && (
            <p className={`settings-feedback ${avatarMsg.type}`}>{avatarMsg.text}</p>
          )}

          {/* Name Fields */}
          <div className="name-fields-section">
            <div className="name-fields-grid">
              <div className="name-field">
                <label className="name-field-label">{t('userSettings.nameHebrew') || 'Hebrew Name'}</label>
                <input
                  type="text"
                  value={nameHe}
                  onChange={(e) => setNameHe(e.target.value)}
                  dir="rtl"
                  className="name-field-input"
                />
              </div>
              <div className="name-field">
                <label className="name-field-label">{t('userSettings.nameEnglish') || 'English Name'}</label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  dir="ltr"
                  className="name-field-input"
                />
              </div>
            </div>

            {nameMsg && (
              <p className={`settings-feedback ${nameMsg.type}`}>{nameMsg.text}</p>
            )}

            <button
              type="button"
              className="btn-save-name"
              onClick={handleSaveName}
              disabled={nameSaving}
            >
              {nameSaving ? (
                <Loader2 size={16} className="spin-icon" />
              ) : (
                <Save size={16} />
              )}
              {t('userSettings.saveName') || 'Save Name'}
            </button>
          </div>
        </div>

        {/* Language Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <Globe size={20} className="settings-card-icon" />
            <h2 className="settings-card-title">{t('userSettings.language') || 'Language'}</h2>
          </div>
          <p className="settings-card-desc">{t('userSettings.languageDesc') || 'Choose your preferred interface language'}</p>
          <div className="language-toggle-group">
            <button
              type="button"
              className={`language-toggle-btn ${selectedLanguage === 'he' ? 'active' : ''}`}
              onClick={() => handleLanguageSwitch('he')}
            >
              עברית
            </button>
            <button
              type="button"
              className={`language-toggle-btn ${selectedLanguage === 'en' ? 'active' : ''}`}
              onClick={() => handleLanguageSwitch('en')}
            >
              English
            </button>
          </div>
          {profileMsg && (
            <p className={`settings-feedback ${profileMsg.type}`}>{profileMsg.text}</p>
          )}
        </div>

        {/* Theme Customization Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <Palette size={20} className="settings-card-icon" />
            <h2 className="settings-card-title">{t('userSettings.themeCustomization')}</h2>
          </div>

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

          {themeMsg && (
            <p className={`settings-feedback ${themeMsg.type}`}>{themeMsg.text}</p>
          )}

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

      {cropImageUrl && (
        <AvatarCropModal
          imageUrl={cropImageUrl}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
};

export default UserSettings;
