/** Cardionotas local HTTP port (R+ uses 3738). Keep in sync with `lib/http-port.js`. */
export const CARDIONOTAS_HTTP_PORT = 3838;

export function cardionotasLoopbackBaseUrl() {
  return 'http://127.0.0.1:' + CARDIONOTAS_HTTP_PORT;
}

export function cardionotasLocalhostBaseUrl() {
  return 'http://localhost:' + CARDIONOTAS_HTTP_PORT;
}
