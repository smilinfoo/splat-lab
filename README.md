Scratch notes. Canonical docs: `docs/project-overview.md`, `docs/architecture.md`.

** Debug modes (live shader) **
Mode 0: Normal (disc falloff; default)
Mode 1: Opaque color (no gradient)
Mode 2: Scale
Mode 3: Rot — broken (`v_rot_debug` never written)
Mode 4: R — stub, not implemented
Mode 5: Opacity

Day 1
Basic Three.js scene
Camera controls
Point cloud renderer (no gaussian yet)

Day 2
Add splat loader
Add shader-based gaussian expansion
Basic visual fidelity working

Day 3
UI controls
Debug modes
Explainer step system (minimal) — not implemented

Day 4 (polish)
Demo scene polish
README
GIF / screen capture for LinkedIn


PROC NOTES (intended math; live GLSL does not match yet):
R = rotation
S = diagonal scale matrix
Σ₃D = R · S · S · Rᵀ
S = diag(sx, sy, sz)
Σ₂D = J · Σ₃D · Jᵀ
J = Jacobian of perspective projection

frag
exp(-0.5 * xᵀ Σ₂D⁻¹ x)

PLY Notes:
Format notes from MK — loader does **not** sniff these yet
checks for line starts
if find "element chunk" its play canvas
"element codebook_centers" its Inria paper v2
if neither its Inria v1

What the loader actually does (not the MK *255 path):
SCALE_0, 1, 2
    left in log space; vertex shader does exp(RAW)
F_DC_0, 1, 2 (color)
    if F_DC_0 is set
        const SH_C0 = 0.28209479177387814;
        F_DC_0, 1, 2 = clamp01(0.5 + SH_C0 * RAW)
    if not
        RGB from file; divide by 255 only if value is outside [0, 1]
OPACITY
    OPACITY = sigmoid(RAW) in [0, 1] on the CPU; vertex shader uses that value as-is
ROTATION
    PLY rot_0 is W
    store xyzw, hemisphere-flip if w < 0, normalize
    ROTATION_0, 1, 2, 3 = x, y, z, w
POSITION
    unaffected
