import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildLanJoinUrls, buildPermanentMobileJoinUrl, buildTeamHash, parseLanJoinQuery, parseLanInviteInput, resolveLanJoinHostUrl, resolveLiveSyncRoomIdFromSala, liveSyncRoomLabel, lanClinicalDirectoryPullRoomIds, LIVE_SYNC_SALA_DEFS } from './lan-join-link.mjs';

describe('lan-join-link', () => {
  it('buildPermanentMobileJoinUrl usa /mobile/?token= sin ticket', async () => {
    const u = await buildPermanentMobileJoinUrl('http://192.168.1.5:3738/', 'ward-token-abc');
    const parsed = new URL(u);
    assert.equal(parsed.pathname, '/mobile/');
    assert.equal(parsed.searchParams.get('token'), 'ward-token-abc');
    assert.ok(!u.includes('/join/req_'));
  });

  it('buildPermanentMobileJoinUrl includes th= when teamCode provided', async () => {
    const teamCode = 'ward-token-abc';
    const u = await buildPermanentMobileJoinUrl('http://192.168.1.5:3738/', teamCode);
    const th = await buildTeamHash(teamCode);
    assert.ok(th);
    assert.match(u, new RegExp(`[?&]th=${th}(?:&|$)`));
  });

  it('buildLanJoinUrls usa ruta /join/req_ sin code en query', async () => {
    const ticketId = 'req_a1b2c3d4e5f6';
    const u = await buildLanJoinUrls('http://192.168.1.5:3738/', ticketId);
    assert.equal(u.joinUrl, 'http://192.168.1.5:3738/join/req_a1b2c3d4e5f6');
    assert.equal(u.mobileUrl, 'http://192.168.1.5:3738/join/req_a1b2c3d4e5f6');
    assert.ok(!u.joinUrl.includes('code='));
  });

  it('buildTeamHash produces 8-char hex from teamCode', async () => {
    const h = await buildTeamHash('my-secret-team-code');
    assert.match(h, /^[0-9a-f]{8}$/);
  });

  it('buildTeamHash is consistent', async () => {
    const h1 = await buildTeamHash('abc');
    const h2 = await buildTeamHash('abc');
    assert.equal(h1, h2);
  });

  it('buildTeamHash differs for different team codes', async () => {
    const h1 = await buildTeamHash('ward-a');
    const h2 = await buildTeamHash('ward-b');
    assert.notEqual(h1, h2);
  });

  it('parseLanJoinQuery lee code y room (legacy query helper)', () => {
    const p = parseLanJoinQuery('?code=xyz&room=r1', 'http://10.0.0.2:3738');
    assert.equal(p.teamCode, 'xyz');
    assert.equal(p.roomId, 'r1');
    assert.equal(p.hostUrl, 'http://10.0.0.2:3738');
  });

  it('parseLanJoinQuery reemplaza host localhost por origin del iPad', () => {
    const p = parseLanJoinQuery(
      '?code=abc&host=http://127.0.0.1:3738',
      'http://192.168.0.44:3738'
    );
    assert.equal(p.hostUrl, 'http://192.168.0.44:3738');
  });

  it('parseLanJoinQuery resuelve room desde sala', () => {
    const p = parseLanJoinQuery('?code=x&sala=Sala%202', 'http://10.0.0.2:3738');
    assert.equal(p.roomId, 'sala-2');
  });

  it('resolveLiveSyncRoomIdFromSala mapea etiquetas', () => {
    assert.equal(resolveLiveSyncRoomIdFromSala('Sala E'), 'sala-e');
    assert.equal(resolveLiveSyncRoomIdFromSala('Torre HU'), 'torre-hu');
    assert.equal(resolveLiveSyncRoomIdFromSala('Área A/Pensionistas'), 'area-a-pensionistas');
    assert.equal(liveSyncRoomLabel('sala-1'), 'Sala 1');
    assert.equal(liveSyncRoomLabel('torre-hu'), 'Torre HU');
  });

  it('resolveLanJoinHostUrl prefiere IP LAN sobre localhost', () => {
    assert.equal(
      resolveLanJoinHostUrl('http://127.0.0.1:3738', 'http://192.168.1.10:3738'),
      'http://192.168.1.10:3738'
    );
    assert.equal(resolveLanJoinHostUrl('http://10.0.0.5:3738', ''), 'http://10.0.0.5:3738');
  });

  it('parseLanJoinQuery acepta alias token', () => {
    const p = parseLanJoinQuery('?token=abc&room=r2', 'http://10.0.0.3:3738');
    assert.equal(p.teamCode, 'abc');
    assert.equal(p.roomId, 'r2');
  });

  it('parseLanInviteInput lee URL /join/req_', () => {
    const p = parseLanInviteInput('http://192.168.0.10:3738/join/req_deadbeefcafe');
    assert.equal(p.hostUrl, 'http://192.168.0.10:3738');
    assert.equal(p.ticketId, 'req_deadbeefcafe');
    assert.equal(p.teamCode, '');
    assert.equal(p.legacyInvite, false);
  });

  it('parseLanInviteInput marca legacy ?code= sin devolver token', () => {
    const p = parseLanInviteInput('http://192.168.0.10:3738/join?code=sec&room=sala1');
    assert.equal(p.hostUrl, 'http://192.168.0.10:3738');
    assert.equal(p.teamCode, '');
    assert.equal(p.roomId, 'sala1');
    assert.equal(p.legacyInvite, true);
    assert.equal(p.ticketId, '');
  });

  it('parseLanInviteInput lee enlace permanente /mobile/?token=', () => {
    const p = parseLanInviteInput(
      'http://192.168.0.10:3738/mobile/?token=ward-sec&user=jperez&room=sala-2'
    );
    assert.equal(p.hostUrl, 'http://192.168.0.10:3738');
    assert.equal(p.teamCode, 'ward-sec');
    assert.equal(p.roomId, 'sala-2');
    assert.equal(p.legacyInvite, false);
    assert.equal(p.ticketId, '');
  });

  it('parseLanInviteInput extrae ticket de texto con contexto', () => {
    const p = parseLanInviteInput(
      'Hola — abre esto:\nhttp://192.168.0.10:3738/join/req_cafebabef00d\nGracias'
    );
    assert.equal(p.ticketId, 'req_cafebabef00d');
    assert.equal(p.legacyInvite, false);
  });

  it('parseLanInviteInput reconoce dirección base del anfitrión (Copiar dirección)', () => {
    const p = parseLanInviteInput('http://192.168.0.10:3738');
    assert.equal(p.hostUrl, 'http://192.168.0.10:3738');
    assert.equal(p.bareHost, true);
    assert.equal(p.ticketId, '');
  });

  it('parseLanInviteInput reconoce IP:3738 sin esquema', () => {
    const p = parseLanInviteInput('10.0.57.52:3738');
    assert.equal(p.hostUrl, 'http://10.0.57.52:3738');
    assert.equal(p.bareHost, true);
  });

  it('parseLanInviteInput extrae PIN junto a dirección', () => {
    const p = parseLanInviteInput('http://10.0.57.52:3738 482910');
    assert.equal(p.hostUrl, 'http://10.0.57.52:3738');
    assert.equal(p.shiftPin, '482910');
    assert.equal(p.bareHost, true);
  });

  it('parseLanInviteInput lee PIN suelto de 6 dígitos', () => {
    const p = parseLanInviteInput('482910');
    assert.equal(p.shiftPin, '482910');
    assert.equal(p.bareHost, false);
  });

  it('parseLanInviteInput marca query suelta legacy', () => {
    const p = parseLanInviteInput('code=only&room=r9');
    assert.equal(p.teamCode, '');
    assert.equal(p.roomId, 'r9');
    assert.equal(p.legacyInvite, true);
  });

  it('lanClinicalDirectoryPullRoomIds lists every sala when allRooms', () => {
    const ids = lanClinicalDirectoryPullRoomIds({ allRooms: true });
    assert.equal(ids.length, LIVE_SYNC_SALA_DEFS.length);
    assert.ok(ids.includes('sala-1'));
    assert.ok(ids.includes('interconsultas'));
    assert.ok(ids.includes('ux'));
    assert.ok(ids.includes('eme'));
  });

  it('lanClinicalDirectoryPullRoomIds single room uses active only', () => {
    assert.deepEqual(lanClinicalDirectoryPullRoomIds({ activeRoomId: 'sala-2' }), ['sala-2']);
    assert.deepEqual(lanClinicalDirectoryPullRoomIds({ allRooms: true, activeRoomId: 'sala-2' }), [
      'sala-1',
      'sala-2',
      'sala-e',
      'torre-hu',
      'area-a-pensionistas',
      'interconsultas',
      'ux',
      'eme',
    ]);
  });
});
