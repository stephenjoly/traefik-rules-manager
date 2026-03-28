import crypto from 'node:crypto';

const SESSION_COOKIE_NAME = 'trm_session';

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signValue(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqualString(a, b) {
  const aBuffer = Buffer.from(String(a));
  const bBuffer = Buffer.from(String(b));
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function parseCookies(header = '') {
  return header
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const eqIndex = part.indexOf('=');
      if (eqIndex === -1) return cookies;
      const key = part.slice(0, eqIndex);
      const rawValue = part.slice(eqIndex + 1);
      let value = rawValue;

      try {
        value = decodeURIComponent(rawValue);
      } catch {
        // Some browsers/extensions/apps can send malformed cookie values.
        // Ignore decode failures and keep the raw value so auth parsing
        // doesn't crash unrelated requests with "URI malformed".
      }

      cookies[key] = value;
      return cookies;
    }, {});
}

function buildCookie(name, value, { maxAgeSeconds, secure }) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function validateAuthConfig(config) {
  if (!config.authEnabled) return;
  if (!config.adminUsername || !config.adminPassword || !config.sessionSecret) {
    throw new Error('Authentication is enabled but bootstrap credentials or session secret are missing');
  }
}

export function initAuth(config) {
  validateAuthConfig(config);

  const sessionTtlMs = config.sessionTtlHours * 60 * 60 * 1000;
  const sessionTtlSeconds = Math.max(1, Math.floor(sessionTtlMs / 1000));

  function createSessionToken(username) {
    const payload = {
      username,
      exp: Date.now() + sessionTtlMs
    };
    const encodedPayload = base64url(JSON.stringify(payload));
    const signature = signValue(encodedPayload, config.sessionSecret);
    return `${encodedPayload}.${signature}`;
  }

  function readSession(req) {
    if (!config.authEnabled) {
      return {
        authenticated: true,
        username: config.adminUsername || 'admin',
        authEnabled: false
      };
    }

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    if (!token) return null;

    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;
    if (!safeEqualString(signValue(encodedPayload, config.sessionSecret), signature)) return null;

    try {
      const payload = JSON.parse(decodeBase64url(encodedPayload));
      if (!payload?.username || !payload?.exp || payload.exp < Date.now()) return null;
      return {
        authenticated: true,
        username: payload.username,
        authEnabled: true
      };
    } catch {
      return null;
    }
  }

  function setSessionCookie(res, username) {
    res.setHeader('Set-Cookie', buildCookie(SESSION_COOKIE_NAME, createSessionToken(username), {
      maxAgeSeconds: sessionTtlSeconds,
      secure: config.cookieSecure
    }));
  }

  function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', buildCookie(SESSION_COOKIE_NAME, '', {
      maxAgeSeconds: 0,
      secure: config.cookieSecure
    }));
  }

  function requireAdminSession(req, res, next) {
    const session = readSession(req);
    if (!session?.authenticated) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.auth = session;
    next();
  }

  function getSessionState(req) {
    const session = readSession(req);
    if (!config.authEnabled) {
      return {
        authEnabled: false,
        authenticated: true,
        username: config.adminUsername || 'admin'
      };
    }

    if (!session?.authenticated) {
      return {
        authEnabled: true,
        authenticated: false
      };
    }

    return {
      authEnabled: true,
      authenticated: true,
      username: session.username
    };
  }

  function login(username, password) {
    if (!config.authEnabled) {
      return {
        ok: true,
        username: config.adminUsername || 'admin'
      };
    }

    const validUsername = safeEqualString(username, config.adminUsername);
    const validPassword = safeEqualString(password, config.adminPassword);
    if (!validUsername || !validPassword) return { ok: false };

    return { ok: true, username: config.adminUsername };
  }

  return {
    clearSessionCookie,
    getSessionState,
    login,
    requireAdminSession,
    setSessionCookie
  };
}
