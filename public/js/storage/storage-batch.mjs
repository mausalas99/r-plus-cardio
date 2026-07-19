// Request batching for /generate and /generate-indicaciones
let pendingRequests = [];
let batchTimeout;

const BATCH_DELAY = 100; // ms

export function batchFetch(endpoint, data) {
  pendingRequests.push({ endpoint, data });

  clearTimeout(batchTimeout);
  batchTimeout = setTimeout(() => {
    const batch = pendingRequests.splice(0);
    Promise.all(batch.map(r =>
      fetch(r.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r.data)
      })
    )).catch(err => console.error('Batch fetch error:', err));
  }, BATCH_DELAY);
}

export function flushBatch() {
  clearTimeout(batchTimeout);
  if (pendingRequests.length > 0) {
    const batch = pendingRequests.splice(0);
    Promise.all(batch.map(r =>
      fetch(r.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r.data)
      })
    )).catch(err => console.error('Batch fetch error:', err));
  }
}