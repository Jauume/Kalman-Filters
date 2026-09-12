// ─── Seeded RNG (Mulberry32) ─────────────────────────────────────────────────
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Box-Muller standard normal sample
function randn(rng) {
  const u = 1 - rng(), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── Matrix helpers (flat row-major) ────────────────────────────────────────
function mat(r, c, data) { return { r, c, d: data ? data.slice() : new Array(r*c).fill(0) }; }
function get(m, i, j)    { return m.d[i*m.c + j]; }
function set(m, i, j, v) { m.d[i*m.c + j] = v; }

function mmul(A, B) {
  const C = mat(A.r, B.c);
  for (let i = 0; i < A.r; i++)
    for (let j = 0; j < B.c; j++) {
      let s = 0;
      for (let k = 0; k < A.c; k++) s += get(A,i,k)*get(B,k,j);
      set(C,i,j,s);
    }
  return C;
}
function madd(A, B) {
  const C = mat(A.r, A.c);
  for (let i = 0; i < A.d.length; i++) C.d[i] = A.d[i] + B.d[i];
  return C;
}
function msub(A, B) {
  const C = mat(A.r, A.c);
  for (let i = 0; i < A.d.length; i++) C.d[i] = A.d[i] - B.d[i];
  return C;
}
function mscale(A, s) {
  const C = mat(A.r, A.c);
  for (let i = 0; i < A.d.length; i++) C.d[i] = A.d[i] * s;
  return C;
}
function trans(A) {
  const C = mat(A.c, A.r);
  for (let i = 0; i < A.r; i++)
    for (let j = 0; j < A.c; j++) set(C,j,i,get(A,i,j));
  return C;
}
function eye(n) {
  const I = mat(n,n);
  for (let i = 0; i < n; i++) set(I,i,i,1);
  return I;
}
function diag2(a, b) {
  const D = mat(2,2);
  set(D,0,0,a); set(D,1,1,b);
  return D;
}

// 2×2 inverse
function inv2(A) {
  const det = get(A,0,0)*get(A,1,1) - get(A,0,1)*get(A,1,0);
  const B = mat(2,2);
  set(B,0,0, get(A,1,1)/det); set(B,0,1,-get(A,0,1)/det);
  set(B,1,0,-get(A,1,0)/det); set(B,1,1, get(A,0,0)/det);
  return B;
}

// N×N inverse via Gauss-Jordan
function invN(A) {
  const n = A.r;
  const aug = mat(n, 2*n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) set(aug, i, j, get(A,i,j));
  for (let i = 0; i < n; i++) set(aug, i, n+i, 1);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col+1; row < n; row++)
      if (Math.abs(get(aug,row,col)) > Math.abs(get(aug,pivot,col))) pivot = row;
    const tmp = aug.d.slice(col*2*n, (col+1)*2*n);
    aug.d.splice(col*2*n, 2*n, ...aug.d.slice(pivot*2*n, (pivot+1)*2*n));
    aug.d.splice(pivot*2*n, 2*n, ...tmp);
    const pv = get(aug, col, col);
    for (let j = 0; j < 2*n; j++) set(aug, col, j, get(aug,col,j)/pv);
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = get(aug, row, col);
      for (let j = 0; j < 2*n; j++) set(aug, row, j, get(aug,row,j) - f*get(aug,col,j));
    }
  }
  const inv = mat(n,n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) set(inv, i, j, get(aug, i, n+j));
  return inv;
}

// Cholesky lower-triangular factor
function chol(A) {
  const n = A.r;
  const L = mat(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = get(A,i,j);
      for (let k = 0; k < j; k++) s -= get(L,i,k)*get(L,j,k);
      if (i === j) set(L,i,j, Math.sqrt(Math.max(s, 1e-12)));
      else         set(L,i,j, s / get(L,j,j));
    }
  }
  return L;
}

// Column-vector helpers
function col(arr)     { const v = mat(arr.length,1); v.d = arr.slice(); return v; }
function row2arr(m)   { return m.d.slice(); }

// Wrap angle to [-π, π]
function wrapAngle(a) { return ((a + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI; }
