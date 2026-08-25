# Project Overview

Canonical project overview. Agent rules live in `.cursor/rules/`. Architecture map: `docs/architecture.md`. `README.md` is scratch notes.

## Purpose

- Experimental 3D Gaussian splat viewer / test bed. Not for production.
- Pipeline steps (load, pack, sort, draw) should stay easy to swap so efficiency experiments are cheap.
- Distinct steps with clean interfaces are favoured over packing work together.

## Current State

- A Vite + TypeScript + Three.js app loads `public/splats/point_cloud.ply` (Git LFS), uploads splat data to the GPU, and draws each splat as a camera-facing quad with custom GLSL.
- Data reaches the GPU as instanced attributes, uniforms, **and** float `DataTexture`s. The live vertex shader samples the textures and uses `order` plus the base quad `position`. Instanced `splatPosition` / `scale` / `rotation` / `opacity` are uploaded but not used for the live path. `color` is read once, then overwritten from the texture.
- The scene renders, but shader math is still incorrect (see Current Problems).
- Depth sorting is implemented in `splats/splatSorter.ts` (pure module). Each frame `main.ts` sets the view transform, calls `sort()`, and copies the returned indices into the `order` attribute. `order` is no longer identity.
- Overlay UI: splat size, opacity, additive/normal blending. Keyboard `0`–`5` sets `u_debug_mode` (bypasses UI state). The size slider scales the splat footprint (`u_size_multiplier`, `1.0` = natural size).
- Live path: `createSplatMesh` + data textures + `src/shaders/*.glsl`. `splatMeshOLD.ts` / `splatMaterial_OLD.ts` are an earlier `THREE.Points` prototype.
- There is no explainer step system. Debug keys are not that system. PlayCanvas and Inria v2 PLY variants are not detected.

## Important Concepts

**Intended math** (not necessarily what the live shader implements):

- Each splat is a 3D Gaussian: position, log-space scale, quaternion rotation, opacity, color (SH DC or RGB).
- Covariance: `Σ₃D = R · S · S · Rᵀ` with `S = diag(sx, sy, sz)` (world space), then project `Σ₂D = J · W · Σ₃D · Wᵀ · Jᵀ` where `W` is the world→camera rotation and `J` the perspective Jacobian. Fragment falloff: `exp(-0.5 * xᵀ Σ₂D⁻¹ x)`.
- Three.js view space looks down **−Z**. The vertex shader discards splats with `cam_pos.z >= 0.0` for that reason.

**Live decode / layout:**

- PLY `rot_0` is W. Loader stores **xyzw**, hemisphere-flipped (`w < 0`) and normalized. Shader comments that say `(w, x, y, z)` are stale.
- Scale stays in log space on the CPU; the vertex shader applies `exp`.
- Opacity is sigmoid’d **once**, in the loader. The vertex shader uses that `[0,1]` value as-is, then multiplies by `u_opacity_multiplier` (temporary UI gain; will be reimplemented — do not treat this uniform as the final opacity-control design).
- `order` is the sort hook: instance `k` draws splat `order[k]`, so the `order` array is the draw sequence. Draw order **is** compositing order (`depthWrite: false`); the sorter produces it far→near each frame.

After a correct basic example: workers for sorting, octrees, LOD. Do not add those until Gaussians look right.

## Data Flow

Startup (once), composed in `src/main.ts`:

1. `createRenderer()` → append canvas
2. `createScene()` → `createCamera()` (OrbitControls via `document.querySelector("canvas")`)
3. `createSplatMaterial()`
4. `loadBinaryPly("/splats/point_cloud.ply")` → `SplatData` typed arrays
5. `createDataTextureSet(data)` → float data textures
6. `createSplatMesh(data, material, textures)` → `scene.add(mesh)`
7. `createSplatSorter(positions, order)` (owns a copy of positions + the index buffer)
8. `createUI(onChange)` + `applyState(material)`
9. Per frame: update view matrix → `sorter.setTransform(view.elements)` → `sorter.sort()` → copy indices into the `order` attribute → `renderer.render(scene, camera)` (does not call `controls.update()`)

CPU decode (`loader.ts`):

- Position: as-is
- Color: `clamp01(0.5 + SH_C0 * f_dc_*)` when SH DC exists; else `normalizeColorComponent` (divide by 255 only if the value is outside `[0, 1]`)
- Scale: **left in log space**. Missing scale properties default to `0.05` (then the shader `exp`s them)
- Rotation: `rot_0` as W → xyzw, `w < 0` flip, normalize
- Opacity: **sigmoid already applied**; missing opacity → `1`
- `order[i] = i`

Texture packing (`splatDataTextures.ts`):

- Positions, scales: padded to RGBA float (`w = 1`)
- Colors: RGBA float; **alpha is already-sigmoid’d opacity** (live shader reads `.rgb` only)
- Rotations: RGBA float (xyzw)
- Opacities: `RedFormat` / item size 1, not RGBA

Per splat on GPU (live path):

1. Vertex shader indexes data textures with `order`
2. `exp(scale)`; opacity used as-is; `normalize(quat)`
3. Build `Σ₃D = R * diag(s²) * Rᵀ`, then `Σ₂D = transpose(T) * Σ₃D * T` with `T = transpose(mat3(modelView)) * J`. Because GLSL's `mat3(...)` is column-major, the shader's `J` is the textbook Jacobian transposed, and this expands to the correct `J · R · Σ₃D · Rᵀ · Jᵀ`. Do not "simplify" it.
4. Single footprint path: eigen-decompose `Σ₂D`, build the quad from `eigenVector * sqrt(8 * eigenvalue)`, scaled by `u_size_multiplier`. `gl_Position` is the quad corner in NDC; `v_position = position * sqrt8`
5. Fragment evaluates the disc Gaussian `opacity = exp(-0.5 * dot(v_position,v_position)) * v_opacity` (`sqrt8` cancels the vertex basis, giving a correct elliptical Gaussian). Output is **premultiplied**: `vec4(v_color.rgb * opacity, opacity)` with material `premultipliedAlpha: true`, so Normal blend = correct "over" and Additive = straight add. Debug modes 1–5 return early.

UI: slider/button → `src/ui/state.ts` → `applyState(material)` → `u_size_multiplier`, `u_opacity_multiplier`, blending. Size, opacity, and blending all take effect. `u_opacity_multiplier` is a stand-in and will be reimplemented.

## Debug modes (`u_debug_mode`)

| Key | Intended | Live shader |
|---|---|---|
| 0 | Normal | Disc-based color/alpha (default) |
| 1 | No gradient / opaque color | Opaque color (`step` on RGB) |
| 2 | Scale | `clamp(v_scale * 220, 0, 1)` |
| 3 | Rotation | `v_rot_debug` — **never written** |
| 4 | R | Stub (`clamp(1.04, …)`), not rotation-matrix debug |
| 5 | Opacity | `v_opacity` grayscale |

## Important Constraints

- Do not fold load / texture fill / sort / draw into one module. New steps are named functions called from `main.ts`.
- Do not add dependencies without asking.
- Do not `exp()` scales in the loader unless the shader `exp()` is removed.
- Do not add another opacity activation without checking loader **and** shader.
- PLY is Git LFS (`public/splats/*`). Clones without LFS get a pointer file and the loader fails.
- `README.md` PROC NOTES are MK/reference notes, not a description of running code.
- Loader handles binary `element vertex` PLY only. It collects **every** `property` line in the header (not scoped to the vertex element). PlayCanvas (`element chunk`) and Inria v2 (`element codebook_centers`) are not implemented. ASCII PLY is rejected.

## Current Problems

- GLSL math is still being corrected. One footprint path now (eigenvector quad + disc Gaussian). `computeCovariance3D` and `quatToMat3`'s alt helper are unused. Degenerate splats (`eigenValue2 <= 0.0`) now cull cleanly (write off-screen `gl_Position`, then return).
- Live fragment output is the disc Gaussian only. Modes 3 and 4 are dead/stubs.
- Instanced attributes and data textures both uploaded; live shader mostly uses textures.
- `u_size_multiplier` now scales the live footprint. `state.splatSize` defaults to `1.0` (natural size); slider range `0.1`–`4`.
- Resize updates the renderer only — not camera `aspect` or `u_viewport`.
- `createCamera()` finds the canvas with `document.querySelector("canvas")` instead of `renderer.domElement`.
- `OrbitControls.enableDamping = true` but the render loop never calls `controls.update()`.
- Material defaults to `AdditiveBlending`; `state.additive` is `false`. First `applyState` wins (`NormalBlending`).
- Instanced geometry bounds come from the 2×2 quad, not the splat cloud. Default `frustumCulled` can hide the whole mesh when the origin leaves the frustum.
- `instanceCount` is never set (Three.js infers it). `createDataTextureSet` is `async` with no async work. `opacity` attribute is item size 1 but declared `vec4`. `u_debug_mode` is created as a float and declared `int`.
- No tests. Leftovers: `counter.ts`, leftover Vite CSS in `style.css` (still imported), `src/data/sample.json`, `*_OLD.ts`, `public/splats/test.py`. Scale min/max logging still lives in `main.ts`.

## Next steps

1. Covariance → projection → footprint math is now believed correct. Remaining shader cleanup: dead helpers (`computeCovariance3D`, unused `v_rot_debug` / debug modes 3–4).
2. Sorting is implemented (comparison sort, per frame). Phase 2 (interface unchanged): 16-bit radix/counting sort to remove GC + comparator cost, and/or only re-sort when the camera moved past a threshold.
3. Then: workers for sorting, octrees, LOD.
