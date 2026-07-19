'use strict';

const DEFAULT_CAP = 500;

function appendAudit(entry, log, cap = DEFAULT_CAP) {
  if (!Array.isArray(log)) throw new TypeError('log must be array');
  log.push(entry);
  while (log.length > cap) log.shift();
  return log;
}

module.exports = { appendAudit, DEFAULT_CAP };
