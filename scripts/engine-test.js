/*
  Simple engine v2 assertion runner.
  Usage:
    1) Start dev server with v2 flag: NEXT_PUBLIC_PROSPER_ENGINE=v2 npm run dev
    2) In another terminal: npm run engine:test
*/

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function checkScenario(name) {
  const url = `${BASE_URL}/api/dev/engine-v2?validate=1&scenario=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Scenario ${name}: HTTP ${res.status}`);
    return { name, ok: false };
  }
  const json = await res.json();
  const assertions = json.assertions || [];
  const passed = assertions.filter(a => a.pass).length;
  const failed = assertions.length - passed;
  console.log(`\nScenario ${json.scenario} — ${passed}/${assertions.length} checks passed`);
  assertions.forEach(a => {
    const mark = a.pass ? '✓' : '✗';
    console.log(` ${mark} ${a.label} | value=${a.value ?? '—'} | required=${a.required}`);
  });
  return { name: json.scenario, ok: failed === 0, passed, total: assertions.length };
}

(async () => {
  try {
    const results = [];
    for (const s of ['A','B','C']) {
      results.push(await checkScenario(s));
    }
    const totals = results.reduce((acc, r) => ({
      total: acc.total + (r.total || 0),
      passed: acc.passed + (r.passed || 0),
    }), { total: 0, passed: 0 });
    console.log(`\nSummary: ${totals.passed}/${totals.total} total checks passed`);
    const hasFail = results.some(r => r.ok === false);
    process.exit(hasFail ? 1 : 0);
  } catch (err) {
    console.error('engine:test failed:', err);
    process.exit(1);
  }
})();

