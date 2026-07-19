'use strict';
const { verifyTeamCode } = require('./team-code.js');

function getBearerToken(req) {
  const h = req.get('authorization') || '';
  const m = /^Bearer\s+(\S+)\s*$/i.exec(h);
  return m ? m[1] : '';
}

function createBearerAuthMiddleware(getState, { onAuthFail } = {}) {
  return (req, res, next) => {
    const token = getBearerToken(req);
    let st;
    try {
      st = getState();
    } catch {
      return res.status(500).json({ error: 'host_store_error' });
    }
    if (!verifyTeamCode(token, st.teamCodeHash)) {
      if (typeof onAuthFail === 'function') onAuthFail();
      return res.status(401).json({ error: 'invalid_token' });
    }
    next();
  };
}

module.exports = { getBearerToken, createBearerAuthMiddleware };
