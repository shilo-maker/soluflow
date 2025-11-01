const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to check validation results and return errors if any
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Validation rules for song endpoints
 */
const songValidation = {
  getSongById: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Song ID must be a positive integer'),
    validate
  ],

  createSong: [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 255 })
      .withMessage('Title must not exceed 255 characters'),
    body('content')
      .notEmpty()
      .withMessage('Content is required')
      .isLength({ max: 100000 })
      .withMessage('Content must not exceed 100,000 characters'),
    body('key')
      .optional()
      .trim()
      .matches(/^[A-G][#b]?m?$/)
      .withMessage('Invalid musical key format (e.g., C, Am, F#, Bb)'),
    body('bpm')
      .optional()
      .isInt({ min: 30, max: 300 })
      .withMessage('BPM must be between 30 and 300'),
    body('time_signature')
      .optional()
      .trim()
      .matches(/^\d+\/\d+$/)
      .withMessage('Time signature must be in format like 4/4 or 3/4'),
    body('authors')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Authors must not exceed 500 characters'),
    body('copyright_info')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Copyright info must not exceed 1000 characters'),
    body('is_public')
      .optional()
      .isBoolean()
      .withMessage('is_public must be a boolean'),
    body('listen_url')
      .optional()
      .trim()
      .isURL()
      .withMessage('Listen URL must be a valid URL')
      .isLength({ max: 500 })
      .withMessage('Listen URL must not exceed 500 characters'),
    validate
  ],

  updateSong: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Song ID must be a positive integer'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Title cannot be empty')
      .isLength({ max: 255 })
      .withMessage('Title must not exceed 255 characters'),
    body('content')
      .optional()
      .notEmpty()
      .withMessage('Content cannot be empty')
      .isLength({ max: 100000 })
      .withMessage('Content must not exceed 100,000 characters'),
    body('key')
      .optional()
      .trim()
      .matches(/^[A-G][#b]?m?$/)
      .withMessage('Invalid musical key format'),
    body('bpm')
      .optional()
      .isInt({ min: 30, max: 300 })
      .withMessage('BPM must be between 30 and 300'),
    body('time_signature')
      .optional()
      .trim()
      .matches(/^\d+\/\d+$/)
      .withMessage('Time signature must be in format like 4/4 or 3/4'),
    body('authors')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Authors must not exceed 500 characters'),
    body('copyright_info')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Copyright info must not exceed 1000 characters'),
    body('is_public')
      .optional()
      .isBoolean()
      .withMessage('is_public must be a boolean'),
    body('listen_url')
      .optional()
      .trim()
      .isURL({ require_protocol: false })
      .withMessage('Listen URL must be a valid URL')
      .isLength({ max: 500 })
      .withMessage('Listen URL must not exceed 500 characters'),
    validate
  ],

  deleteSong: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Song ID must be a positive integer'),
    validate
  ]
};

/**
 * Validation rules for auth endpoints
 */
const authValidation = {
  register: [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Must be a valid email address')
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage('Email must not exceed 255 characters'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
    validate
  ],

  login: [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Must be a valid email address')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    validate
  ],

  forgotPassword: [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Must be a valid email address')
      .normalizeEmail(),
    validate
  ],

  resetPassword: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    validate
  ]
};

/**
 * Validation rules for service endpoints
 */
const serviceValidation = {
  getServiceById: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Service ID must be a positive integer'),
    validate
  ],

  createService: [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 255 })
      .withMessage('Title must not exceed 255 characters'),
    body('date')
      .optional()
      .isISO8601()
      .withMessage('Date must be a valid ISO 8601 date'),
    body('leader_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Leader ID must be a positive integer'),
    validate
  ]
};

module.exports = {
  validate,
  songValidation,
  authValidation,
  serviceValidation
};
