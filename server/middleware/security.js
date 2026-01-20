/**
 * Security middleware for adding security headers
 * Includes Content Security Policy, X-Frame-Options, etc.
 */

const securityHeaders = (req, res, next) => {
  // Content Security Policy
  // This restricts which sources can load resources (scripts, styles, images, etc.)

  // Get the client URL from environment variable (without trailing slash)
  const clientUrl = (process.env.CLIENT_URL || 'https://soluflow.app').replace(/\/$/, '');

  const cspDirectives = [
    "default-src 'self'",
    // Note: 'unsafe-inline' needed for React's style injection; 'unsafe-eval' removed for security
    "script-src 'self' 'unsafe-inline' https://cdn.socket.io",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    // connect-src includes fonts for service worker fetch caching
    `connect-src 'self' ws: wss: ${clientUrl} https://soluflow.app http://localhost:* https://i.ytimg.com https://www.youtube.com https://fonts.googleapis.com https://fonts.gstatic.com`,
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests"
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);

  // X-Content-Type-Options: Prevents MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options: Prevents clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection: Enables XSS filter in older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy: Controls how much referrer information is sent
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy: Controls which browser features can be used
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Strict-Transport-Security: Forces HTTPS (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

module.exports = { securityHeaders };
