import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMedPharmRowKey,
  buildMedPharmMedGroupKey,
  extractMedBaseName,
  adherenceStats,
  toggleNotAdmin,
  splitMonthAt,
  parseSomePharmMonthPaste,
  looksLikeSomePharmMonthPaste,
  mergeRecetaIntoMonth,
  parseRecetaDateToDay,
  applySomePasteToProfile,
  medPharmProfileUpdatedAt,
  formatFreqShort,
  profileHasMonthData,
  monthHasData,
  deleteMonthFromProfile,
} from './med-pharm-profile-core.mjs';

describe('buildMedPharmRowKey', () => {
  it('normaliza y concatena campos', () => {
    const k = buildMedPharmRowKey({
      med: '  Metamizol 2.5 G ',
      dosis: '1 G //',
      freq: 'Q8H',
      via: 'VIA INTRAVENOSA',
    });
    assert.equal(k, 'METAMIZOL 2.5 G|1 G|Q8H|VIA INTRAVENOSA');
  });

  it('ignora DIA# en dosis para la clave', () => {
    const a = buildMedPharmRowKey({
      med: 'CEFALOTINA 1 G',
      dosis: '2 G // *DIA# 1*',
      freq: 'Q4H',
      via: 'VIA INTRAVENOSA',
    });
    const b = buildMedPharmRowKey({
      med: 'CEFALOTINA 1 G',
      dosis: '2 G // *DIA# 4*',
      freq: 'Q4H',
      via: 'VIA INTRAVENOSA',
    });
    assert.equal(a, b);
  });
});

describe('extractMedBaseName', () => {
  it('agrupa presentaciones del mismo fármaco', () => {
    const a = extractMedBaseName('PARACETAMOL 1 G SOL INY 100 ML (*)');
    const b = extractMedBaseName('PARACETAMOL 500 MG SOL INY 50 ML (*)');
    assert.equal(a, 'PARACETAMOL');
    assert.equal(b, 'PARACETAMOL');
    assert.equal(buildMedPharmMedGroupKey(a), buildMedPharmMedGroupKey(b));
  });

  it('separa forma inyectable vs tableta del mismo principio', () => {
    const a = extractMedBaseName('VORICONAZOL 200 MG SOL INY 20 ML');
    const b = extractMedBaseName('VORICONAZOL 200 MG TABLETA');
    assert.equal(a, 'VORICONAZOL');
    assert.equal(b, 'VORICONAZOL');
  });

  it('conserva nombre compuesto antes de la dosis', () => {
    assert.equal(extractMedBaseName('ACIDO ACETILSALICILICO 100 MG TABLETA'), 'ACIDO ACETILSALICILICO');
    assert.equal(extractMedBaseName('LIDOCAINA 10 % SPRAY 115 ML'), 'LIDOCAINA');
  });
});

describe('adherenceStats', () => {
  it('cuenta efectivos y no pasados', () => {
    const days = { 1: 1, 2: 1, 5: 1 };
    const notAdmin = { 5: true };
    const s = adherenceStats(days, notAdmin);
    assert.equal(s.indicated, 3);
    assert.equal(s.missed, 1);
    assert.equal(s.effective, 2);
    assert.deepEqual(s.missedDays, [5]);
  });
});

describe('toggleNotAdmin', () => {
  it('solo alterna si el día está indicado', () => {
    const days = { 3: 1 };
    let na = {};
    na = toggleNotAdmin(days, na, 3);
    assert.equal(na[3], true);
    na = toggleNotAdmin(days, na, 3);
    assert.equal(na[3], undefined);
    assert.deepEqual(toggleNotAdmin(days, {}, 9), {});
  });
});

describe('splitMonthAt', () => {
  it('divide 31 días en 16 + 15', () => {
    assert.equal(splitMonthAt(31), 16);
    assert.equal(splitMonthAt(30), 15);
  });
});

describe('parseSomePharmMonthPaste', () => {
  it('extrae fila con días indicados', () => {
    const raw =
      'Medicamento\tDosis\tFreq\tVia\t01\t02\t03\t04\t05\n' +
      'METAMIZOL 2.5 G\t1 G //\tQ8H\tVIA INTRAVENOSA\t1\t\t\t\t1\n';
    const res = parseSomePharmMonthPaste(raw, { year: 2026, monthIndex: 4 });
    assert.ok(res.rows.length >= 1);
    const row = res.rows.find(function (r) {
      return r.med.indexOf('METAMIZOL') >= 0;
    });
    assert.ok(row);
    assert.equal(row.days[1], 1);
    assert.equal(row.days[5], 1);
  });

  it('fusiona filas SOME con mismo régimen y distinto DIA#', () => {
    const header =
      'Med\tDosis\tFreq\tVia\t' +
      Array.from({ length: 31 }, function (_, i) {
        return String(i + 1).padStart(2, '0');
      }).join('\t');
    const mkRow = function (dia, day) {
      const days = Array(31).fill('');
      days[day - 1] = '1';
      return (
        'VANCOMICINA 500 MG SOL INY 10 ML (*)\t1250 MG DILUIR EN 250 CC // *DIA# ' +
        dia +
        '*\tQ12H\tVIA INTRAVENOSA\t' +
        days.join('\t')
      );
    };
    const raw = [header, mkRow(8, 8), mkRow(9, 9), mkRow(10, 10), mkRow(11, 11), mkRow(12, 12), mkRow(13, 13)].join(
      '\n'
    );
    const res = parseSomePharmMonthPaste(raw, { year: 2026, monthIndex: 5 });
    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].days[8], 1);
    assert.equal(res.rows[0].days[13], 1);
    assert.match(res.rows[0].dosis, /DIA#\s*13/i);
  });
});

describe('looksLikeSomePharmMonthPaste', () => {
  it('detecta cabecera con días', () => {
    assert.equal(
      looksLikeSomePharmMonthPaste(
        'Med\t01\t02\t03\t04\t05\t06\nX\t1\t2\t3\t4\t5\t6\n'
      ),
      true
    );
    assert.equal(looksLikeSomePharmMonthPaste('solo texto'), false);
  });
});

describe('mergeRecetaIntoMonth', () => {
  it('marca día de receta y rellena huecos', () => {
    const recetaFields = {
      med: 'LEVETIRACETAM 500 MG TABLETA',
      dosis: '1 G //',
      freq: 'Q12H',
      via: 'VIA NASOGASTRICA',
    };
    const month = {
      monthKey: '2026-05',
      year: 2026,
      monthIndex: 4,
      daysInMonth: 31,
      rows: [
        {
          rowKey: buildMedPharmRowKey(recetaFields),
          med: recetaFields.med,
          dosis: recetaFields.dosis,
          freq: recetaFields.freq,
          via: recetaFields.via,
          cat: '',
          days: { 1: 1, 2: 1 },
          notAdmin: {},
        },
      ],
    };
    const recetaItems = [
      {
        nombreRaw: recetaFields.med,
        dosisRaw: recetaFields.dosis,
        frecuenciaRaw: recetaFields.freq,
        viaRaw: recetaFields.via,
        suspendido: false,
      },
    ];
    const out = mergeRecetaIntoMonth(month, recetaItems, '05/05/2026');
    const row = out.rows[0];
    assert.equal(row.days[5], 1);
    assert.equal(row.days[3], 1);
    assert.equal(row.days[4], 1);
  });
});

describe('parseRecetaDateToDay', () => {
  it('parsea DD/MM/YYYY', () => {
    assert.deepEqual(parseRecetaDateToDay('05/05/2026', 2026, 4), { ok: true, day: 5 });
  });
});

describe('applySomePasteToProfile', () => {
  it('conserva notAdmin en días que siguen indicados', () => {
    const profile = {
      months: {
        '2026-05': {
          monthKey: '2026-05',
          year: 2026,
          monthIndex: 4,
          daysInMonth: 31,
          rows: [
            {
              rowKey: buildMedPharmRowKey({
                med: 'METAMIZOL',
                dosis: '1 G //',
                freq: 'Q8H',
                via: 'VIA IV',
              }),
              med: 'METAMIZOL',
              dosis: '1 G //',
              freq: 'Q8H',
              via: 'VIA IV',
              days: { 5: 1 },
              notAdmin: { 5: true },
              cat: '',
            },
          ],
        },
      },
    };
    const parsed = parseSomePharmMonthPaste(
      'Medicamento\tDosis\tFreq\tVia\t01\t02\t03\t04\t05\n' +
        'METAMIZOL\t1 G //\tQ8H\tVIA IV\t\t\t\t\t1\n',
      { year: 2026, monthIndex: 4 }
    );
    const next = applySomePasteToProfile(profile, parsed);
    const row = next.months['2026-05'].rows.find(function (r) {
      return r.med === 'METAMIZOL';
    });
    assert.equal(row.notAdmin[5], true);
  });

  it('conserva filas ocultas al reimportar SOME', () => {
    const key = buildMedPharmRowKey({
      med: 'METAMIZOL',
      dosis: '1 G //',
      freq: 'Q8H',
      via: 'VIA IV',
    });
    const profile = {
      months: {
        '2026-05': {
          monthKey: '2026-05',
          year: 2026,
          monthIndex: 4,
          daysInMonth: 31,
          rows: [
            {
              rowKey: key,
              med: 'METAMIZOL',
              dosis: '1 G //',
              freq: 'Q8H',
              via: 'VIA IV',
              days: { 5: 1 },
              notAdmin: {},
              cat: '',
              hidden: true,
            },
          ],
        },
      },
    };
    const parsed = parseSomePharmMonthPaste(
      'Medicamento\tDosis\tFreq\tVia\t01\t02\t03\t04\t05\n' +
        'METAMIZOL\t1 G //\tQ8H\tVIA IV\t\t\t\t\t1\n',
      { year: 2026, monthIndex: 4 }
    );
    const next = applySomePasteToProfile(profile, parsed);
    const row = next.months['2026-05'].rows.find(function (r) {
      return r.rowKey === key;
    });
    assert.equal(row.hidden, true);
  });
});

describe('deleteMonthFromProfile', () => {
  it('elimina un mes y conserva otros', () => {
    const profile = {
      months: {
        '2026-04': { rows: [{ rowKey: 'a', days: { 1: 1 } }] },
        '2026-05': { rows: [{ rowKey: 'b', days: { 2: 1 } }] },
      },
    };
    const next = deleteMonthFromProfile(profile, 2026, 3);
    assert.equal(profileHasMonthData(next), true);
    assert.equal(monthHasData(next, 2026, 3), false);
    assert.equal(monthHasData(next, 2026, 4), true);
  });

  it('devuelve null si no quedan meses ni borrador', () => {
    const profile = {
      months: {
        '2026-05': { rows: [{ rowKey: 'b', days: { 2: 1 } }] },
      },
    };
    assert.equal(deleteMonthFromProfile(profile, 2026, 3), profile);
    assert.equal(deleteMonthFromProfile(profile, 2026, 4), null);
  });

  it('conserva draftPaste si solo queda el borrador', () => {
    const profile = {
      draftPaste: 'pegado',
      months: {
        '2026-05': { rows: [{ rowKey: 'b', days: { 2: 1 } }] },
      },
    };
    const next = deleteMonthFromProfile(profile, 2026, 4);
    assert.equal(next.draftPaste, 'pegado');
    assert.equal(profileHasMonthData(next), false);
  });
});

describe('medPharmProfileUpdatedAt', () => {
  it('elige el lastSomePasteAt más reciente entre meses', () => {
    const at = medPharmProfileUpdatedAt({
      months: {
        '2026-04': { lastSomePasteAt: '2026-04-10T08:00:00.000Z', rows: [] },
        '2026-05': { lastSomePasteAt: '2026-05-20T12:00:00.000Z', rows: [] },
      },
    });
    assert.equal(at, '2026-05-20T12:00:00.000Z');
  });
});

describe('formatFreqShort', () => {
  it('muestra UNICA en lugar de ONCE', () => {
    assert.equal(formatFreqShort('once'), 'UNICA');
    assert.equal(formatFreqShort('UNICA'), 'UNICA');
  });

  it('acorta intervalos horarios', () => {
    assert.equal(formatFreqShort('Q8H'), '8H');
  });
});
