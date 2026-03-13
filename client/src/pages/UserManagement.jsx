import React, { useState, useEffect } from 'react';
import { Users, Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import userService from '../services/userService';
import { getInitials, getAvatarColor } from '../utils/imageUtils';
import Toast from '../components/Toast';
import './UserManagement.css';

const UserManagement = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showToast, setShowToast] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getAllUsers();
      setUsers(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(isHe ? 'שגיאה בטעינת משתמשים' : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (userToEdit) => {
    setSelectedUser(userToEdit);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (formData) => {
    try {
      const updatedUser = await userService.updateUser(selectedUser.id, formData);
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      setToastMessage(isHe ? 'המשתמש עודכן בהצלחה' : 'User updated successfully');
      setToastType('success');
      setShowToast(true);
      setIsModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error('Error updating user:', err);
      setToastMessage(isHe ? 'שגיאה בעדכון המשתמש' : 'Failed to update user');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await userService.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setToastMessage(isHe ? 'המשתמש נמחק בהצלחה' : 'User deleted successfully');
      setToastType('success');
      setShowToast(true);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting user:', err);
      setToastMessage(err.response?.data?.error || (isHe ? 'שגיאה במחיקת המשתמש' : 'Failed to delete user'));
      setToastType('error');
      setShowToast(true);
    }
  };

  const getRoleBadgeClass = (role) => {
    const roleMap = {
      admin: 'role-badge-admin',
      planner: 'role-badge-planner',
      leader: 'role-badge-leader',
      member: 'role-badge-member'
    };
    return roleMap[role] || 'role-badge-member';
  };

  const getRoleLabel = (role) => {
    if (!isHe) return role;
    if (isHe) {
      const map = { admin: 'מנהל', planner: 'חבר', leader: 'מוביל', member: 'חבר' };
      return map[role] || role;
    }
    const map = { admin: 'Manager', planner: 'Member', leader: 'Leader', member: 'Member' };
    return map[role] || role;
  };

  return (
    <div className="user-management-page">
      <div className="um-container">
        {/* Page Header */}
        <div className="um-page-header">
          <h1 className="um-page-title">
            <Users size={28} />
            {isHe ? 'ניהול משתמשים' : 'User Management'}
          </h1>
          <p className="um-page-subtitle">
            {users.length} {isHe ? 'משתמשים' : 'users'}
          </p>
        </div>

        {loading && (
          <div className="um-loading">{isHe ? 'טוען...' : 'Loading...'}</div>
        )}

        {error && (
          <div className="um-error">{error}</div>
        )}

        {!loading && !error && (
          <div className="um-card">
            <div className="um-users-list">
              {users.map(u => (
                <div key={u.id} className="um-user-row">
                  <div className="um-user-main">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.username} className="um-avatar" />
                    ) : (
                      <div
                        className="um-avatar um-avatar-initials"
                        style={{ backgroundColor: getAvatarColor(u.username || u.email || '') }}
                      >
                        {getInitials(u.username || u.email || '?')}
                      </div>
                    )}
                    <div className="um-user-info">
                      <div className="um-user-name-row">
                        <span className="um-user-name">{u.username}</span>
                        <span className={`um-role-badge ${getRoleBadgeClass(u.role)}`}>
                          {getRoleLabel(u.role)}
                        </span>
                        {!u.is_active && (
                          <span className="um-inactive-badge">{isHe ? 'לא פעיל' : 'Inactive'}</span>
                        )}
                      </div>
                      <span className="um-user-email">{u.email}</span>
                    </div>
                  </div>
                  <div className="um-user-actions">
                    <button className="um-btn-icon um-btn-edit" onClick={() => handleEditUser(u)} title={isHe ? 'עריכה' : 'Edit'}>
                      <Pencil size={16} />
                    </button>
                    {u.id !== user.id && (
                      <button className="um-btn-icon um-btn-delete" onClick={() => setDeleteConfirm(u.id)} title={isHe ? 'מחיקה' : 'Delete'}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {deleteConfirm === u.id && (
                    <div className="um-delete-confirm">
                      <p>{isHe ? `למחוק את ${u.username}?` : `Delete ${u.username}?`}</p>
                      <div className="um-delete-actions">
                        <button className="um-btn um-btn-danger" onClick={() => handleDeleteUser(u.id)}>
                          {isHe ? 'מחק' : 'Delete'}
                        </button>
                        <button className="um-btn um-btn-secondary" onClick={() => setDeleteConfirm(null)}>
                          {isHe ? 'ביטול' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {users.length === 0 && (
                <div className="um-empty">{isHe ? 'לא נמצאו משתמשים' : 'No users found'}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {isModalOpen && selectedUser && (
        <UserEditModal
          editUser={selectedUser}
          isHe={isHe}
          onClose={() => { setIsModalOpen(false); setSelectedUser(null); }}
          onSave={handleSaveUser}
        />
      )}

      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
};

const UserEditModal = ({ editUser, isHe, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    username: editUser.username || '',
    email: editUser.email || '',
    role: editUser.role || 'member',
    is_active: editUser.is_active !== undefined ? editUser.is_active : true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <div className="um-modal-overlay" onClick={onClose}>
      <div className="um-modal" onClick={(e) => e.stopPropagation()}>
        <div className="um-modal-header">
          <h2>{isHe ? 'עריכת משתמש' : 'Edit User'}</h2>
          <button className="um-modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="um-modal-body">
          <div className="um-form-group">
            <label>{isHe ? 'שם משתמש' : 'Username'}</label>
            <input type="text" name="username" value={formData.username} onChange={handleChange} required />
          </div>

          <div className="um-form-group">
            <label>{isHe ? 'אימייל' : 'Email'}</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} required />
          </div>

          <div className="um-form-group">
            <label>{isHe ? 'תפקיד' : 'Role'}</label>
            <select name="role" value={formData.role} onChange={handleChange}>
              <option value="member">{isHe ? 'חבר' : 'Member'}</option>
              <option value="leader">{isHe ? 'מוביל' : 'Leader'}</option>
              <option value="admin">{isHe ? 'מנהל' : 'Manager'}</option>
            </select>
          </div>

          <label className="um-checkbox-label">
            <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} />
            <span>{isHe ? 'משתמש פעיל' : 'Active User'}</span>
          </label>

          <div className="um-modal-actions">
            <button type="button" className="um-btn um-btn-secondary" onClick={onClose}>
              {isHe ? 'ביטול' : 'Cancel'}
            </button>
            <button type="submit" className="um-btn um-btn-primary">
              {isHe ? 'שמור' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserManagement;
