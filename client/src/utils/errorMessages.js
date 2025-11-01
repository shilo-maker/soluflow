/**
 * Error Messages Utility
 * Translates technical errors into user-friendly messages
 */

// Common error message mappings
const ERROR_MESSAGES = {
  // Network errors
  'Network Error': 'Unable to connect to the server. Please check your internet connection.',
  'ERR_NETWORK': 'Network connection issue. Please check your internet and try again.',
  'ECONNREFUSED': 'Cannot reach the server. Please try again later.',

  // Authentication errors
  'Unauthorized': 'Your session has expired. Please log in again.',
  'Invalid credentials': 'The email or password you entered is incorrect. Please try again.',
  'Invalid token': 'Your session has expired. Please log in again.',
  'User not found': 'We couldn\'t find an account with that email address.',
  'Email already exists': 'An account with this email already exists. Try logging in instead.',

  // Validation errors
  'Validation error': 'Please check your input and try again.',
  'Missing required field': 'Please fill in all required fields.',
  'Invalid email format': 'Please enter a valid email address.',
  'Password too short': 'Your password must be at least 8 characters long.',
  'Passwords do not match': 'The passwords you entered don\'t match. Please try again.',

  // Song errors
  'Song not found': 'The song you\'re looking for doesn\'t exist or has been removed.',
  'Cannot delete song': 'This song is being used in a service and cannot be deleted.',
  'Song already exists': 'A song with this title already exists in your library.',

  // Service errors
  'Service not found': 'The service you\'re looking for doesn\'t exist or has been removed.',
  'Cannot delete service': 'This service cannot be deleted because it has songs or notes associated with it.',

  // Permission errors
  'Forbidden': 'You don\'t have permission to perform this action.',
  'Access denied': 'You don\'t have permission to access this resource.',
  'Not authorized': 'You need to be logged in to do that.',

  // Server errors
  'Internal Server Error': 'Something went wrong on our end. Please try again later.',
  'Service Unavailable': 'The service is temporarily unavailable. Please try again in a few moments.',
  'Database error': 'We\'re having trouble accessing the database. Please try again later.',

  // Rate limiting
  'Too many requests': 'You\'re making too many requests. Please wait a moment and try again.',
  'Rate limit exceeded': 'Too many attempts. Please wait a few minutes before trying again.',

  // File/Upload errors
  'File too large': 'The file you\'re trying to upload is too large. Maximum size is 50MB.',
  'Invalid file type': 'This file type is not supported. Please use a supported format.',

  // Workspace errors
  'Workspace not found': 'The workspace you\'re looking for doesn\'t exist.',
  'Already a member': 'You\'re already a member of this workspace.',
  'Invitation expired': 'This invitation has expired. Please request a new one.',

  // Generic fallback
  'Unknown error': 'Something unexpected happened. Please try again.',
  'Request failed': 'Your request couldn\'t be completed. Please try again.',
};

/**
 * Get a user-friendly error message from an error object
 * @param {Error|object} error - The error object or response error
 * @returns {string} User-friendly error message
 */
export const getFriendlyErrorMessage = (error) => {
  // If error is a string, return it directly
  if (typeof error === 'string') {
    return ERROR_MESSAGES[error] || error;
  }

  // Handle Axios error responses
  if (error?.response) {
    const { status, data } = error.response;

    // Check for specific error message in response
    if (data?.error) {
      const friendlyMessage = ERROR_MESSAGES[data.error];
      if (friendlyMessage) return friendlyMessage;
    }

    if (data?.message) {
      const friendlyMessage = ERROR_MESSAGES[data.message];
      if (friendlyMessage) return friendlyMessage;
    }

    // Handle HTTP status codes
    switch (status) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'You don\'t have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'This action conflicts with existing data. Please check and try again.';
      case 413:
        return 'The data you\'re sending is too large. Please reduce the size and try again.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'A server error occurred. Please try again later.';
      case 502:
        return 'The server is temporarily unavailable. Please try again in a moment.';
      case 503:
        return 'The service is temporarily unavailable. Please try again later.';
      default:
        return `An error occurred (${status}). Please try again.`;
    }
  }

  // Handle network errors
  if (error?.message) {
    const friendlyMessage = ERROR_MESSAGES[error.message];
    if (friendlyMessage) return friendlyMessage;

    // Check for common patterns
    if (error.message.includes('Network')) {
      return ERROR_MESSAGES['Network Error'];
    }
    if (error.message.includes('timeout')) {
      return 'The request took too long. Please try again.';
    }
  }

  // Handle error codes
  if (error?.code) {
    const friendlyMessage = ERROR_MESSAGES[error.code];
    if (friendlyMessage) return friendlyMessage;
  }

  // Fallback to generic message
  return 'Something went wrong. Please try again.';
};

/**
 * Get a user-friendly success message
 * @param {string} action - The action that was successful
 * @returns {string} User-friendly success message
 */
export const getSuccessMessage = (action) => {
  const SUCCESS_MESSAGES = {
    'song_created': 'Song created successfully!',
    'song_updated': 'Song updated successfully!',
    'song_deleted': 'Song deleted successfully!',
    'service_created': 'Service created successfully!',
    'service_updated': 'Service updated successfully!',
    'service_deleted': 'Service deleted successfully!',
    'user_created': 'User account created successfully!',
    'user_updated': 'Profile updated successfully!',
    'password_reset': 'Password reset successfully!',
    'email_verified': 'Email verified successfully!',
    'login': 'Welcome back!',
    'logout': 'You\'ve been logged out successfully.',
    'share_sent': 'Shared successfully!',
    'invite_sent': 'Invitation sent successfully!',
    'workspace_created': 'Workspace created successfully!',
    'workspace_joined': 'You\'ve joined the workspace!',
  };

  return SUCCESS_MESSAGES[action] || 'Action completed successfully!';
};

export default {
  getFriendlyErrorMessage,
  getSuccessMessage,
};
