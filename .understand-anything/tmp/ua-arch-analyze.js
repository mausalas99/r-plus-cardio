#!/usr/bin/env node
/**
 * Structural analysis for Understand Anything Phase 4.
 * Usage: node ua-arch-analyze.js <input.json> <output.json>
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FILE_LEVEL_TYPES = new Set([
  'file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint',
]);

const DIR_PATTERNS = {
  routes: 'api', api: 'api', controllers: 'api', endpoints: 'api', handlers: 'api',
  services: 'service', core: 'service', lib: 'service', domain: 'logic', logic: 'service',
  models: 'data', db: 'data', data: 'data', persistence: 'data', repository: 'data', entities: 'data',
  components: 'ui', views: 'ui', pages: 'ui', ui: 'ui', layouts: 'ui', screens: 'ui',
  middleware: 'middleware', plugins: 'middleware', interceptors: 'middleware', guards: 'middleware',
  utils: 'utility', helpers: 'utility', common: 'utility', shared: 'utility', tools: 'utility',
  config: 'config', constants: 'config', env: 'config', settings: 'config',
  __tests__: 'test', test: 'test', tests: 'test', spec: 'test', specs: 'test',
  types: 'types', interfaces: 'types', schemas: 'types', contracts: 'types', dtos: 'types',
  hooks: 'hooks',
  store: 'state', state: 'state', reducers: 'state', actions: 'state', slices: 'state',
  assets: 'assets', static: 'assets', public: 'assets',
  migrations: 'data',
  management: 'config', commands: 'config',
  docs: 'documentation', documentation: 'documentation', wiki: 'documentation',
  deploy: 'infrastructure', deployment: 'infrastructure', infra: 'infrastructure', infrastructure: 'infrastructure',
  '.github': 'ci-cd', '.gitlab': 'ci-cd', '.circleci': 'ci-cd',
  k8s: 'infrastructure', kubernetes: 'infrastructure', helm: 'infrastructure', charts: 'infrastructure',
  terraform: 'infrastructure', tf: 'infrastructure', docker: 'infrastructure',
  sql: 'data', database: 'data', schema: 'data',
  features: 'ui', scripts: 'config', interno: 'ui',
  'lan-squad': 'service',
};

function classifyFile(filePath, nodeType) {
  const base = path.basename(filePath);
  if (/\.(test|spec)\.(mjs|js|ts|tsx)$/.test(base) || /^test_/.test(base)) return 'test';
  if (/\.d\.ts$/.test(base)) return 'types';
  if (/^(index|__init__)\.(ts|js|mjs|py)$/.test(base)) return 'entry';
  if (/^(Dockerfile|docker-compose)/.test(base)) return 'infrastructure';
  if (/\.(tf|tfvars)$/.test(base)) return 'infrastructure';
  if (/\.(md|rst)$/.test(base)) return 'documentation';
  if (/\.sql$/.test(base)) return 'data';
  if (/\.(graphql|gql|proto)$/.test(base)) return 'types';
  if (/^(package\.json|tsconfig|Cargo\.toml|go\.mod|Gemfile|pom\.xml|build\.gradle|composer\.json)$/.test(base)) return 'config';
  if (/Makefile/.test(base)) return 'infrastructure';
  if (nodeType === 'document') return 'documentation';
  if (nodeType === 'config') return 'config';
  if (nodeType === 'pipeline') return 'ci-cd';
  if (nodeType === 'service' || nodeType === 'resource') return 'infrastructure';
  if (nodeType === 'table' || nodeType === 'schema') return 'data';
  if (nodeType === 'endpoint') return 'api';
  return null;
}

function commonPrefix(paths) {
  if (!paths.length) return '';
  const split = paths.map((p) => p.split('/'));
  const minLen = Math.min(...split.map((s) => s.length));
  const prefix = [];
  for (let i = 0; i < minLen; i++) {
    const seg = split[0][i];
    if (split.every((s) => s[i] === seg)) prefix.push(seg);
    else break;
  }
  return prefix.length ? prefix.join('/') + '/' : '';
}

function dirGroup(filePath, prefix) {
  const rel = prefix && filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
  const parts = rel.split('/').filter(Boolean);
  if (parts.length <= 1) return '(root)';
  return parts[0];
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error('Usage: node ua-arch-analyze.js <input.json> <output.json>');
    process.exit(1);
  }

  let input;
  try {
    input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (e) {
    console.error('Failed to read input:', e.message);
    process.exit(1);
  }

  const { fileNodes = [], importEdges = [], allEdges = [] } = input;
  const fileIdSet = new Set(fileNodes.map((n) => n.id));
  const paths = fileNodes.map((n) => n.filePath || n.id.replace(/^[^:]+:/, ''));
  const prefix = commonPrefix(paths);

  // A. Directory grouping
  const directoryGroups = {};
  for (const n of fileNodes) {
    const fp = n.filePath || '';
    const g = dirGroup(fp, prefix);
    if (!directoryGroups[g]) directoryGroups[g] = [];
    directoryGroups[g].push(n.id);
  }

  // B. Node type grouping
  const nodeTypeGroups = {};
  for (const n of fileNodes) {
    if (!nodeTypeGroups[n.type]) nodeTypeGroups[n.type] = [];
    nodeTypeGroups[n.type].push(n.id);
  }

  // C. Import adjacency
  const fileFanOut = {};
  const fileFanIn = {};
  for (const id of fileIdSet) {
    fileFanOut[id] = 0;
    fileFanIn[id] = 0;
  }
  for (const e of importEdges) {
    if (fileIdSet.has(e.source) && fileIdSet.has(e.target)) {
      fileFanOut[e.source] = (fileFanOut[e.source] || 0) + 1;
      fileFanIn[e.target] = (fileFanIn[e.target] || 0) + 1;
    }
  }

  const nodeToGroup = {};
  for (const [g, ids] of Object.entries(directoryGroups)) {
    for (const id of ids) nodeToGroup[id] = g;
  }

  const interGroupImports = {};
  for (const e of importEdges) {
    if (!fileIdSet.has(e.source) || !fileIdSet.has(e.target)) continue;
    const fromG = nodeToGroup[e.source];
    const toG = nodeToGroup[e.target];
    if (!fromG || !toG) continue;
    const key = `${fromG}\t${toG}`;
    interGroupImports[key] = (interGroupImports[key] || 0) + 1;
  }

  const interGroupList = Object.entries(interGroupImports).map(([k, count]) => {
    const [from, to] = k.split('\t');
    return { from, to, count };
  });

  // D. Cross-category edges
  const crossCat = {};
  for (const e of allEdges) {
    if (!fileIdSet.has(e.source) && !fileIdSet.has(e.target)) continue;
    const srcNode = fileNodes.find((n) => n.id === e.source);
    const tgtNode = fileNodes.find((n) => n.id === e.target);
    if (!srcNode || !tgtNode) continue;
    const key = `${srcNode.type}\t${tgtNode.type}\t${e.type}`;
    crossCat[key] = (crossCat[key] || 0) + 1;
  }
  const crossCategoryEdges = Object.entries(crossCat).map(([k, count]) => {
    const [fromType, toType, edgeType] = k.split('\t');
    return { fromType, toType, edgeType, count };
  });

  // E. already done as interGroupList

  // F. Intra-group density
  const intraGroupDensity = {};
  for (const g of Object.keys(directoryGroups)) {
    let internalEdges = 0;
    let totalEdges = 0;
    for (const e of importEdges) {
      if (!fileIdSet.has(e.source) || !fileIdSet.has(e.target)) continue;
      const fromG = nodeToGroup[e.source];
      const toG = nodeToGroup[e.target];
      if (fromG === g || toG === g) totalEdges++;
      if (fromG === g && toG === g) internalEdges++;
    }
    intraGroupDensity[g] = {
      internalEdges,
      totalEdges,
      density: totalEdges ? internalEdges / totalEdges : 0,
    };
  }

  // G. Pattern matches
  const patternMatches = {};
  for (const [g] of Object.entries(directoryGroups)) {
    if (DIR_PATTERNS[g]) {
      patternMatches[g] = DIR_PATTERNS[g];
    } else {
      patternMatches[g] = 'other';
    }
  }
  for (const n of fileNodes) {
    const fp = n.filePath || '';
    const filePat = classifyFile(fp, n.type);
    if (filePat && patternMatches[nodeToGroup[n.id]] === 'other') {
      patternMatches[nodeToGroup[n.id]] = filePat;
    }
  }

  // H. Deployment topology
  const infraFiles = [];
  let hasDockerfile = false;
  let hasCompose = false;
  let hasK8s = false;
  let hasTerraform = false;
  let hasCI = false;
  for (const n of fileNodes) {
    const fp = n.filePath || '';
    const base = path.basename(fp);
    if (/^Dockerfile/.test(base)) { hasDockerfile = true; infraFiles.push(fp); }
    if (/docker-compose/.test(base)) { hasCompose = true; infraFiles.push(fp); }
    if (/\.(yaml|yml)$/.test(base) && fp.includes('k8s')) { hasK8s = true; infraFiles.push(fp); }
    if (/\.tf$/.test(base)) { hasTerraform = true; infraFiles.push(fp); }
    if (n.type === 'pipeline' || fp.includes('.github/workflows')) { hasCI = true; infraFiles.push(fp); }
  }

  // I. Data pipeline
  const schemaFiles = [];
  const migrationFiles = [];
  const dataModelFiles = [];
  const apiHandlerFiles = [];
  for (const n of fileNodes) {
    const fp = n.filePath || '';
    if (n.type === 'schema' || n.type === 'table' || /\.sql$/.test(fp)) schemaFiles.push(fp);
    if (/migrations?\//.test(fp)) migrationFiles.push(fp);
    if (/lib\/db\//.test(fp) || /models?\//.test(fp)) dataModelFiles.push(fp);
    if (/server\.js$/.test(fp) || /host-router/.test(fp) || /routes?\//.test(fp)) apiHandlerFiles.push(fp);
  }

  // J. Doc coverage
  const groupsWithDocs = new Set();
  for (const n of fileNodes) {
    if (n.type !== 'document') continue;
    const fp = n.filePath || '';
    const g = dirGroup(fp, prefix);
    groupsWithDocs.add(g);
    if (path.basename(fp).toLowerCase() === 'readme.md') {
      const parent = path.dirname(fp);
      const parentGroup = dirGroup(parent + '/x', prefix).replace(/\/x$/, '') || '(root)';
      groupsWithDocs.add(parentGroup);
    }
  }
  const totalGroups = Object.keys(directoryGroups).length;
  const undocumentedGroups = Object.keys(directoryGroups).filter((g) => !groupsWithDocs.has(g));

  // K. Dependency direction
  const pairCounts = {};
  for (const { from, to, count } of interGroupList) {
    if (from === to) continue;
    const key = [from, to].sort().join('\t');
    if (!pairCounts[key]) pairCounts[key] = {};
    pairCounts[key][from + '->' + to] = count;
  }
  const dependencyDirection = [];
  for (const { from, to, count } of interGroupList) {
    if (from === to) continue;
    const reverse = interGroupImports[`${to}\t${from}`] || 0;
    if (count > reverse) dependencyDirection.push({ dependent: from, dependsOn: to });
  }

  const nodeTypeCounts = {};
  for (const [t, ids] of Object.entries(nodeTypeGroups)) nodeTypeCounts[t] = ids.length;

  const filesPerGroup = {};
  for (const [g, ids] of Object.entries(directoryGroups)) filesPerGroup[g] = ids.length;

  const output = {
    scriptCompleted: true,
    directoryGroups,
    nodeTypeGroups,
    crossCategoryEdges,
    interGroupImports: interGroupList,
    intraGroupDensity,
    patternMatches,
    deploymentTopology: {
      hasDockerfile,
      hasCompose,
      hasK8s,
      hasTerraform,
      hasCI,
      infraFiles: [...new Set(infraFiles)],
    },
    dataPipeline: {
      schemaFiles: [...new Set(schemaFiles)],
      migrationFiles: [...new Set(migrationFiles)],
      dataModelFiles: [...new Set(dataModelFiles)],
      apiHandlerFiles: [...new Set(apiHandlerFiles)],
    },
    docCoverage: {
      groupsWithDocs: groupsWithDocs.size,
      totalGroups,
      coverageRatio: totalGroups ? groupsWithDocs.size / totalGroups : 0,
      undocumentedGroups,
    },
    dependencyDirection,
    fileStats: {
      totalFileNodes: fileNodes.length,
      filesPerGroup,
      nodeTypeCounts,
    },
    fileFanIn,
    fileFanOut,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  process.exit(0);
}

main();
