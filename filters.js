// Depends on: math.js (makeRng, randn, mat, get, set, col, row2arr,
//              mmul, madd, msub, mscale, trans, eye, diag2, inv2, chol, wrapAngle)

// ─── KF: 1-D constant-velocity tracker ──────────────────────────────────────
// State: [position, velocity]
// F = [[1,dt],[0,1]],  H = [1,0]
function runKF(Qn, Rn, steps) {
  const rng = makeRng(42);
  const dt = 1;
  const F = mat(2,2,[1,dt,0,1]);
  const H = mat(1,2,[1,0]);
  const Q = mscale(eye(2), Qn);

  // Simulate ground truth and noisy measurements
  const tp = [], meas = [];
  let pos = 0, vel = 1;
  for (let k = 0; k < steps; k++) {
    pos += vel*dt + randn(rng)*Math.sqrt(Qn);
    tp.push(pos);
    meas.push(pos + randn(rng)*Math.sqrt(Rn));
  }

  let x = col([meas[0], 0]);
  let P = eye(2);
  const ep = [], ev = [], sig_p = [];

  for (let k = 0; k < steps; k++) {
    // Predict: x = F*x,  P = F*P*F' + Q
    x = mmul(F, x);
    P = madd(mmul(mmul(F, P), trans(F)), Q);
    // Update: K = P*H' / (H*P*H' + R),  x += K*(z - H*x),  P = (I-K*H)*P
    const S_val = get(mmul(mmul(H, P), trans(H)), 0, 0) + Rn;
    const K = mscale(mmul(P, trans(H)), 1/S_val);
    const innov = meas[k] - mmul(H,x).d[0];
    x = madd(x, mscale(K, innov));
    P = mmul(msub(eye(2), mmul(K, H)), P);
    ep.push(x.d[0]); ev.push(x.d[1]);
    sig_p.push(Math.sqrt(get(P,0,0)));
  }
  return { tp, meas, ep, ev, sig_p };
}

// ─── Shared orbit simulator (used by EKF, UKF, EnKF) ────────────────────────
// Object moves in a circle; sensor returns polar (range, bearing)
function runOrbit(steps, rng, Rr, Rb) {
  const omega = 0.15, radius = 5;
  const tpx = [], tpy = [], rm = [], bm = [], mpx = [], mpy = [];
  for (let k = 0; k < steps; k++) {
    tpx.push(radius * Math.cos(omega * k));
    tpy.push(radius * Math.sin(omega * k));
    const r0 = Math.sqrt(tpx[k]**2 + tpy[k]**2);
    const ri = r0 + randn(rng)*Rr;
    const bi = Math.atan2(tpy[k], tpx[k]) + randn(rng)*Rb;
    rm.push(ri); bm.push(bi);
    mpx.push(ri*Math.cos(bi)); mpy.push(ri*Math.sin(bi));
  }
  return { tpx, tpy, rm, bm, mpx, mpy };
}

// ─── EKF: 2-D orbit with nonlinear polar measurement ────────────────────────
// State: [x, y, vx, vy], measurement h(x) = [range, bearing]
// Linearises h via Jacobian Hj at each step
function runEKF(Qn, Rr, Rb, steps) {
  const rng = makeRng(7);
  const { tpx, tpy, rm, bm, mpx, mpy } = runOrbit(steps, rng, Rr, Rb);
  const dt = 0.1;
  const F = mat(4,4,[1,0,dt,0, 0,1,0,dt, 0,0,1,0, 0,0,0,1]);
  const Q = mscale(eye(4), Qn);
  const Rmeas = diag2(Rr*Rr, Rb*Rb);

  let x = col([mpx[0], mpy[0], 0, 0]);
  let P = eye(4);
  const epx = [], epy = [];

  for (let k = 0; k < steps; k++) {
    // Predict
    x = mmul(F, x); P = madd(mmul(mmul(F,P),trans(F)), Q);
    // Linearise h at current x
    const px = x.d[0], py = x.d[1];
    const r = Math.max(Math.sqrt(px*px+py*py), 1e-6);
    const hx = mat(2,1,[r, Math.atan2(py,px)]);
    const Hj = mat(2,4,[px/r, py/r, 0, 0,  -py/(r*r), px/(r*r), 0, 0]);
    // Update
    const y = mat(2,1,[rm[k]-hx.d[0], wrapAngle(bm[k]-hx.d[1])]);
    const S = madd(mmul(mmul(Hj,P),trans(Hj)), Rmeas);
    const K = mmul(mmul(P, trans(Hj)), inv2(S));
    x = madd(x, mmul(K, y));
    P = mmul(msub(eye(4), mmul(K, Hj)), P);
    epx.push(x.d[0]); epy.push(x.d[1]);
  }
  return { tpx, tpy, mpx, mpy, epx, epy };
}

// ─── UKF: same orbit, no Jacobian — uses sigma points instead ───────────────
// Deterministically chosen 2n+1 sigma points capture mean and covariance;
// propagated through the nonlinear h, then recombined with weights Wm/Wc
function runUKF(Qn, Rr, Rb, steps) {
  const rng = makeRng(7);
  const { tpx, tpy, rm, bm, mpx, mpy } = runOrbit(steps, rng, Rr, Rb);
  const dt = 0.1;
  const F = mat(4,4,[1,0,dt,0, 0,1,0,dt, 0,0,1,0, 0,0,0,1]);
  const Q = mscale(eye(4), Qn);
  const Rmeas = diag2(Rr*Rr, Rb*Rb);

  const n = 4, alpha = 1e-3, beta = 2, kappa = 0;
  const lam = alpha*alpha*(n+kappa) - n;
  const Wm = new Array(2*n+1).fill(1/(2*(n+lam)));
  Wm[0] = lam/(n+lam);
  const Wc = Wm.slice();
  Wc[0] += (1 - alpha*alpha + beta);

  let x = col([mpx[0], mpy[0], 0, 0]);
  let P = eye(4);
  const upx = [], upy = [];

  for (let k = 0; k < steps; k++) {
    // ─ Predict: propagate sigma points through F ─
    const sqP1 = chol(mscale(P, n+lam));
    const sigma = [x.d.slice()];
    for (let j = 0; j < n; j++) {
      const c = Array.from({length:n}, (_,i) => get(sqP1,i,j));
      sigma.push(x.d.map((v,i) => v+c[i]));
      sigma.push(x.d.map((v,i) => v-c[i]));
    }
    const sf = sigma.map(s => row2arr(mmul(F, col(s))));
    const xp = new Array(n).fill(0);
    for (let i = 0; i < 2*n+1; i++) for (let d = 0; d < n; d++) xp[d] += Wm[i]*sf[i][d];
    let Pp = mat(n,n, Q.d.slice());
    for (let i = 0; i < 2*n+1; i++) {
      const d = sf[i].map((v,idx) => v - xp[idx]);
      for (let r = 0; r < n; r++)
        for (let c2 = 0; c2 < n; c2++) Pp.d[r*n+c2] += Wc[i]*d[r]*d[c2];
    }

    // ─ Update: new sigma points, pass through h ─
    const sqP2 = chol(mscale(Pp, n+lam));
    const sigma2 = [xp.slice()];
    for (let j = 0; j < n; j++) {
      const c = Array.from({length:n}, (_,i) => get(sqP2,i,j));
      sigma2.push(xp.map((v,i) => v+c[i]));
      sigma2.push(xp.map((v,i) => v-c[i]));
    }
    const zs = sigma2.map(s => {
      const px2 = s[0], py2 = s[1];
      return [Math.max(Math.sqrt(px2*px2+py2*py2), 1e-6), Math.atan2(py2,px2)];
    });
    const zp = [0, 0];
    for (let i = 0; i < 2*n+1; i++) { zp[0] += Wm[i]*zs[i][0]; zp[1] += Wm[i]*zs[i][1]; }
    let Pzz = mat(2,2, Rmeas.d.slice());
    let Pxz = mat(n,2);
    for (let i = 0; i < 2*n+1; i++) {
      const dZ = [zs[i][0]-zp[0], zs[i][1]-zp[1]];
      const dX = sigma2[i].map((v,idx) => v - xp[idx]);
      for (let r = 0; r < 2; r++) for (let c2 = 0; c2 < 2; c2++)
        Pzz.d[r*2+c2] += Wc[i]*dZ[r]*dZ[c2];
      for (let r = 0; r < n; r++) for (let c2 = 0; c2 < 2; c2++)
        Pxz.d[r*2+c2] += Wc[i]*dX[r]*dZ[c2];
    }
    const K = mmul(Pxz, inv2(Pzz));
    const inn = [rm[k]-zp[0], wrapAngle(bm[k]-zp[1])];
    x = col(xp.map((v,i) => v + K.d[i*2]*inn[0] + K.d[i*2+1]*inn[1]));
    P = msub(Pp, mmul(mmul(K, Pzz), trans(K)));
    upx.push(x.d[0]); upy.push(x.d[1]);
  }
  return { tpx, tpy, mpx, mpy, upx, upy };
}

// ─── EnKF: same orbit, Monte-Carlo ensemble of Ne members ───────────────────
// No explicit P matrix — covariance is implicit in the spread of the ensemble
function runEnKF(Qn, Rr, Rb, steps, Ne) {
  const rng = makeRng(7);
  const { tpx, tpy, rm, bm, mpx, mpy } = runOrbit(steps, rng, Rr, Rb);
  const dt = 0.1;
  const F = mat(4,4,[1,0,dt,0, 0,1,0,dt, 0,0,1,0, 0,0,0,1]);
  const Q = mscale(eye(4), Qn);
  const Rmeas = diag2(Rr*Rr, Rb*Rb);
  const sqQ = chol(Q);
  const sqR = chol(Rmeas);

  // Initialise ensemble around first measurement with P0 = I (wider spread than Q)
  const sqP0 = chol(eye(4));
  const E = [];
  for (let i = 0; i < Ne; i++) {
    const n2 = [randn(rng),randn(rng),randn(rng),randn(rng)];
    E.push([mpx[0]+get(sqP0,0,0)*n2[0], mpy[0]+get(sqP0,1,1)*n2[1], get(sqP0,2,2)*n2[2], get(sqP0,3,3)*n2[3]]);
  }

  const epx = [], epy = [];

  for (let k = 0; k < steps; k++) {
    // Predict: propagate each member + process noise
    for (let i = 0; i < Ne; i++) {
      const Fv = row2arr(mmul(F, col(E[i])));
      const n2 = [randn(rng),randn(rng),randn(rng),randn(rng)];
      E[i] = Fv.map((val,d) => val + Array.from({length:4},(_,j)=>get(sqQ,d,j)*n2[j]).reduce((a,v)=>a+v,0));
    }

    // Ensemble mean and anomaly matrix A
    const xm = new Array(4).fill(0);
    for (let i = 0; i < Ne; i++) for (let d = 0; d < 4; d++) xm[d] += E[i][d]/Ne;
    const A = mat(4, Ne);
    for (let i = 0; i < Ne; i++)
      for (let d = 0; d < 4; d++) set(A, d, i, (E[i][d]-xm[d])/Math.sqrt(Ne-1));

    // Perturbed observations
    const zObs = Array.from({length:Ne}, () => {
      const n2 = [randn(rng), randn(rng)];
      return [rm[k]+get(sqR,0,0)*n2[0], bm[k]+get(sqR,1,1)*n2[1]];
    });

    // Nonlinear h for each member
    const Hx = E.map(s => {
      const px = s[0], py = s[1];
      return [Math.max(Math.sqrt(px*px+py*py), 1e-6), Math.atan2(py,px)];
    });
    const zm = [0, 0];
    for (let i = 0; i < Ne; i++) { zm[0] += Hx[i][0]/Ne; zm[1] += Hx[i][1]/Ne; }

    const AH = mat(2, Ne);
    for (let i = 0; i < Ne; i++) {
      set(AH,0,i,(Hx[i][0]-zm[0])/Math.sqrt(Ne-1));
      set(AH,1,i,(Hx[i][1]-zm[1])/Math.sqrt(Ne-1));
    }

    // Kalman gain from ensemble statistics
    const Pzz = madd(mmul(AH, trans(AH)), Rmeas);
    const K = mmul(mmul(A, trans(AH)), inv2(Pzz));

    for (let i = 0; i < Ne; i++) {
      const inn = [zObs[i][0]-Hx[i][0], wrapAngle(zObs[i][1]-Hx[i][1])];
      for (let d = 0; d < 4; d++) E[i][d] += get(K,d,0)*inn[0] + get(K,d,1)*inn[1];
    }

    const xm2 = new Array(4).fill(0);
    for (let i = 0; i < Ne; i++) for (let d = 0; d < 4; d++) xm2[d] += E[i][d]/Ne;
    epx.push(xm2[0]); epy.push(xm2[1]);
  }
  return { tpx, tpy, mpx, mpy, epx, epy };
}

// ─── AKF: 1-D tracker that estimates R online from a sliding window ──────────
// Same as KF but R is adapted each step using the innovation variance:
//   R_hat = mean(ν²) - H*P*H'
function runAKF(Qn, R0, steps, W) {
  const rng = makeRng(42);
  const dt = 1;
  const F = mat(2,2,[1,dt,0,1]);
  const H = mat(1,2,[1,0]);
  const Q = mscale(eye(2), Qn);

  // True R doubles halfway through to simulate a sensor change
  const tp = [], meas = [];
  let pos = 0, vel = 1;
  for (let k = 0; k < steps; k++) {
    pos += vel*dt + randn(rng)*Math.sqrt(Qn);
    tp.push(pos);
    const Rtrue = R0 * (1 + 3*(k >= steps/2 ? 1 : 0));
    meas.push(pos + randn(rng)*Math.sqrt(Rtrue));
  }

  let x = col([meas[0], 0]);
  let P = eye(2);
  let R = R0;
  const ep = [], ev = [], sig_p = [], Rhist = [];
  const innov = new Array(W).fill(0);

  for (let k = 0; k < steps; k++) {
    x = mmul(F, x); P = madd(mmul(mmul(F,P),trans(F)), Q);
    const S_val = get(mmul(mmul(H,P),trans(H)),0,0) + R;
    const K = mscale(mmul(P, trans(H)), 1/S_val);
    const nu = meas[k] - mmul(H,x).d[0];
    x = madd(x, mscale(K, nu));
    P = mmul(msub(eye(2), mmul(K,H)), P);
    ep.push(x.d[0]); ev.push(x.d[1]);
    sig_p.push(Math.sqrt(get(P,0,0)));
    innov[k % W] = nu;
    // Adapt R after the first full window
    if (k >= W-1) {
      const innov2mean = innov.reduce((a,v) => a+v*v, 0) / W;
      const HPH = get(mmul(mmul(H,P),trans(H)),0,0);
      R = Math.max(innov2mean - HPH, 1e-4);
    }
    Rhist.push(R);
  }
  return { tp, meas, ep, ev, sig_p, Rhist };
}
