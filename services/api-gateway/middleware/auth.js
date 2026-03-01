const jwt = require('jsonwebtoken');

const PUBLIC_PATHS = ['/health', '/api/auth/login', '/api/formforce/webhook'];

function isPublicPath(path) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

function authMiddleware(req, res, next) {
  if (isPublicPath(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const sbcApiKey = req.headers['x-sbc-api-key'];

  // SBC endpoints accept X-SBC-API-Key as an alternative to JWT
  if (req.path.startsWith('/api/telemetry') && sbcApiKey) {
    const expectedKey = process.env.SBC_API_KEY;
    if (expectedKey && sbcApiKey === expectedKey) {
      req.user = { role: 'sbc', source: 'api-key' };
      return next();
    }
    return res.status(401).json({ error: 'Invalid SBC API key' });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
