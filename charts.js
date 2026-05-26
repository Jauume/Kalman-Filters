// Depends on: filters.js (runKF, runEKF, runUKF, runEnKF, runAKF)

// ─── Shared chart defaults ───────────────────────────────────────────────────
const CHART_DEFAULTS = {
  animation: false,
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#ccc', boxWidth: 14, font: { size: 11 } } } },
  scales: {
    x: { type: 'linear', ticks: { color: '#999', maxTicksLimit: 8 }, grid: { color: '#333' } },
    y: { type: 'linear', ticks: { color: '#999', maxTicksLimit: 6 }, grid: { color: '#333' } }
  }
};

const charts = {};
function range(n) { return Array.from({length: n}, (_,i) => i+1); }
function pts(xs, ys) { return xs.map((v,i) => ({x:v, y:ys[i]})); }
function hline(k, y) { return k.map(v => ({x:v, y})); }

// ─── KF charts ───────────────────────────────────────────────────────────────
function initKF() {
  const { tp, meas, ep, ev, sig_p } = runKF(0.1, 2, 80);
  const k = range(tp.length);
  const upper = ep.map((v,i) => v+sig_p[i]);
  const lower = ep.map((v,i) => v-sig_p[i]);

  charts.kf1 = new Chart(document.getElementById('kf-c1').getContext('2d'), {
    type: 'line',
    data: { datasets: [
      { label:'KF ±1σ',    data:pts(k,upper), borderWidth:0, pointRadius:0, backgroundColor:'rgba(90,164,255,0.15)', fill:'+1' },
      { label:'_lower',    data:pts(k,lower), borderWidth:0, pointRadius:0, backgroundColor:'rgba(90,164,255,0.15)', fill:false },
      { label:'True',      data:pts(k,tp),    borderColor:'#33c85a', borderWidth:2, pointRadius:0, fill:false },
      { label:'Measured',  data:pts(k,meas),  borderColor:'transparent', pointBackgroundColor:'#f25050', pointRadius:3, showLine:false },
      { label:'KF estimate', data:pts(k,ep),  borderColor:'#5aa4ff', borderWidth:2, pointRadius:0, fill:false }
    ]},
    options: {...CHART_DEFAULTS, parsing:false,
      plugins:{...CHART_DEFAULTS.plugins, title:{display:true,text:'Position tracking',color:'#ddd'}}}
  });

  charts.kf2 = new Chart(document.getElementById('kf-c2').getContext('2d'), {
    type: 'line',
    data: { datasets: [
      { label:'True vel=1', data:hline(k,1),  borderColor:'#33c85a', borderWidth:1.5, borderDash:[5,3], pointRadius:0, fill:false },
      { label:'KF velocity', data:pts(k,ev),  borderColor:'#f5cc20', borderWidth:2, pointRadius:0, fill:false }
    ]},
    options:{...CHART_DEFAULTS, parsing:false,
      plugins:{...CHART_DEFAULTS.plugins, title:{display:true,text:'Velocity estimate',color:'#ddd'}}}
  });

  const err_kf = ep.map((v,i) => Math.abs(v-tp[i]));
  const err_m  = meas.map((v,i) => Math.abs(v-tp[i]));
  const rmse = Math.sqrt(err_kf.reduce((a,v) => a+v*v, 0)/err_kf.length);
  charts.kf3 = new Chart(document.getElementById('kf-c3').getContext('2d'), {
    type: 'line',
    data: { datasets: [
      { label:'|meas-true|', data:pts(k,err_m),  borderColor:'#f25050', borderWidth:1.2, pointRadius:0, fill:false },
      { label:'|KF-true|',   data:pts(k,err_kf), borderColor:'#5aa4ff', borderWidth:2,   pointRadius:0, fill:false },
      { label:'√P₁₁ (1σ)',   data:pts(k,sig_p),  borderColor:'#f5b820', borderWidth:2, borderDash:[5,3], pointRadius:0, fill:false },
      { label:`RMSE=${rmse.toFixed(2)}`, data:hline(k,rmse), borderColor:'#5aa4ff', borderWidth:1.4, borderDash:[3,3], pointRadius:0, fill:false }
    ]},
    options:{...CHART_DEFAULTS, parsing:false,
      plugins:{...CHART_DEFAULTS.plugins, title:{display:true,text:'Error vs filter belief',color:'#ddd'}}}
  });
}

function updateKF() {
  const Q = +document.getElementById('kf-Q').value;
  const R = +document.getElementById('kf-R').value;
  const N = +document.getElementById('kf-N').value;
  document.getElementById('kf-Q-val').textContent = `Q = ${Q.toFixed(3)}`;
  document.getElementById('kf-R-val').textContent = `R = ${R.toFixed(3)}`;
  document.getElementById('kf-N-val').textContent = `N = ${N}`;
  const { tp, meas, ep, ev, sig_p } = runKF(Q, R, N);
  const k = range(N);
  const upper = ep.map((v,i) => v+sig_p[i]), lower = ep.map((v,i) => v-sig_p[i]);
  const err_kf = ep.map((v,i) => Math.abs(v-tp[i]));
  const err_m  = meas.map((v,i) => Math.abs(v-tp[i]));
  const rmse = Math.sqrt(err_kf.reduce((a,v) => a+v*v, 0)/err_kf.length);

  const c1 = charts.kf1;
  [upper, lower, tp, meas, ep].forEach((arr,i) => { c1.data.datasets[i].data = pts(k,arr); });
  c1.update();

  const c2 = charts.kf2;
  c2.data.datasets[0].data = hline(k,1);
  c2.data.datasets[1].data = pts(k,ev);
  c2.update();

  const c3 = charts.kf3;
  [err_m, err_kf, sig_p].forEach((arr,i) => { c3.data.datasets[i].data = pts(k,arr); });
  c3.data.datasets[3].data = hline(k,rmse);
  c3.data.datasets[3].label = `RMSE=${rmse.toFixed(2)}`;
  c3.update();
}

// ─── Orbit chart helper (shared by EKF, UKF, EnKF) ───────────────────────────
function initOrbitCharts(prefix, color, label, data) {
  const { tpx, tpy, mpx, mpy, ex, ey } = data;
  const k = range(tpx.length);

  charts[prefix+'1'] = new Chart(document.getElementById(prefix+'-c1').getContext('2d'), {
    type: 'line',
    data: { datasets: [
      { label:'True orbit',       data:pts(tpx,tpy), borderColor:'#33c85a', borderWidth:2.5, pointRadius:0, fill:false },
      { label:'Raw meas.',        data:pts(mpx,mpy), borderColor:'transparent', pointBackgroundColor:'#f25050', pointRadius:2.5, showLine:false },
      { label:label+' estimate',  data:pts(ex,ey),   borderColor:color, borderWidth:2, pointRadius:0, fill:false },
      { label:'Start', data:[{x:tpx[0],y:tpy[0]}],  pointBackgroundColor:'#fff', pointRadius:7, showLine:false }
    ]},
    options:{...CHART_DEFAULTS, parsing:false,
      scales:{
        x:{...CHART_DEFAULTS.scales.x, title:{display:true,text:'X (m)',color:'#aaa'}},
        y:{...CHART_DEFAULTS.scales.y, title:{display:true,text:'Y (m)',color:'#aaa'}}
      },
      plugins:{...CHART_DEFAULTS.plugins, title:{display:true,text:`2-D Orbit — ${label}`,color:'#ddd'}}}
  });

  const err_raw = tpx.map((v,i) => Math.sqrt((mpx[i]-v)**2+(mpy[i]-tpy[i])**2));
  const err_est = tpx.map((v,i) => Math.sqrt((ex[i]-v)**2+(ey[i]-tpy[i])**2));
  const rmse = Math.sqrt(err_est.reduce((a,v) => a+v*v, 0)/tpx.length);

  charts[prefix+'2'] = new Chart(document.getElementById(prefix+'-c2').getContext('2d'), {
    type: 'line',
    data: { datasets: [
      { label:'Raw error',          data:pts(k,err_raw), borderColor:'#f25050', borderWidth:1.5, pointRadius:0, fill:false },
      { label:label+' error',       data:pts(k,err_est), borderColor:color,     borderWidth:2,   pointRadius:0, fill:false },
      { label:`RMSE=${rmse.toFixed(3)} m`, data:hline(k,rmse), borderColor:color, borderWidth:1.5, borderDash:[4,3], pointRadius:0, fill:false }
    ]},
    options:{...CHART_DEFAULTS, parsing:false,
      plugins:{...CHART_DEFAULTS.plugins, title:{display:true,text:`${label} position error`,color:'#ddd'}}}
  });
}

function updateOrbitCharts(prefix, color, label, data) {
  const { tpx, tpy, mpx, mpy, ex, ey } = data;
  const k = range(tpx.length);
  const c1 = charts[prefix+'1'];
  c1.data.datasets[0].data = pts(tpx,tpy);
  c1.data.datasets[1].data = pts(mpx,mpy);
  c1.data.datasets[2].data = pts(ex,ey);
  c1.data.datasets[3].data = [{x:tpx[0],y:tpy[0]}];
  c1.update();

  const err_raw = tpx.map((v,i) => Math.sqrt((mpx[i]-v)**2+(mpy[i]-tpy[i])**2));
  const err_est = tpx.map((v,i) => Math.sqrt((ex[i]-v)**2+(ey[i]-tpy[i])**2));
  const rmse = Math.sqrt(err_est.reduce((a,v) => a+v*v, 0)/tpx.length);
  const c2 = charts[prefix+'2'];
  c2.data.datasets[0].data = pts(k,err_raw);
  c2.data.datasets[1].data = pts(k,err_est);
  c2.data.datasets[2].data = hline(k,rmse);
  c2.data.datasets[2].label = `RMSE=${rmse.toFixed(3)} m`;
  c2.update();
}

// ─── EKF / UKF / EnKF chart wrappers ─────────────────────────────────────────
function initEKF() {
  const d = runEKF(0.05,0.3,0.05,100);
  initOrbitCharts('ekf','#5aa4ff','EKF',{tpx:d.tpx,tpy:d.tpy,mpx:d.mpx,mpy:d.mpy,ex:d.epx,ey:d.epy});
}
function updateEKF() {
  const Q=+document.getElementById('ekf-Q').value, Rr=+document.getElementById('ekf-R').value;
  const Rb=+document.getElementById('ekf-B').value, N=+document.getElementById('ekf-N').value;
  document.getElementById('ekf-Q-val').textContent=`Q = ${Q.toFixed(4)}`;
  document.getElementById('ekf-R-val').textContent=`σr = ${Rr.toFixed(3)}`;
  document.getElementById('ekf-B-val').textContent=`σθ = ${Rb.toFixed(3)}`;
  document.getElementById('ekf-N-val').textContent=`N = ${N}`;
  const d = runEKF(Q,Rr,Rb,N);
  updateOrbitCharts('ekf','#5aa4ff','EKF',{tpx:d.tpx,tpy:d.tpy,mpx:d.mpx,mpy:d.mpy,ex:d.epx,ey:d.epy});
}

function initUKF() {
  const d = runUKF(0.05,0.3,0.05,100);
  initOrbitCharts('ukf','#c066ff','UKF',{tpx:d.tpx,tpy:d.tpy,mpx:d.mpx,mpy:d.mpy,ex:d.upx,ey:d.upy});
}
function updateUKF() {
  const Q=+document.getElementById('ukf-Q').value, Rr=+document.getElementById('ukf-R').value;
  const Rb=+document.getElementById('ukf-B').value, N=+document.getElementById('ukf-N').value;
  document.getElementById('ukf-Q-val').textContent=`Q = ${Q.toFixed(4)}`;
  document.getElementById('ukf-R-val').textContent=`σr = ${Rr.toFixed(3)}`;
  document.getElementById('ukf-B-val').textContent=`σθ = ${Rb.toFixed(3)}`;
  document.getElementById('ukf-N-val').textContent=`N = ${N}`;
  const d = runUKF(Q,Rr,Rb,N);
  updateOrbitCharts('ukf','#c066ff','UKF',{tpx:d.tpx,tpy:d.tpy,mpx:d.mpx,mpy:d.mpy,ex:d.upx,ey:d.upy});
}

function initEnKF() {
  const d = runEnKF(0.05,0.3,0.05,100,50);
  initOrbitCharts('enkf','#33d6b0','EnKF',{tpx:d.tpx,tpy:d.tpy,mpx:d.mpx,mpy:d.mpy,ex:d.epx,ey:d.epy});
}
function updateEnKF() {
  const Q=+document.getElementById('enkf-Q').value, Rr=+document.getElementById('enkf-R').value;
  const Rb=+document.getElementById('enkf-B').value, Ne=+document.getElementById('enkf-Ne').value;
  const N=+document.getElementById('enkf-N').value;
  document.getElementById('enkf-Q-val').textContent=`Q = ${Q.toFixed(4)}`;
  document.getElementById('enkf-R-val').textContent=`σr = ${Rr.toFixed(3)}`;
  document.getElementById('enkf-B-val').textContent=`σθ = ${Rb.toFixed(3)}`;
  document.getElementById('enkf-Ne-val').textContent=`Ne = ${Ne}`;
  document.getElementById('enkf-N-val').textContent=`N = ${N}`;
  const d = runEnKF(Q,Rr,Rb,N,Ne);
  updateOrbitCharts('enkf','#33d6b0','EnKF',{tpx:d.tpx,tpy:d.tpy,mpx:d.mpx,mpy:d.mpy,ex:d.epx,ey:d.epy});
}

// ─── AKF charts ───────────────────────────────────────────────────────────────
function initAKF() {
  const { tp, meas, ep, ev, sig_p, Rhist } = runAKF(0.1,1,100,10);
  const N=tp.length, k=range(N), col='#ff9933';
  const upper=ep.map((v,i)=>v+sig_p[i]), lower=ep.map((v,i)=>v-sig_p[i]);

  charts.akf1 = new Chart(document.getElementById('akf-c1').getContext('2d'), {
    type:'line',
    data:{ datasets:[
      { label:'AKF ±1σ',    data:pts(k,upper), borderWidth:0, pointRadius:0, backgroundColor:'rgba(255,153,51,0.15)', fill:'+1' },
      { label:'_lower',     data:pts(k,lower), borderWidth:0, pointRadius:0, backgroundColor:'rgba(255,153,51,0.15)', fill:false },
      { label:'True',       data:pts(k,tp),    borderColor:'#33c85a', borderWidth:2, pointRadius:0, fill:false },
      { label:'Measured',   data:pts(k,meas),  borderColor:'transparent', pointBackgroundColor:'#f25050', pointRadius:2.5, showLine:false },
      { label:'AKF estimate', data:pts(k,ep),  borderColor:col, borderWidth:2, pointRadius:0, fill:false }
    ]},
    options:{...CHART_DEFAULTS, parsing:false,
      plugins:{...CHART_DEFAULTS.plugins, title:{display:true,text:'AKF Position tracking (R doubles at N/2)',color:'#ddd'}}}
  });

  const err_akf=ep.map((v,i)=>Math.abs(v-tp[i]));
  const err_m=meas.map((v,i)=>Math.abs(v-tp[i]));
  const rmse=Math.sqrt(err_akf.reduce((a,v)=>a+v*v,0)/N);
  charts.akf2 = new Chart(document.getElementById('akf-c2').getContext('2d'), {
    type:'line',
    data:{ datasets:[
      { label:'|meas-true|', data:pts(k,err_m),   borderColor:'#f25050', borderWidth:1.2, pointRadius:0, fill:false },
      { label:'|AKF-true|',  data:pts(k,err_akf), borderColor:col,       borderWidth:2,   pointRadius:0, fill:false },
      { label:`RMSE=${rmse.toFixed(2)}`, data:hline(k,rmse), borderColor:col, borderWidth:1.4, borderDash:[4,3], pointRadius:0, fill:false }
    ]},
    options:{...CHART_DEFAULTS, parsing:false,
      plugins:{...CHART_DEFAULTS.plugins, title:{display:true,text:'Position error',color:'#ddd'}}}
  });

  const R0=+document.getElementById('akf-R').value;
  const Rtrue_vec=k.map(v=>R0*(1+3*(v>N/2?1:0)));
  charts.akf3 = new Chart(document.getElementById('akf-c3').getContext('2d'), {
    type:'line',
    data:{ datasets:[
      { label:'True R',      data:pts(k,Rtrue_vec), borderColor:'#33c85a', borderWidth:2, borderDash:[5,3], pointRadius:0, fill:false },
      { label:'Estimated R', data:pts(k,Rhist),     borderColor:col,       borderWidth:2, pointRadius:0, fill:false }
    ]},
    options:{...CHART_DEFAULTS, parsing:false,
      plugins:{...CHART_DEFAULTS.plugins, title:{display:true,text:'Adaptive R estimation',color:'#ddd'}}}
  });
}

function updateAKF() {
  const Q=+document.getElementById('akf-Q').value, R0=+document.getElementById('akf-R').value;
  const W=+document.getElementById('akf-W').value, N=+document.getElementById('akf-N').value;
  document.getElementById('akf-Q-val').textContent=`Q = ${Q.toFixed(3)}`;
  document.getElementById('akf-R-val').textContent=`R₀ = ${R0.toFixed(3)}`;
  document.getElementById('akf-W-val').textContent=`W = ${W}`;
  document.getElementById('akf-N-val').textContent=`N = ${N}`;
  const { tp, meas, ep, sig_p, Rhist } = runAKF(Q,R0,N,W);
  const k=range(N), col='#ff9933';
  const upper=ep.map((v,i)=>v+sig_p[i]), lower=ep.map((v,i)=>v-sig_p[i]);

  const c1=charts.akf1;
  [upper,lower,tp,meas,ep].forEach((arr,i) => { c1.data.datasets[i].data=pts(k,arr); });
  c1.update();

  const err_akf=ep.map((v,i)=>Math.abs(v-tp[i]));
  const err_m=meas.map((v,i)=>Math.abs(v-tp[i]));
  const rmse=Math.sqrt(err_akf.reduce((a,v)=>a+v*v,0)/N);
  const c2=charts.akf2;
  [err_m,err_akf].forEach((arr,i) => { c2.data.datasets[i].data=pts(k,arr); });
  c2.data.datasets[2].data=hline(k,rmse);
  c2.data.datasets[2].label=`RMSE=${rmse.toFixed(2)}`;
  c2.update();

  const Rtrue_vec=k.map(v=>R0*(1+3*(v>N/2?1:0)));
  const c3=charts.akf3;
  c3.data.datasets[0].data=pts(k,Rtrue_vec);
  c3.data.datasets[1].data=pts(k,Rhist);
  c3.update();
}
