/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'settings-not-to-patients',
      severity: 'error',
      comment: 'settings domain must not import patients list',
      from: { path: '^public/js/features/settings-help' },
      to: { path: '^public/js/features/patients' },
    },
    {
      name: 'labs-not-to-lan-sync',
      severity: 'error',
      comment: 'labs domain must not import LAN orchestrator',
      from: { path: '^public/js/features/(lab-|tendencias)' },
      to: { path: '^public/js/features/(lan-sync|lan/)' },
    },
    {
      name: 'lan-not-to-patients',
      severity: 'error',
      comment: 'lan domain must not import patients list',
      from: { path: '^public/js/features/lan/' },
      to: { path: '^public/js/features/patients' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
