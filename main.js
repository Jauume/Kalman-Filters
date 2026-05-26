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

// ─── Boot ──────────────────────────────────────────────────────────────────────
initKF();
