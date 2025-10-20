import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import userService from '../services/userService';
import Toast from '../components/Toast';
import './UserManagement.css';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showToast, setShowToast] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Fetch users on component mount
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
      setError('Failed to load users. Please try again.');
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

      // Update the users list
      setUsers(prev => prev.map(u =>
        u.id === updatedUser.id ? updatedUser : u
      ));

      setToastMessage('User updated successfully!');
      setToastType('success');
      setShowToast(true);
      setIsModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error('Error updating user:', err);
      setToastMessage('Failed to update user. Please try again.');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await userService.deleteUser(userId);

      // Remove user from list
      setUsers(prev => prev.filter(u => u.id !== userId));

      setToastMessage('User deleted successfully!');
      setToastType('success');
      setShowToast(true);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting user:', err);
      setToastMessage(err.response?.data?.error || 'Failed to delete user. Please try again.');
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

  return (
    <div className="user-management-page">
      <div className="user-management-header">
        <h1>User Management</h1>
        <p className="user-count">{users.length} users</p>
      </div>

      {loading && (
        <div className="loading-state">Loading users...</div>
      )}

      {error && (
        <div className="error-state">{error}</div>
      )}

      {!loading && !error && (
        <div className="users-list">
          {users.map(u => (
            <div key={u.id} className="user-card">
              <div className="user-card-content">
                <div className="user-info">
                  <div className="user-name-section">
                    <h3 className="user-name">{u.username}</h3>
                    <span className={`role-badge ${getRoleBadgeClass(u.role)}`}>
                      {u.role.toUpperCase()}
                    </span>
                    {!u.is_active && (
                      <span className="inactive-badge">INACTIVE</span>
                    )}
                  </div>
                  <p className="user-email">{u.email}</p>
                  {u.workspace && (
                    <p className="user-workspace">Workspace: {u.workspace.name}</p>
                  )}
                </div>

                <div className="user-actions">
                  <button
                    className="btn-edit-user"
                    onClick={() => handleEditUser(u)}
                  >
                    Edit
                  </button>
                  {u.id !== user.id && (
                    <button
                      className="btn-delete-user"
                      onClick={() => setDeleteConfirm(u.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Delete confirmation */}
              {deleteConfirm === u.id && (
                <div className="delete-confirm">
                  <p>Are you sure you want to delete {u.username}?</p>
                  <div className="delete-confirm-actions">
                    <button
                      className="btn-confirm-delete"
                      onClick={() => handleDeleteUser(u.id)}
                    >
                      Yes, Delete
                    </button>
                    <button
                      className="btn-cancel-delete"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {users.length === 0 && (
            <div className="empty-state">No users found</div>
          )}
        </div>
      )}

      {/* Edit User Modal */}
      {isModalOpen && selectedUser && (
        <UserEditModal
          user={selectedUser}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedUser(null);
          }}
          onSave={handleSaveUser}
        />
      )}

      {/* Toast */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
};

// User Edit Modal Component
const UserEditModal = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    username: user.username || '',
    email: user.email || '',
    role: user.role || 'member',
    is_active: user.is_active !== undefined ? user.is_active : true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit User</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="user-edit-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="member">Member</option>
              <option value="leader">Leader</option>
              <option value="planner">Planner</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="form-group-checkbox">
            <label>
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
              />
              <span>Active User</span>
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-save">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserManagement;
