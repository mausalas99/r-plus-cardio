#!/usr/bin/env node
/**
 * Print instructions to generate VAPID keys for equipos Web Push.
 * Run: npx @pushforge/builder vapid
 */
console.log('Generate equipos Web Push VAPID keys:\n');
console.log('  npx @pushforge/builder vapid\n');
console.log('Then configure:');
console.log('  EQUIPOS_VAPID_PUBLIC_KEY=<public key from CLI>');
console.log('  EQUIPOS_VAPID_PRIVATE_JWK=<private JWK JSON string>');
console.log('\nCloudflare Worker:');
console.log('  wrangler secret put EQUIPOS_VAPID_PRIVATE_JWK');
console.log('  wrangler.toml [vars] EQUIPOS_VAPID_PUBLIC_KEY=...');
console.log('\nLAN host (server.js): same env vars in .env');
