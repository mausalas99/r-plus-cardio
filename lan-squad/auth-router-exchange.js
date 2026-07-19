'use strict';

const { resolveHostUrlForClient } = require('./lan-request-host.js');
const { redactAuthBody } = require('./redact-secrets.js');
const { isShiftPinBypassEnabled } = require('./lan-shift-pin-policy.js');

function exchangeShiftPinBypass({ getHostToken, authFailureLockout, auditLanSecurity }) {
  if (typeof getHostToken !== 'function') {
    return { status: 503, body: { error: 'shift_pin_unavailable' } };
  }
  const token = String(getHostToken() || '').trim();
  if (!token || token.length < 32) {
    return { status: 503, body: { error: 'shift_pin_unavailable' } };
  }
  authFailureLockout.recordSuccess();
  auditLanSecurity('lan.shift_pin.bypass', {});
  return { status: 200, result: { token } };
}

function countCredentialTypes(body) {
  const hasTicket = body.ticket != null && String(body.ticket).trim() !== '';
  const hasPin = body.pin != null && String(body.pin).trim() !== '';
  const hasShiftPin = body.shiftPin != null && String(body.shiftPin).trim() !== '';
  return {
    hasTicket,
    hasPin,
    hasShiftPin,
    credCount: [hasTicket, hasPin, hasShiftPin].filter(Boolean).length,
  };
}

function exchangeShiftPin(body, { shiftPinStore, authFailureLockout, auditLanSecurity }) {
  if (!shiftPinStore || typeof shiftPinStore.exchange !== 'function') {
    return { status: 503, body: { error: 'shift_pin_unavailable' } };
  }
  const result = shiftPinStore.exchange(String(body.shiftPin).trim());
  if (!result || !result.token) {
    authFailureLockout.recordFailure();
    auditLanSecurity('lan.auth.exchange_fail', {});
    auditLanSecurity('lan.auth.fail', { reason: 'invalid_shift_pin' });
    return { status: 401, body: { error: 'invalid_shift_pin' } };
  }
  authFailureLockout.recordSuccess();
  auditLanSecurity('lan.shift_pin.exchange', {});
  return { status: 200, result };
}

function exchangeTicket(body, { ticketStore, authFailureLockout, auditLanSecurity, hasTicket, hasPin }) {
  const result = ticketStore.exchange({
    ticket: hasTicket ? String(body.ticket).trim() : undefined,
    pin: hasPin ? String(body.pin).trim() : undefined,
  });
  if (!result || !result.token) {
    authFailureLockout.recordFailure();
    auditLanSecurity('lan.auth.exchange_fail', {});
    auditLanSecurity('lan.auth.fail', { reason: 'invalid_ticket' });
    return { status: 401, body: { error: 'invalid_ticket' } };
  }
  authFailureLockout.recordSuccess();
  auditLanSecurity('lan.ticket.exchange', {});
  return { status: 200, result };
}

function buildExchangeResponse(req, body, result, deps) {
  const { getHostUrl, wardHostRegistry, clientIdentityStore } = deps;
  const hostUrl = resolveHostUrlForClient(req, getHostUrl);
  if (wardHostRegistry && typeof wardHostRegistry.recordUrl === 'function' && hostUrl) {
    try {
      wardHostRegistry.recordUrl(hostUrl, { source: 'host' });
    } catch (_e) { void _e; }
  }
  const wardHostHints =
    wardHostRegistry && typeof wardHostRegistry.getHintsForExchange === 'function'
      ? wardHostRegistry.getHintsForExchange()
      : null;
  const clientToken =
    body.clientId != null && clientIdentityStore && typeof clientIdentityStore.issue === 'function'
      ? clientIdentityStore.issue(body.clientId)
      : null;
  return {
    token: result.token,
    hostUrl,
    persist: true,
    storageTarget: 'userData',
    ...(wardHostHints ? { wardHostHints } : {}),
    ...(clientToken ? { clientToken } : {}),
  };
}

function handleAuthExchange(req, res, deps) {
  const { authFailureLockout, auditLanSecurity } = deps;
  if (authFailureLockout.isLockedOut()) {
    auditLanSecurity('lan.auth.lockout', {});
    return res.status(429).json({ error: 'too_many_attempts' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { hasTicket, hasPin, hasShiftPin, credCount } = countCredentialTypes(body);

  if (credCount > 1) {
    auditLanSecurity('lan.auth.fail', { reason: 'ambiguous_credentials' });
    return res.status(400).json({ error: 'ambiguous_credentials' });
  }
  if (credCount === 0) {
    if (isShiftPinBypassEnabled()) {
      try {
        const exchangeOut = exchangeShiftPinBypass(deps);
        if (exchangeOut.status !== 200) {
          return res.status(exchangeOut.status).json(exchangeOut.body);
        }
        return res.json(buildExchangeResponse(req, body, exchangeOut.result, deps));
      } catch (e) {
        console.error('[auth/exchange]', redactAuthBody(body), e && e.message);
        return res.status(500).json({ error: 'exchange_failed' });
      }
    }
    auditLanSecurity('lan.auth.fail', { reason: 'missing_credentials' });
    return res.status(400).json({ error: 'missing_credentials' });
  }

  try {
    const exchangeOut = hasShiftPin
      ? exchangeShiftPin(body, deps)
      : exchangeTicket(body, { ...deps, hasTicket, hasPin });
    if (exchangeOut.status !== 200) {
      return res.status(exchangeOut.status).json(exchangeOut.body);
    }
    res.json(buildExchangeResponse(req, body, exchangeOut.result, deps));
  } catch (e) {
    console.error('[auth/exchange]', redactAuthBody(body), e && e.message);
    res.status(500).json({ error: 'exchange_failed' });
  }
}

module.exports = {
  handleAuthExchange,
  countCredentialTypes,
  exchangeShiftPin,
  exchangeShiftPinBypass,
  exchangeTicket,
  buildExchangeResponse,
};
