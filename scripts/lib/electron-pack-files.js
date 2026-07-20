/**
 * Lista canónica de electron-builder `build.files` y comprobación del grafo
 * de require desde main.js y server.js (arranque Electron + backend embebido).
 *
 *   node scripts/lib/electron-pack-files.js          # validar
 *   node scripts/lib/electron-pack-files.js --write  # actualizar package.json
 */

const fs = require('fs');
const path = require('path');

const PACK_FILES_BASELINE = [
  'main.js',
  'scripts/lib/release-notes-body.js',
  'preload.js',
  'server.js',
  'lan-squad/**/*',
  'lib/**/*.js',
  'lib/**/*.mjs',
  'lib/**/*.cjs',
  'generate-receta-hu.js',
  'generate-censo.js',
  'template.docx',
  'template_indicaciones.docx',
  'template_listado.docx',
  'templates/receta-hu-000-061-R-06-12.pdf',
  'templates/ic-seguimiento.docx',
  'public/**/*',
  'build/AppIcon.icns',
  'build/icon.ico',
];

/** Native addons: must ship in the app bundle and stay outside asar (.node load). */
const NATIVE_MODULE_PACK_PATTERNS = [
  'node_modules/better-sqlite3-multiple-ciphers/**/*',
  'node_modules/@node-rs/argon2*/**/*.node',
];

const ASAR_UNPACK_BASELINE = [
  'lib/doc-generators/**/*',
  'generate-receta-hu.js',
  'generate-censo.js',
  'template.docx',
  'template_indicaciones.docx',
  'template_listado.docx',
  'templates/receta-hu-000-061-R-06-12.pdf',
  'templates/ic-seguimiento.docx',
  ...NATIVE_MODULE_PACK_PATTERNS,
];

/** @param {string} rel */
function filePatternCovers(rel, patterns) {
  const normalized = rel.replace(/\\/g, '/');
  return patterns.some((pattern) => {
    if (pattern === normalized) return true;
    const globIdx = pattern.indexOf('/**/*');
    if (globIdx === -1) return false;
    const dir = pattern.slice(0, globIdx);
    const afterGlob = pattern.slice(globIdx + 5);
    if (normalized !== dir && !normalized.startsWith(`${dir}/`)) return false;
    if (!afterGlob || afterGlob === '*') return true;
    if (afterGlob.startsWith('.')) return normalized.endsWith(afterGlob);
    return normalized.includes(afterGlob);
  });
}

/** @param {string} src */
function localRequiresFromSource(src) {
  const out = [];
  for (const m of src.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
    out.push(m[1]);
  }
  return out;
}

/**
 * @param {string} fromFile
 * @param {string} reqPath
 * @param {string} root
 */
function resolveLocalRequire(fromFile, reqPath, root) {
  if (!reqPath.startsWith('.')) return null;
  const resolved = path.normalize(path.join(path.dirname(fromFile), reqPath));
  if (!resolved.startsWith(root)) return null;
  if (!fs.existsSync(resolved)) {
    if (fs.existsSync(`${resolved}.js`)) return `${resolved}.js`;
    if (fs.existsSync(`${resolved}.cjs`)) return `${resolved}.cjs`;
    return null;
  }
  return resolved;
}

/**
 * @param {string} entryAbs
 * @param {string} root
 */
function collectRuntimeRequires(entryAbs, root) {
  const seen = new Set();
  const queue = [entryAbs];

  while (queue.length) {
    const abs = queue.shift();
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    if (!fs.existsSync(abs)) continue;

    const src = fs.readFileSync(abs, 'utf8');
    for (const req of localRequiresFromSource(src)) {
      const target = resolveLocalRequire(abs, req, root);
      if (target && !seen.has(target)) queue.push(target);
    }
  }

  return [...seen].map((abs) => path.relative(root, abs).replace(/\\/g, '/'));
}

/** @param {string} rel */
function extraPatternForUncoveredFile(rel) {
  const parts = rel.split('/');
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}/**/*`;
  return rel;
}

/**
 * @param {string} root
 * @returns {string[]}
 */
function canonicalBuildFiles(root) {
  const patterns = [...PACK_FILES_BASELINE];
  const entryPoints = ['main.js', 'server.js'];
  const runtime = [];
  for (const entry of entryPoints) {
    const entryAbs = path.join(root, entry);
    if (!fs.existsSync(entryAbs)) {
      throw new Error(`No existe ${path.relative(root, entryAbs)}`);
    }
    runtime.push(...collectRuntimeRequires(entryAbs, root));
  }
  for (const rel of runtime) {
    if (filePatternCovers(rel, patterns)) continue;
    const extra = extraPatternForUncoveredFile(rel);
    if (!patterns.includes(extra)) patterns.push(extra);
    if (!filePatternCovers(rel, patterns)) {
      if (!patterns.includes(rel)) patterns.push(rel);
    }
  }

  for (const pattern of NATIVE_MODULE_PACK_PATTERNS) {
    if (!patterns.includes(pattern)) patterns.push(pattern);
  }

  return patterns;
}

/**
 * @returns {string[]}
 */
function canonicalAsarUnpack() {
  return [...ASAR_UNPACK_BASELINE];
}

/**
 * @param {string} root
 * @param {{ write?: boolean }} opts
 */
function ensureElectronPackFiles(root, opts = {}) {
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const nextFiles = canonicalBuildFiles(root);
  const nextAsarUnpack = canonicalAsarUnpack();
  const currentFiles = pkg.build?.files || [];
  const currentAsarUnpack = pkg.build?.asarUnpack || [];

  const filesMissing = nextFiles.filter((p) => !currentFiles.includes(p));
  const filesExtra = currentFiles.filter((p) => !nextFiles.includes(p));
  const filesChanged =
    filesMissing.length > 0 || filesExtra.length > 0 || currentFiles.length !== nextFiles.length;

  const asarMissing = nextAsarUnpack.filter((p) => !currentAsarUnpack.includes(p));
  const asarExtra = currentAsarUnpack.filter((p) => !nextAsarUnpack.includes(p));
  const asarChanged =
    asarMissing.length > 0 || asarExtra.length > 0 || currentAsarUnpack.length !== nextAsarUnpack.length;

  const changed = filesChanged || asarChanged;

  if (!changed) {
    return {
      changed: false,
      files: nextFiles,
      asarUnpack: nextAsarUnpack,
      missing: [],
      extra: [],
      asarMissing: [],
      asarExtra: [],
    };
  }

  if (!opts.write) {
    const lines = [];
    if (filesMissing.length) {
      lines.push(`build.files — añadir:\n${filesMissing.map((p) => `  + ${p}`).join('\n')}`);
    }
    if (filesExtra.length) {
      lines.push(`build.files — obsoletos:\n${filesExtra.map((p) => `  - ${p}`).join('\n')}`);
    }
    if (asarMissing.length) {
      lines.push(`build.asarUnpack — añadir:\n${asarMissing.map((p) => `  + ${p}`).join('\n')}`);
    }
    if (asarExtra.length) {
      lines.push(`build.asarUnpack — obsoletos:\n${asarExtra.map((p) => `  - ${p}`).join('\n')}`);
    }
    throw new Error(
      `package.json → build no coincide con la lista canónica del release.\n${lines.join('\n')}\n` +
        'Ejecuta: node scripts/lib/electron-pack-files.js --write'
    );
  }

  pkg.build = pkg.build || {};
  pkg.build.files = nextFiles;
  pkg.build.asarUnpack = nextAsarUnpack;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return {
    changed: true,
    files: nextFiles,
    asarUnpack: nextAsarUnpack,
    missing: filesMissing,
    extra: filesExtra,
    asarMissing,
    asarExtra,
  };
}

/**
 * @param {string} root
 */
function assertRuntimeCoveredByPatterns(root) {
  const patterns = canonicalBuildFiles(root);
  const runtime = [];
  for (const entry of ['main.js', 'server.js']) {
    runtime.push(...collectRuntimeRequires(path.join(root, entry), root));
  }
  const uncovered = runtime.filter((rel) => !filePatternCovers(rel, patterns));
  if (uncovered.length) {
    throw new Error(
      `Módulos de arranque sin cobertura en build.files:\n${uncovered.map((r) => `  - ${r}`).join('\n')}`
    );
  }
  return { patterns, runtime };
}

/**
 * @param {string} root
 */
function assertNativeModulesPacked(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const files = pkg.build?.files || [];
  const asarUnpack = pkg.build?.asarUnpack || [];
  const problems = [];

  for (const pattern of NATIVE_MODULE_PACK_PATTERNS) {
    if (!files.includes(pattern)) {
      problems.push(`build.files falta patrón nativo: ${pattern}`);
    }
    if (!asarUnpack.includes(pattern)) {
      problems.push(`build.asarUnpack falta patrón nativo: ${pattern}`);
    }
  }

  if (problems.length) {
    throw new Error(problems.join('\n'));
  }

  return { files, asarUnpack };
}

module.exports = {
  PACK_FILES_BASELINE,
  NATIVE_MODULE_PACK_PATTERNS,
  ASAR_UNPACK_BASELINE,
  filePatternCovers,
  collectRuntimeRequires,
  canonicalBuildFiles,
  canonicalAsarUnpack,
  ensureElectronPackFiles,
  assertRuntimeCoveredByPatterns,
  assertNativeModulesPacked,
};

if (require.main === module) {
  const root = path.join(__dirname, '../..');
  const write = process.argv.includes('--write');
  try {
    if (write) {
      const result = ensureElectronPackFiles(root, { write: true });
      if (result.changed) {
        console.log('Actualizado package.json → build.files / build.asarUnpack');
        if (result.missing.length) {
          console.log('build.files añadidos:', result.missing.join(', '));
        }
        if (result.extra.length) {
          console.log('build.files quitados:', result.extra.join(', '));
        }
        if (result.asarMissing.length) {
          console.log('build.asarUnpack añadidos:', result.asarMissing.join(', '));
        }
        if (result.asarExtra.length) {
          console.log('build.asarUnpack quitados:', result.asarExtra.join(', '));
        }
      } else {
        console.log('build.files y build.asarUnpack ya estaban al día.');
      }
    } else {
      ensureElectronPackFiles(root, { write: false });
      assertRuntimeCoveredByPatterns(root);
      assertNativeModulesPacked(root);
      console.log('build.files cubre el grafo de main.js + server.js y módulos nativos.');
    }
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}
