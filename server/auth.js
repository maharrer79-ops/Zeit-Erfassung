import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-bitte-in-produktion-aendern';
const TOKEN_NAME = 'ze_token';
const MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 Tage

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, {
    expiresIn: '30d',
  });
}

export function setAuthCookie(res, token) {
  res.cookie(TOKEN_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(TOKEN_NAME);
}

// Middleware: verlangt eine gueltige Anmeldung
export function requireAuth(req, res, next) {
  const token = req.cookies?.[TOKEN_NAME];
  if (!token) return res.status(401).json({ error: 'Nicht angemeldet' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sitzung ungueltig oder abgelaufen' });
  }
}
