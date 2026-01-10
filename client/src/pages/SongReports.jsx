import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './SongReports.css';

const REPORT_TYPE_LABELS = {
  lyrics_error: { en: 'Lyrics Error', he: 'שגיאה במילים' },
  chord_error: { en: 'Chord Error', he: 'שגיאה באקורדים' },
  wrong_key: { en: 'Wrong Key', he: 'טונליות שגויה' },
  missing_info: { en: 'Missing Info', he: 'מידע חסר' },
  other: { en: 'Other', he: 'אחר' }
};

const STATUS_LABELS = {
  pending: { en: 'Pending', he: 'ממתין', color: '#f39c12' },
  reviewed: { en: 'Reviewed', he: 'נבדק', color: '#3498db' },
  resolved: { en: 'Resolved', he: 'טופל', color: '#2ecc71' },
  dismissed: { en: 'Dismissed', he: 'נדחה', color: '#95a5a6' }
};

const SongReports = () => {
  const { user, token } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isHebrew = language === 'he';

  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [updating, setUpdating] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch reports - using useCallback to allow reuse in other functions
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const url = statusFilter
        ? `/api/reports?status=${statusFilter}`
        : '/api/reports';
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }

      const data = await response.json();
      setReports(data.reports);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, token]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/reports/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [token]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [fetchReports, fetchStats]);

  const updateReportStatus = async (reportId, newStatus, adminNotes = '') => {
    try {
      setUpdating(true);
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          admin_notes: adminNotes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update report');
      }

      // Refresh the list and stats
      await fetchReports();
      await fetchStats();
      setSelectedReport(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const deleteReport = async (reportId) => {
    if (!window.confirm(isHebrew ? 'האם אתה בטוח שברצונך למחוק את הדיווח?' : 'Are you sure you want to delete this report?')) {
      return;
    }

    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete report');
      }

      await fetchReports();
      await fetchStats();
      setSelectedReport(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return isHebrew ? 'לא ידוע' : 'Unknown';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return isHebrew ? 'לא ידוע' : 'Unknown';
    return date.toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="song-reports-page" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="reports-header">
        <h1>{isHebrew ? 'דיווחים על שירים' : 'Song Reports'}</h1>
        {stats && (
          <div className="reports-stats">
            <span className="stat pending">{stats.pending} {isHebrew ? 'ממתינים' : 'Pending'}</span>
            <span className="stat reviewed">{stats.reviewed} {isHebrew ? 'נבדקו' : 'Reviewed'}</span>
            <span className="stat resolved">{stats.resolved} {isHebrew ? 'טופלו' : 'Resolved'}</span>
            <span className="stat total">{stats.total} {isHebrew ? 'סה"כ' : 'Total'}</span>
          </div>
        )}
      </div>

      <div className="reports-filters">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="status-filter"
        >
          <option value="">{isHebrew ? 'כל הסטטוסים' : 'All Statuses'}</option>
          <option value="pending">{isHebrew ? 'ממתין' : 'Pending'}</option>
          <option value="reviewed">{isHebrew ? 'נבדק' : 'Reviewed'}</option>
          <option value="resolved">{isHebrew ? 'טופל' : 'Resolved'}</option>
          <option value="dismissed">{isHebrew ? 'נדחה' : 'Dismissed'}</option>
        </select>
      </div>

      {loading ? (
        <div className="reports-loading">{isHebrew ? 'טוען...' : 'Loading...'}</div>
      ) : error ? (
        <div className="reports-error">{error}</div>
      ) : reports.length === 0 ? (
        <div className="reports-empty">
          {isHebrew ? 'אין דיווחים להצגה' : 'No reports to display'}
        </div>
      ) : (
        <div className="reports-list">
          {reports.map(report => (
            <div
              key={report.id}
              className={`report-card ${selectedReport?.id === report.id ? 'selected' : ''}`}
              onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
            >
              <div className="report-card-header">
                <span className="report-song-title">{report.song?.title || 'Unknown Song'}</span>
                <span
                  className="report-status"
                  style={{ backgroundColor: STATUS_LABELS[report.status]?.color || '#888' }}
                >
                  {isHebrew
                    ? (STATUS_LABELS[report.status]?.he || report.status)
                    : (STATUS_LABELS[report.status]?.en || report.status)}
                </span>
              </div>
              <div className="report-card-meta">
                <span className="report-type">
                  {isHebrew
                    ? (REPORT_TYPE_LABELS[report.report_type]?.he || report.report_type)
                    : (REPORT_TYPE_LABELS[report.report_type]?.en || report.report_type)}
                </span>
                <span className="report-date">{formatDate(report.created_at)}</span>
              </div>
              <div className="report-description">{report.description}</div>

              {selectedReport?.id === report.id && (
                <div className="report-details">
                  <div className="report-detail-row">
                    <strong>{isHebrew ? 'מדווח:' : 'Reporter:'}</strong>
                    <span>{report.reporter_name || report.reporter_email}</span>
                  </div>
                  <div className="report-detail-row">
                    <strong>{isHebrew ? 'אימייל:' : 'Email:'}</strong>
                    <span>{report.reporter_email}</span>
                  </div>
                  {report.song && (
                    <div className="report-detail-row">
                      <a
                        href={`/song/${report.song.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-song-link"
                      >
                        {isHebrew ? 'צפה בשיר' : 'View Song'} &rarr;
                      </a>
                    </div>
                  )}
                  {report.admin_notes && (
                    <div className="report-detail-row">
                      <strong>{isHebrew ? 'הערות:' : 'Notes:'}</strong>
                      <span>{report.admin_notes}</span>
                    </div>
                  )}

                  <div className="report-actions">
                    {report.status === 'pending' && (
                      <>
                        <button
                          className="btn-action btn-reviewed"
                          onClick={(e) => { e.stopPropagation(); updateReportStatus(report.id, 'reviewed'); }}
                          disabled={updating}
                        >
                          {isHebrew ? 'סמן כנבדק' : 'Mark Reviewed'}
                        </button>
                        <button
                          className="btn-action btn-resolved"
                          onClick={(e) => { e.stopPropagation(); updateReportStatus(report.id, 'resolved'); }}
                          disabled={updating}
                        >
                          {isHebrew ? 'סמן כטופל' : 'Mark Resolved'}
                        </button>
                        <button
                          className="btn-action btn-dismissed"
                          onClick={(e) => { e.stopPropagation(); updateReportStatus(report.id, 'dismissed'); }}
                          disabled={updating}
                        >
                          {isHebrew ? 'דחה' : 'Dismiss'}
                        </button>
                      </>
                    )}
                    {report.status === 'reviewed' && (
                      <button
                        className="btn-action btn-resolved"
                        onClick={(e) => { e.stopPropagation(); updateReportStatus(report.id, 'resolved'); }}
                        disabled={updating}
                      >
                        {isHebrew ? 'סמן כטופל' : 'Mark Resolved'}
                      </button>
                    )}
                    <button
                      className="btn-action btn-delete"
                      onClick={(e) => { e.stopPropagation(); deleteReport(report.id); }}
                      disabled={updating}
                    >
                      {isHebrew ? 'מחק' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SongReports;
