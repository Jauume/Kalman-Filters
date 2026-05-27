# Kalman Filter Toy

An interactive browser toy of Kalman filter variants. Open `index.html` directly in any browser or [click here](https://jauume.github.io/Kalman-Filters/).

---

## How to use

Open `index.html` in a browser (double-click it, or `open index.html` in a terminal).

Each tab shows a different filter. Use the sliders to change parameters and the charts update instantly:

- **Q** — process noise variance. How much the true state wanders between steps. Higher Q → filter trusts measurements more, reacts faster, but noisier estimate.
- **R** (or σr / σθ) — measurement noise variance. How noisy the sensor is. Higher R → filter trusts the model more, smoother but slower to react.
- **N** — number of simulation steps.
- **Ne** (EnKF only) — ensemble size. More members → better covariance estimate, slower.
- **W** (AKF only) — innovation window length for adapting R.

---

## The two steps every Kalman filter repeats

Every variant below runs the same predict → update loop at each time step k.

### Predict

Use the motion model to project forward:

```
x̂⁻ = F · x̂        (predicted state)
P⁻  = F · P · Fᵀ + Q  (predicted covariance)
```

- **x̂** — state estimate (position, velocity, …)
- **P** — covariance matrix (our uncertainty about x̂)
- **F** — state transition matrix (encodes the motion model, e.g. constant velocity)
- **Q** — process noise covariance (how much the world surprises us)

### Update

Correct the prediction using the new measurement z:

```
S = H · P⁻ · Hᵀ + R        (innovation covariance)
K = P⁻ · Hᵀ · S⁻¹          (Kalman gain)
x̂ = x̂⁻ + K · (z − H · x̂⁻)  (updated state)
P = (I − K · H) · P⁻        (updated covariance)
```

- **H** — measurement matrix (maps state to what the sensor sees)
- **R** — measurement noise covariance
- **K** — Kalman gain (how much to trust the measurement vs the prediction)
- **z − H·x̂⁻** — innovation (surprise: actual vs predicted measurement)

The gain K automatically balances Q and R. When R is small (good sensor), K is large and measurements dominate. When Q is small (stable model), K is small and predictions dominate.

---

## Filter-by-filter guide

### KF — Kalman Filter (linear)

The classic filter. Assumes linear motion and linear sensor. State is `[position, velocity]`; sensor measures position only.

**F** = `[[1, dt], [0, 1]]` (constant velocity),  **H** = `[1, 0]` (measure position)

Works exactly when both motion and measurement are linear + Gaussian.

---

### EKF — Extended Kalman Filter

Same constant-velocity state, but the sensor returns **polar coordinates** (range r, bearing θ) instead of Cartesian position. That mapping is nonlinear:

```
h(x) = [ sqrt(px² + py²),  atan2(py, px) ]
```

EKF linearises h at each step using its **Jacobian** Hⱼ:

```
Hⱼ = ∂h/∂x  evaluated at current x̂
```

Then proceeds with the standard update using Hⱼ in place of H. Works well when nonlinearity is mild; can diverge if the state is far from the linearisation point.

---

### UKF — Unscented Kalman Filter

Same polar-measurement orbit problem as EKF, but instead of linearising, it passes **sigma points** through the exact nonlinear function.

For an n-dimensional state, 2n+1 sigma points are chosen deterministically around the current mean/covariance:

```
σ₀  = x̂
σᵢ  = x̂ + √((n+λ)P) column i   (i = 1…n)
σₙ₊ᵢ = x̂ − √((n+λ)P) column i  (i = 1…n)
```

Each point is propagated through F and h, then recombined with weights Wm (mean) and Wc (covariance). No Jacobian needed. More accurate than EKF for strongly nonlinear systems at a similar computational cost.

---

### EnKF — Ensemble Kalman Filter

Uses a **Monte-Carlo ensemble** of Ne state copies instead of an explicit covariance matrix P. Covariance is implicit in the spread of the members.

Predict: propagate each member through F + add random process noise.  
Update: compute the Kalman gain from ensemble statistics, then update every member with a perturbed observation.

Scales to very high-dimensional problems (e.g. weather models) where storing/inverting P is impossible. The ensemble size Ne trades accuracy for speed.

---

### AKF — Adaptive Kalman Filter

Standard linear KF (same as the KF tab), but R is **estimated online** from the recent innovation history rather than fixed in advance.

After each step, R is updated using a sliding window W of past innovations ν:

```
R̂ = mean(ν²) − H · P · Hᵀ
```

This lets the filter automatically react when sensor noise changes mid-run. In the demo, R doubles halfway through the simulation; watch the estimated R (orange) track the true R (green).
