/**
 * Pase board runtime DI (registered from app-runtimes).
 */
/** @type {{
 *   getActiveAppTab(): string,
 *   setActiveAppTab(tab: string): void,
 *   getActiveInner(): string,
 *   setActiveInner(tab: string): void,
 *   getActiveId(): string|null,
 *   renderMedRecetaPanel(): void,
 *   renderLabHistoryPanel(): void,
 *   renderProcedureAgendaPanel(): void,
 *   setMedTabAttention(on?: boolean): void,
 *   syncWorkContextChrome(): void,
 *   ensureParsedLabHistory(pid: string): unknown[],
 *   splitResLabsByTipo(rows: unknown[]): { labs: unknown[], cultivo: unknown[] },
 *   primaryTipoForLabSet(resLabs: unknown[]): string,
 *   getSettings(): { appMode?: string },
 * }} */
export var rt = {
  getActiveAppTab() {
    return "lab";
  },
  setActiveAppTab() {},
  getActiveInner() {
    return "todo";
  },
  setActiveInner() {},
  getActiveId() {
    return null;
  },
  renderMedRecetaPanel() {},
  renderLabHistoryPanel() {},
  renderProcedureAgendaPanel() {},
  setMedTabAttention() {},
  syncWorkContextChrome() {},
  ensureParsedLabHistory() {
    return [];
  },
  splitResLabsByTipo(rows) {
    void rows;
    return { labs: [], cultivo: [] };
  },
  primaryTipoForLabSet(resLabs) {
    void resLabs;
    return "labs";
  },
  getSettings() {
    return { appMode: "sala" };
  },
};

export function registerPaseBoardRuntime(ctx) {
  if (ctx && typeof ctx === "object") Object.assign(rt, ctx);
}
