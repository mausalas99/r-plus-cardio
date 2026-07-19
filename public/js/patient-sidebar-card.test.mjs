import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatPatientBedLabel,
  renderPatientSidebarBodyHtml,
} from './patient-sidebar-card.mjs';

describe('patient-sidebar-card', () => {
  it('formatPatientBedLabel joins cuarto and cama', () => {
    assert.equal(formatPatientBedLabel({ cuarto: '412', cama: '2' }), '412·2');
    assert.equal(formatPatientBedLabel({}), '');
  });

  it('renderPatientSidebarBodyHtml shows full name and Cto./Cama meta', () => {
    const html = renderPatientSidebarBodyHtml({
      nombre: 'GARCIA LOPEZ JUAN',
      cuarto: '412',
      cama: '2',
      registro: '12345',
      servicio: 'Medicina Interna',
    });
    assert.match(html, /GARCIA LOPEZ JUAN/);
    assert.match(html, /Cto\. 412/);
    assert.match(html, /Cama 2/);
    assert.match(html, /Medicina Interna/);
    assert.doesNotMatch(html, /Reg\./);
    assert.doesNotMatch(html, /patient-card-pin-badge/);
  });

  it('hides servicio in modo sala', () => {
    const html = renderPatientSidebarBodyHtml(
      {
        nombre: 'PEREZ TRISTAN, ANGELITA',
        cuarto: '201',
        cama: '2',
        servicio: 'Medicina Interna',
      },
      { showServicio: false }
    );
    assert.match(html, /PEREZ TRISTAN, ANGELITA/);
    assert.match(html, /Cto\. 201/);
    assert.match(html, /Cama 2/);
    assert.doesNotMatch(html, /Medicina Interna/);
  });
});
