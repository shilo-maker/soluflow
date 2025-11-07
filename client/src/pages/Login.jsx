import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { GRADIENT_PRESETS } from '../contexts/ThemeContext';
import './Login.css';

// Helper function to convert hex color to CSS filter
const getColorFilter = (hexColor) => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const hue = getHueRotate(r, g, b);
  return `brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(${hue}deg)`;
};

const getHueRotate = (r, g, b) => {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      hue = 60 * (((gNorm - bNorm) / delta) % 6);
    } else if (max === gNorm) {
      hue = 60 * (((bNorm - rNorm) / delta) + 2);
    } else {
      hue = 60 * (((rNorm - gNorm) / delta) + 4);
    }
  }
  return Math.round(hue);
};

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, setLanguage } = useLanguage();
  const { theme } = useTheme();

  // Get current theme accent color
  const currentPreset = GRADIENT_PRESETS[theme?.gradientPreset] || GRADIENT_PRESETS.professional;

  // Set language to Hebrew by default on mount
  useEffect(() => {
    setLanguage('he');
  }, [setLanguage]);

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Keep error visible so user can see what went wrong while fixing input
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous error
    setLoading(true);

    try {
      if (!formData.email || !formData.password) {
        setError('Please enter both email and password');
        setLoading(false);
        return;
      }

      await login(formData.email, formData.password);
      // Success - navigate to home
      setLoading(false);
      navigate('/home');
    } catch (err) {
      console.error('Login error:', err);

      // Extract error message
      let errorMessage = 'Login failed. Please check your credentials.';
      if (err.response?.data?.error) {
        errorMessage = String(err.response.data.error);
      } else if (err.message) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <button className="btn-back-to-songs" onClick={() => navigate('/')}>
          ← {t('login.browseSongs')}
        </button>
        <div className="login-header">
          <img
            src="/neutral_logo.png"
            alt="SoluFlow"
            className="login-logo"
            style={{ filter: getColorFilter(currentPreset.accentColor) }}
          />
          <p>{t('login.subtitle')}</p>
        </div>

        <div className="login-card">
          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">{t('login.emailLabel')}</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">{t('login.passwordLabel')}</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t('login.passwordPlaceholder')}
                autoComplete="current-password"
                disabled={loading}
              />
              <div className="forgot-password-link">
                <Link to="/forgot-password">{t('login.forgotPassword')}</Link>
              </div>
            </div>

            <button
              type="submit"
              className="btn-login"
              disabled={loading}
            >
              {loading ? t('login.loggingIn') : t('login.loginButton')}
            </button>
          </form>

          <div className="login-footer">
            <p>
              {t('login.noAccount')} <Link to="/register">{t('login.registerLink')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
