#!/usr/bin/env node
/**
 * Graph topology analysis for tour-builder (Phase 1).
 * Usage: node ua-tour-analyze.js <input.json> <output.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ENTRY_FILENAME_SCORES = new Map([
  ['index.ts', 3], ['index.js', 3], ['index.mjs', 3],
  ['main.ts', 3], ['main.js', 3], ['main.mjs', 3],
  ['app.ts', 3], ['app.js', 3], ['app.mjs', 3],
  ['server.ts', 3], ['server.js', 3],
  ['mod.rs', 3], ['main.go', 3], ['main.py', 3], ['main.rs', 3],
  ['manage.py', 3], ['app.py', 3], ['wsgi.py', 3], ['asgi.py', 3],
  ['run.py', 3], ['__main__.py', 3],
  ['Application.java', 3], ['Main.java', 3], ['Program.cs', 3],
  ['config.ru', 3], ['index.php', 3], ['App.swift', 3],
  ['Application.kt', 3], ['main.cpp', 3], ['main.c', 3],
]);

const CODE_TYPES = new Set(['file', 'function', 'class']);
const BFS_EDGE_TYPES = new Set(['imports', 'calls']);

function isCodeFile(node) {
  return node.type === 'file';
}

function basename(name) {
  return name.split('/').pop() || name;
}

function depthFromRoot(filePath) {
  if (!filePath) return 99;
  const parts = filePath.split('/').filter(Boolean);
  return parts.length <= 1 ? 0 : parts.length <= 2 ? 1 : 2;
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error('Usage: node ua-tour-analyze.js <input.json> <output.json>');
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (err) {
    console.error(`Failed to read input: ${err.message}`);
    process.exit(1);
  }

  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const layers = data.layers || [];

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Fan-in / fan-out (all edge types count toward structural importance)
  const fanIn = new Map();
  const fanOut = new Map();
  for (const n of nodes) {
    fanIn.set(n.id, 0);
    fanOut.set(n.id, 0);
  }
  for (const e of edges) {
    if (nodeById.has(e.target)) fanIn.set(e.target, (fanIn.get(e.target) || 0) + 1);
    if (nodeById.has(e.source)) fanOut.set(e.source, (fanOut.get(e.source) || 0) + 1);
  }

  const fanInRanking = [...fanIn.entries()]
    .map(([id, fanInCount]) => ({
      id,
      fanIn: fanInCount,
      name: nodeById.get(id)?.name || id,
    }))
    .sort((a, b) => b.fanIn - a.fanIn)
    .slice(0, 20);

  const fanOutRanking = [...fanOut.entries()]
    .map(([id, fanOutCount]) => ({
      id,
      fanOut: fanOutCount,
      name: nodeById.get(id)?.name || id,
    }))
    .sort((a, b) => b.fanOut - a.fanOut)
    .slice(0, 20);

  const fanOutValues = [...fanOut.values()].sort((a, b) => a - b);
  const top10FanOutThreshold =
    fanOutValues.length > 0
      ? fanOutValues[Math.floor(fanOutValues.length * 0.9)] || 0
      : 0;

  const fanInValues = [...fanIn.values()].sort((a, b) => a - b);
  const bottom25FanInThreshold =
    fanInValues.length > 0
      ? fanInValues[Math.floor(fanInValues.length * 0.25)] || 0
      : 0;

  const entryScores = [];
  for (const node of nodes) {
    let score = 0;
    if (node.type === 'document') {
      const fp = node.filePath || node.name || '';
      if (fp === 'README.md' || fp.endsWith('/README.md') && basename(fp) === 'README.md' && depthFromRoot(fp) <= 1) {
        if (fp === 'README.md') score += 5;
        else score += 2;
      } else if (fp.endsWith('.md') && depthFromRoot(fp) <= 1) {
        score += 2;
      }
    } else if (isCodeFile(node)) {
      const name = basename(node.name || node.filePath || '');
      if (ENTRY_FILENAME_SCORES.has(name)) score += 3;
      const d = depthFromRoot(node.filePath);
      if (d <= 1) score += 1;
      const fo = fanOut.get(node.id) || 0;
      const fi = fanIn.get(node.id) || 0;
      if (fo >= top10FanOutThreshold) score += 1;
      if (fi <= bottom25FanInThreshold) score += 1;
    }
    if (score > 0) {
      entryScores.push({
        id: node.id,
        score,
        name: node.name,
        summary: node.summary || '',
      });
    }
  }
  entryScores.sort((a, b) => b.score - a.score);
  const entryPointCandidates = entryScores.slice(0, 5);

  // BFS from top code entry point
  const topCodeEntry =
    entryPointCandidates.find((c) => isCodeFile(nodeById.get(c.id) || {})) ||
    fanOutRanking.find((r) => isCodeFile(nodeById.get(r.id) || {}));

  const adjacency = new Map();
  for (const e of edges) {
    if (!BFS_EDGE_TYPES.has(e.type)) continue;
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source).push(e.target);
  }

  const startNode = topCodeEntry?.id || null;
  const bfsOrder = [];
  const depthMap = {};
  const byDepth = {};

  if (startNode) {
    const queue = [{ id: startNode, depth: 0 }];
    const visited = new Set();
    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      bfsOrder.push(id);
      depthMap[id] = depth;
      const key = String(depth);
      if (!byDepth[key]) byDepth[key] = [];
      byDepth[key].push(id);
      for (const next of adjacency.get(id) || []) {
        if (!visited.has(next)) queue.push({ id: next, depth: depth + 1 });
      }
    }
  }

  // Non-code inventory
  const nonCodeFiles = {
    documentation: [],
    infrastructure: [],
    data: [],
    config: [],
  };

  for (const node of nodes) {
    const entry = {
      id: node.id,
      name: node.name,
      summary: node.summary || '',
    };
    switch (node.type) {
      case 'document':
        nonCodeFiles.documentation.push(entry);
        break;
      case 'service':
      case 'pipeline':
      case 'resource':
        nonCodeFiles.infrastructure.push(entry);
        break;
      case 'table':
      case 'schema':
      case 'endpoint':
        nonCodeFiles.data.push(entry);
        break;
      case 'config':
        nonCodeFiles.config.push(entry);
        break;
      default:
        break;
    }
  }

  // Clusters: bidirectional imports/calls, expand by 2+ connections
  const forward = new Map();
  const reverse = new Map();
  for (const e of edges) {
    if (!BFS_EDGE_TYPES.has(e.type)) continue;
    if (!forward.has(e.source)) forward.set(e.source, new Set());
    forward.get(e.source).add(e.target);
    if (!reverse.has(e.target)) reverse.set(e.target, new Set());
    reverse.get(e.target).add(e.source);
  }

  const bidirectionalPairs = [];
  for (const [a, targets] of forward) {
    for (const b of targets) {
      if (forward.get(b)?.has(a) && a < b) {
        bidirectionalPairs.push([a, b]);
      }
    }
  }

  const clusters = [];
  const usedInCluster = new Set();

  function buildCluster(seedA, seedB) {
    const members = new Set([seedA, seedB]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of nodes) {
        if (members.has(node.id)) continue;
        let connections = 0;
        for (const m of members) {
          if (forward.get(node.id)?.has(m) || forward.get(m)?.has(node.id)) connections++;
        }
        if (connections >= 2) {
          members.add(node.id);
          changed = true;
        }
      }
    }
    return [...members];
  }

  for (const [a, b] of bidirectionalPairs) {
    if (usedInCluster.has(a) && usedInCluster.has(b)) continue;
    const clusterNodes = buildCluster(a, b);
    if (clusterNodes.length < 2 || clusterNodes.length > 8) continue;
    let edgeCount = 0;
    for (let i = 0; i < clusterNodes.length; i++) {
      for (let j = i + 1; j < clusterNodes.length; j++) {
        const x = clusterNodes[i];
        const y = clusterNodes[j];
        if (forward.get(x)?.has(y) || forward.get(y)?.has(x)) edgeCount++;
      }
    }
    clusters.push({ nodes: clusterNodes, edgeCount });
    for (const id of clusterNodes) usedInCluster.add(id);
  }
  clusters.sort((a, b) => b.edgeCount - a.edgeCount);
  const topClusters = clusters.slice(0, 10);

  const nodeSummaryIndex = {};
  for (const node of nodes) {
    nodeSummaryIndex[node.id] = {
      name: node.name,
      type: node.type,
      summary: node.summary || '',
      filePath: node.filePath,
    };
  }

  const result = {
    scriptCompleted: true,
    entryPointCandidates,
    fanInRanking,
    fanOutRanking,
    bfsTraversal: {
      startNode,
      order: bfsOrder,
      depthMap,
      byDepth,
    },
    nonCodeFiles,
    clusters: topClusters,
    layers: {
      count: layers.length,
      list: layers.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
      })),
    },
    nodeSummaryIndex,
    totalNodes: nodes.length,
    totalEdges: edges.length,
  };

  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.error(`Analysis complete: ${nodes.length} nodes, ${edges.length} edges`);
}

main();
