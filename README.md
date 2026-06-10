Mode 1: No gradient
Mode 2: Scale
Mode 3: Rot
Mode 4: R
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
Explainer step system (minimal)

Day 4 (polish)
Demo scene polish
README
GIF / screen capture for LinkedIn


PROC NOTES:
R = rotation
S = diagnol scale matrix
Σ₃D = R · S · S · Rᵀ
S = diag(sx, sy, sz)
Σ₂D = J · Σ₃D · Jᵀ
J = Jacobian of perspective projection

frag
exp(-0.5 * xᵀ Σ₂D⁻¹ x)

PLY Notes:
Format notes from MK
checks for line stars
if find "element chunk" its play canvas
"element codebook_centers" its Inria paper v2
if neither its Inria v1

Raw input processing
SCALE_0, 1 , 2 
    SCALE_0, 1, 2 =  Math.exp(RAW_VALE)
F_DC_0, 1, 2 (color)
    if F_DC_0 is set
        const SH_C0 = 0.28209479177387814;
        F_DC_0, 1, 2 = (0.5 + SH_C0 * RAW_VALE) * 255;  clamp(0-255)
    if not
        F_DC_0, 1, 2 = RED, BUE, GREEN raw values from file * 255 clamp(0-255)
OPACITY
    OPACITY = (1 / (1 + Math.exp(-RAW_VALE))) * 255;  clamp(0-255)
ROTATION
    normalizedRotation = new THREE.Quaternion();
    normalizedRotation.set(RAW_ROT_0, RAW_ROT_1, RAW_ROT_2, RAW_ROT_3);
    normalizedRotation.normalize();
    ROTATION_0, 1, 2, 3 = normalizedRotation.x ,y ,z, w
POSITION
    uneffected
