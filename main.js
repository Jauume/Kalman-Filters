// ─── Seeds ─────────────────────────────────────────────────────────────────────
const seeds = { kf: 42, ekf: 7, ukf: 7, enkf: 7, akf: 42 };
function newSeed(tab) {
  seeds[tab] = (Math.random() * 0xFFFFFFFF) >>> 0;
  document.getElementById(tab+'-seed-label').textContent = 'seed: ' + seeds[tab];
}
function showSeed(tab) {
  document.getElementById(tab+'-seed-label').textContent = 'seed: ' + seeds[tab];
}

// ─── Tab switching ─────────────────────────────────────────────────────────────
const lazyInit = { ekf: initEKF, ukf: initUKF, enkf: initEnKF, akf: initAKF };
const initialized = { kf: true };

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.tab;
    document.getElementById('tab-'+id).classList.add('active');
    if (!initialized[id] && lazyInit[id]) { lazyInit[id](); initialized[id] = true; }
    setTimeout(() => Object.values(charts).forEach(c => c.resize()), 50);
  });
});

// ─── Slider wiring ─────────────────────────────────────────────────────────────
function wire(ids, fn) {
  ids.forEach(id => document.getElementById(id).addEventListener('input', fn));
}
wire(['kf-Q','kf-R','kf-N'], updateKF);
wire(['ekf-Q','ekf-R','ekf-B','ekf-N'], updateEKF);
wire(['ukf-Q','ukf-R','ukf-B','ukf-N'], updateUKF);
wire(['enkf-Q','enkf-R','enkf-B','enkf-Ne','enkf-N'], updateEnKF);
wire(['akf-Q','akf-R','akf-W','akf-N'], updateAKF);

// ─── Run Again buttons ─────────────────────────────────────────────────────────
document.getElementById('kf-run').addEventListener('click', () => { newSeed('kf'); updateKF(); });
document.getElementById('ekf-run').addEventListener('click', () => { newSeed('ekf'); updateEKF(); });
document.getElementById('ukf-run').addEventListener('click', () => { newSeed('ukf'); updateUKF(); });
document.getElementById('enkf-run').addEventListener('click', () => { newSeed('enkf'); updateEnKF(); });
document.getElementById('akf-run').addEventListener('click', () => { newSeed('akf'); updateAKF(); });

// ─── Boot ──────────────────────────────────────────────────────────────────────
showSeed('kf');
initKF();
