import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    workspaceName: ''
  });
  const [isTeamRegistration, setIsTeamRegistration] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (isTeamRegistration && !formData.workspaceName.trim()) {
      setError('Workspace name is required when registering as part of a team');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Auto-generate username from email (part before @)
      const username = formData.email.split('@')[0];

      // For now, we'll use workspace_id = 1 (or create workspace first in future)
      // The backend expects workspaceId, but we'll need to handle workspace creation
      await register(
        formData.email,
        formData.password,
        username,
        1 // TODO: Create workspace first and use its ID
      );
      navigate('/'); // Redirect to home/library after successful registration
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-header">
          <h1>SoluFlow</h1>
          <p>Create your account</p>
        </div>

        <div className="register-card">
          {error && <div className="register-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <div className="form-group-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={isTeamRegistration}
                  onChange={(e) => {
                    setIsTeamRegistration(e.target.checked);
                    if (!e.target.checked) {
                      setFormData(prev => ({ ...prev, workspaceName: '' }));
                    }
                  }}
                  disabled={loading}
                />
                Register as part of a team?
              </label>
            </div>

            {isTeamRegistration && (
              <div className="form-group">
                <label htmlFor="workspaceName">Workspace Name *</label>
                <input
                  type="text"
                  id="workspaceName"
                  name="workspaceName"
                  value={formData.workspaceName}
                  onChange={handleChange}
                  placeholder="e.g., Grace Community Church"
                  disabled={loading}
                />
                <small className="form-help">
                  Your workspace is where your team will manage services and songs together
                </small>
              </div>
            )}

            <button
              type="submit"
              className="btn-register"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="register-footer">
            <p>
              Already have an account? <Link to="/login">Login here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
