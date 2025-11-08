import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5002/api',
  timeout: 30000, // Increased to 30 seconds
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response) {
      // Server responded with error
      if (error.response.status === 401) {
        // Unauthorized - clear token and redirect to login
        // But only if we're not on a guest-accessible page or auth pages
        const guestPages = ['/', '/service/code', '/song'];
        const authPages = ['/login', '/register'];
        const currentPath = window.location.pathname;
        const isGuestPage = guestPages.some(page => currentPath === page || currentPath.startsWith(page + '/'));
        const isAuthPage = authPages.some(page => currentPath === page || currentPath.startsWith(page + '/'));

        // Also check if this is a login/register API call - don't redirect on failed auth attempts
        const isAuthRequest = error.config && (
          error.config.url.includes('/auth/login') ||
          error.config.url.includes('/auth/register')
        );

        if (!isGuestPage && !isAuthPage && !isAuthRequest) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      } else if (error.response.status === 403) {
        // Forbidden - check if it's a workspace access error
        const errorData = error.response.data;
        const isWorkspaceAccessError =
          errorData?.message?.includes('not a member of this workspace') ||
          errorData?.message?.includes('do not have access to this service') ||
          errorData?.error === 'Access denied';

        if (isWorkspaceAccessError) {
          console.log('[API] Workspace access denied, switching to personal workspace...');

          // Dispatch custom event for WorkspaceContext to handle
          window.dispatchEvent(new CustomEvent('workspace-access-denied'));

          // Try to switch to personal workspace automatically
          try {
            const token = localStorage.getItem('token');
            if (token) {
              // Get all workspaces
              const workspacesResponse = await api.get('/workspaces');
              const workspaces = workspacesResponse.data;

              // Find personal workspace
              const personalWorkspace = workspaces.find(ws => ws.workspace_type === 'personal');

              if (personalWorkspace && !personalWorkspace.is_active) {
                // Switch to personal workspace
                await api.post(`/workspaces/${personalWorkspace.id}/switch`);
                console.log('[API] Switched to personal workspace');

                // Reload the page to reflect new workspace
                window.location.reload();
              }
            }
          } catch (switchError) {
            console.error('[API] Failed to auto-switch workspace:', switchError);
          }
        }
      }
      return Promise.reject(error.response.data);
    } else if (error.request) {
      // Request made but no response
      return Promise.reject({ error: 'No response from server' });
    } else {
      // Something else happened
      return Promise.reject({ error: error.message });
    }
  }
);

export default api;
