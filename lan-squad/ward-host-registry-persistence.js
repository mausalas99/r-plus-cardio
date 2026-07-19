'use strict';

const fs = require('node:fs');
const path = require('node:path');

const VERSION = 1;
const MAX_URLS = 20;
const MAX_PREFIXES = 12;

function tsNow() {
  return Date.now();
}

function emptyRegistry() {
  return { version: VERSION, updatedAt: tsNow(), hostUrls: [], prefixes: [] };
}

function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  fs.renameSync(tmp, filePath);
}

function createRegistryPersistence(filePath) {
  function load() {
    if (!filePath || !fs.existsSync(filePath)) return emptyRegistry();
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!parsed || parsed.version !== VERSION) return emptyRegistry();
      return {
        version: VERSION,
        updatedAt: Number(parsed.updatedAt) || tsNow(),
        hostUrls: Array.isArray(parsed.hostUrls) ? parsed.hostUrls : [],
        prefixes: Array.isArray(parsed.prefixes)
          ? parsed.prefixes.map((p) => String(p || '').trim()).filter(Boolean)
          : [],
      };
    } catch (e) {
      console.error('[ward-host-registry] load failed:', e && e.message ? e.message : e);
      return emptyRegistry();
    }
  }

  function save(reg) {
    const payload = {
      version: VERSION,
      updatedAt: tsNow(),
      hostUrls: Array.isArray(reg.hostUrls) ? reg.hostUrls.slice(0, MAX_URLS) : [],
      prefixes: Array.isArray(reg.prefixes) ? reg.prefixes.slice(0, MAX_PREFIXES) : [],
    };
    if (filePath) {
      try {
        atomicWriteJson(filePath, payload);
      } catch (e) {
        console.error('[ward-host-registry] save failed:', e && e.message ? e.message : e);
      }
    }
    return payload;
  }

  function clear() {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('[ward-host-registry] clear failed:', e && e.message ? e.message : e);
      }
    }
    return emptyRegistry();
  }

  return { load, save, clear };
}

module.exports = {
  VERSION,
  MAX_URLS,
  MAX_PREFIXES,
  tsNow,
  createRegistryPersistence,
};
