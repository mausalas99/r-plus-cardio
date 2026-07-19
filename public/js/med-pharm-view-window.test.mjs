import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFimiFecha,
  columnKey,
  daysInCalendarMonth,
  buildPharmViewWindow,
  unifyRowsForWindow,
  cellValueAtColumn,
  toggleNotAdminAtColumn,
  groupUnifiedRowsByMed,
  latestVariantInWindow,
} from './med-pharm-view-window.mjs';
import { buildMedPharmRowKey } from './med-pharm-profile-core.mjs';

function profileWithCrossMonth() {
  const key = buildMedPharmRowKey({
    med: 'CEFALOTINA 1 G',
    dosis: '2 G',
    freq: 'Q8H',
    via: 'VIA INTRAVENOSA',
  });
  const row = {
    rowKey: key,
    med: 'CEFALOTINA 1 G',
    dosis: '2 G',
    freq: 'Q8H',
    via: 'VIA INTRAVENOSA',
    days: {},
    notAdmin: {},
  };
  const mayDays = {};
  for (let d = 20; d <= 31; d += 1) mayDays[d] = 1;
  const junDays = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
  return {
    months: {
      '2026-05': {
        monthKey: '2026-05',
        year: 2026,
        monthIndex: 4,
        daysInMonth: 31,
        rows: [{ ...row, days: mayDays }],
      },
      '2026-06': {
        monthKey: '2026-06',
        year: 2026,
        monthIndex: 5,
        daysInMonth: 30,
        rows: [{ ...row, days: junDays }],
      },
    },
  };
}

describe('parseFimiFecha', () => {
  it('parsea ISO YYYY-MM-DD', () => {
    const p = parseFimiFecha('2026-05-22');
    assert.deepEqual(p, { year: 2026, monthIndex: 4, day: 22 });
  });

  it('vacío → null', () => {
    assert.equal(parseFimiFecha(''), null);
  });
});

describe('columnKey', () => {
  it('serializa columna', () => {
    assert.equal(columnKey({ year: 2026, monthIndex: 4, day: 28 }), '2026-05-28');
  });
});

describe('daysInCalendarMonth', () => {
  it('mayo 2026 tiene 31 días', () => {
    assert.equal(daysInCalendarMonth(2026, 4), 31);
  });
});

describe('buildPharmViewWindow current month early', () => {
  it('incluye cola mayo cuando hoy es 5 jun y hay continuidad', () => {
    const w = buildPharmViewWindow({
      profile: profileWithCrossMonth(),
      viewYear: 2026,
      viewMonthIndex: 5,
      today: { year: 2026, monthIndex: 5, day: 5 },
      fimiFecha: '2026-05-20',
    });
    assert.equal(w.columns[0].monthIndex, 4);
    assert.equal(w.columns[0].day, 20);
    assert.equal(w.columns[w.columns.length - 1].day, 5);
    assert.equal(w.columns[w.columns.length - 1].monthIndex, 5);
    assert.equal(w.isCurrentMonth, true);
    assert.ok(w.label.includes('may'));
    assert.ok(w.label.includes('jun'));
  });
});

describe('buildPharmViewWindow current month mid', () => {
  it('solo junio 1-15 sin mayo cuando hoy es 15 jun', () => {
    const w = buildPharmViewWindow({
      profile: profileWithCrossMonth(),
      viewYear: 2026,
      viewMonthIndex: 5,
      today: { year: 2026, monthIndex: 5, day: 15 },
      fimiFecha: '',
    });
    assert.ok(w.columns.every((c) => c.monthIndex === 5));
    assert.equal(w.columns[0].day, 1);
    assert.equal(w.columns[w.columns.length - 1].day, 15);
    assert.equal(w.columns.length, 15);
  });
});

describe('buildPharmViewWindow past month', () => {
  it('mayo pasado: 22-31 con fimi 22 may', () => {
    const w = buildPharmViewWindow({
      profile: profileWithCrossMonth(),
      viewYear: 2026,
      viewMonthIndex: 4,
      today: { year: 2026, monthIndex: 5, day: 15 },
      fimiFecha: '2026-05-22',
    });
    assert.ok(w.columns.every((c) => c.monthIndex === 4));
    assert.equal(w.columns[0].day, 22);
    assert.equal(w.columns[w.columns.length - 1].day, 31);
    assert.equal(w.isCurrentMonth, false);
  });
});

describe('buildPharmViewWindow future month', () => {
  it('mes futuro sin columnas', () => {
    const w = buildPharmViewWindow({
      profile: profileWithCrossMonth(),
      viewYear: 2026,
      viewMonthIndex: 7,
      today: { year: 2026, monthIndex: 5, day: 15 },
      fimiFecha: '',
    });
    assert.equal(w.columns.length, 0);
  });
});

describe('unifyRowsForWindow', () => {
  it('une rowKey de meses tocados por columnas', () => {
    const profile = profileWithCrossMonth();
    const w = buildPharmViewWindow({
      profile,
      viewYear: 2026,
      viewMonthIndex: 5,
      today: { year: 2026, monthIndex: 5, day: 5 },
      fimiFecha: '',
    });
    const rows = unifyRowsForWindow(profile, w.columns);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].med, 'CEFALOTINA 1 G');
  });
});

describe('cellValueAtColumn', () => {
  it('lee día del bucket mensual correcto', () => {
    const profile = profileWithCrossMonth();
    const w = buildPharmViewWindow({
      profile,
      viewYear: 2026,
      viewMonthIndex: 5,
      today: { year: 2026, monthIndex: 5, day: 5 },
      fimiFecha: '',
    });
    const rows = unifyRowsForWindow(profile, w.columns);
    const colMay28 = w.columns.find((c) => c.monthIndex === 4 && c.day === 28);
    assert.equal(cellValueAtColumn(profile, rows[0].rowKey, colMay28), 1);
    const colJun3 = w.columns.find((c) => c.monthIndex === 5 && c.day === 3);
    assert.equal(cellValueAtColumn(profile, rows[0].rowKey, colJun3), 1);
  });
});

function profileWithDoseChange() {
  const keyLow = buildMedPharmRowKey({
    med: 'ACICLOVIR 200 MG TABLETA (*)',
    dosis: '200 MG //',
    freq: 'Q12H',
    via: 'VIA ORAL',
  });
  const keyHigh = buildMedPharmRowKey({
    med: 'ACICLOVIR 200 MG TABLETA (*)',
    dosis: '400 MG //',
    freq: 'Q12H',
    via: 'VIA ORAL',
  });
  const rowLow = {
    rowKey: keyLow,
    med: 'ACICLOVIR 200 MG TABLETA (*)',
    dosis: '200 MG //',
    freq: 'Q12H',
    via: 'VIA ORAL',
    days: { 1: 1, 2: 1, 3: 1 },
    notAdmin: {},
  };
  const rowHigh = {
    rowKey: keyHigh,
    med: 'ACICLOVIR 200 MG TABLETA (*)',
    dosis: '400 MG //',
    freq: 'Q12H',
    via: 'VIA ORAL',
    days: { 4: 1, 5: 1 },
    notAdmin: {},
  };
  return {
    months: {
      '2026-06': {
        monthKey: '2026-06',
        year: 2026,
        monthIndex: 5,
        daysInMonth: 30,
        rows: [rowLow, rowHigh],
      },
    },
  };
}

describe('groupUnifiedRowsByMed', () => {
  it('colapsa presentaciones SOME distintas del mismo principio activo', () => {
    const keyA = buildMedPharmRowKey({
      med: 'PARACETAMOL 1 G SOL INY 100 ML (*)',
      dosis: '1 G',
      freq: 'Q24H',
      via: 'VIA INTRAVENOSA',
    });
    const keyB = buildMedPharmRowKey({
      med: 'PARACETAMOL 500 MG SOL INY 50 ML (*)',
      dosis: '500 MG',
      freq: 'CADA 8 HORAS',
      via: 'VIA INTRAVENOSA',
    });
    const profile = {
      months: {
        '2026-06': {
          monthKey: '2026-06',
          year: 2026,
          monthIndex: 5,
          daysInMonth: 30,
          rows: [
            {
              rowKey: keyA,
              med: 'PARACETAMOL 1 G SOL INY 100 ML (*)',
              dosis: '1 G',
              freq: 'Q24H',
              via: 'VIA INTRAVENOSA',
              days: { 1: 1, 2: 1 },
              notAdmin: {},
            },
            {
              rowKey: keyB,
              med: 'PARACETAMOL 500 MG SOL INY 50 ML (*)',
              dosis: '500 MG',
              freq: 'CADA 8 HORAS',
              via: 'VIA INTRAVENOSA',
              days: { 3: 1, 4: 1, 5: 1 },
              notAdmin: {},
            },
          ],
        },
      },
    };
    const w = buildPharmViewWindow({
      profile,
      viewYear: 2026,
      viewMonthIndex: 5,
      today: { year: 2026, monthIndex: 5, day: 5 },
      fimiFecha: '',
    });
    const unified = unifyRowsForWindow(profile, w.columns);
    assert.equal(unified.length, 2);
    const groups = groupUnifiedRowsByMed(unified, profile, w.columns);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].med, 'PARACETAMOL');
    assert.equal(groups[0].variants.length, 2);
  });

  it('colapsa mismas moléculas con distinta dosis en fila SOME', () => {
    const profile = profileWithDoseChange();
    const w = buildPharmViewWindow({
      profile,
      viewYear: 2026,
      viewMonthIndex: 5,
      today: { year: 2026, monthIndex: 5, day: 5 },
      fimiFecha: '',
    });
    const unified = unifyRowsForWindow(profile, w.columns);
    assert.equal(unified.length, 2);
    const groups = groupUnifiedRowsByMed(unified, profile, w.columns);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].variants.length, 2);
    assert.equal(groups[0].currentVariant.dosis, '400 MG //');
  });
});

describe('latestVariantInWindow', () => {
  it('elige régimen del día más reciente con indicación', () => {
    const profile = profileWithDoseChange();
    const columns = [
      { year: 2026, monthIndex: 5, day: 1, monthKey: '2026-06' },
      { year: 2026, monthIndex: 5, day: 5, monthKey: '2026-06' },
    ];
    const unified = unifyRowsForWindow(profile, columns);
    const latest = latestVariantInWindow(profile, columns, unified);
    assert.equal(latest.dosis, '400 MG //');
  });
});

describe('toggleNotAdminAtColumn', () => {
  it('muta notAdmin en mes mayo desde vista junio', () => {
    let profile = profileWithCrossMonth();
    const w = buildPharmViewWindow({
      profile,
      viewYear: 2026,
      viewMonthIndex: 5,
      today: { year: 2026, monthIndex: 5, day: 5 },
      fimiFecha: '',
    });
    const rows = unifyRowsForWindow(profile, w.columns);
    const col = w.columns.find((c) => c.monthIndex === 4 && c.day === 25);
    profile = toggleNotAdminAtColumn(profile, rows[0].rowKey, col);
    const mayRow = profile.months['2026-05'].rows[0];
    assert.equal(mayRow.notAdmin[25], true);
    assert.equal(profile.months['2026-06'].rows[0].notAdmin[25], undefined);
  });
});
