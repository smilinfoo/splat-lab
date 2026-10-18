# Gaussian Splat Lab
An experimental 3D Gaussian splat viewer. This is a test bed for trying ideas, not a production renderer.  Still very much in inital build phase.

## Purpose

- Experimental 3D Gaussian splat viewer / test bed. Not for production.
- **Primary goal: swap and compare.** Every pipeline step (load, pack, sort, draw) is swapable as possible so they can be benchmarked against each other, e.g. swapping the sort module to compare speed, or swapping the render/GLSL path to test batching. Using workers for sorting, octrees, LOD are intended comparisons to come.

The point is to make swapping a piece in or out as easy as possible. Load, texture pack, sort, shaders, and draw stay as separate steps with clean interfaces, so one implementation can be replaced and compared without rewriting the rest. The project is built for simplicity, understandability, and modularity.

Debugging tools and built-in profiling will be added so those swaps can be inspected and measured.

Canonical docs: [`docs/project-overview.md`](docs/project-overview.md), [`docs/architecture.md`](docs/architecture.md).

## Debug modes (`u_debug_mode`)

| Mode | Intended | Live shader |
|---|---|---|
| 0 | Normal ("Plain" in the dropdown) | Disc-based color/alpha (default) |
| 1 | No gradient / opaque color | Opaque color (`step` on RGB) |
| 2 | Scale | `clamp(v_scale * 220, 0, 1)` |
| 3 | Rotation | `v_rot_debug` — **never written** |
| 4 | R | Stub (`clamp(1.04, …)`), not rotation-matrix debug |
| 5 | Opacity | `v_opacity` grayscale |

## Layers

```
src/main.ts                 composition root (init + loop)
  src/core/                 Three.js scene bootstrap
    renderer.ts / scene.ts / camera.ts
  src/splats/               splat pipeline
    loader.ts               PLY parse + CPU decode → SplatData
    splatDataTextures.ts    SplatData → float DataTextures
    splatMesh.ts            InstancedBufferGeometry, instance attrs,
                            and texture uniform bind (layer leak)
    splatMaterial.ts        ShaderMaterial + uniform declarations only
    splatSorter.ts          pure depth sort (positions + indices -> order)
  src/shaders/              covariance, projection, Gaussian, debug
  src/ui/
    state.ts                store
    ui.ts                   DOM; writes state
    bindings.ts             reads state; patches material
```

## Notes for People

- Do not `exp()` scales in the loader unless the shader `exp()` is removed.
- Do not add another opacity activation without checking loader **and** shader.
- PLY is Git LFS (`public/splats/*`). Clones without LFS get a pointer file and the loader fails.
- Loader handles binary `element vertex` PLY only. It collects **every** `property` line in the header (not scoped to the vertex element). PlayCanvas (`element chunk`) and Inria v2 (`element codebook_centers`) are not implemented. ASCII PLY is rejected.

## Notes for Robots

- Do not fold load / texture fill / sort / draw into one module. New steps are named functions called from `main.ts`.
- Do not add dependencies without asking.
- `README.md` PROC NOTES are MK/reference notes, not a description of running code.
- Keep rendering logic separate from application/state logic. Do not move functionality between these layers without discussion.
| Step | Module | Job |
|---|---|---|
| Load / parse | `splats/loader.ts` | Binary PLY → typed arrays |
| Pack | `splats/splatDataTextures.ts` | Arrays → GPU textures |
| Mesh / draw setup | `splats/splatMesh.ts` | Geometry + instance attrs. Also binds texture uniforms onto the material — a known leak |
| Material factory | `splats/splatMaterial.ts` | `ShaderMaterial` wrapper and uniform defaults. No Gaussian math |
| Shaders | `src/shaders/*.glsl` | Covariance, projection, quad expansion, Gaussian/disc eval, debug |
| Sort | `splats/splatSorter.ts` | Pure module: owns positions + index buffer; `setTransform` then `sort()` returns far→near indices. Writes nothing to the GPU |
| App state | `ui/state.ts` + `ui.ts` + `bindings.ts` | Store / DOM writes / material apply |
| Render loop | `main.ts` | Per frame: refresh model-view matrix (`camera.matrixWorldInverse * splatMesh.matrixWorld`) → drive the sorter → copy indices into the `order` attribute → `renderer.render`. Owns the GPU buffer write. Does not update OrbitControls |

`main.ts` is the only composition root. Add new steps as named functions called from there. Today it still contains loader-ish scale stats and the hard-coded test mesh position/rotation.

## Important Concepts

**Intended math** (not necessarily what the live shader implements):

- Each splat is a 3D Gaussian: position, log-space scale, quaternion rotation, opacity, color (SH DC or RGB).
- Covariance: `Σ₃D = R · S · S · Rᵀ` with `S = diag(sx, sy, sz)` (world space), then project `Σ₂D = J · W · Σ₃D · Wᵀ · Jᵀ` where `W` is the world→camera rotation and `J` the perspective Jacobian. Fragment falloff: `exp(-0.5 * xᵀ Σ₂D⁻¹ x)`.
- Three.js view space looks down **−Z**. The vertex shader discards splats with `cam_pos.z >= 0.0` for that reason.

## Control flow

- **Init:** renderer → append canvas → scene → camera → material → load PLY → textures → mesh → sorter → UI → animate
- **Frame:** refresh model-view matrix → `sorter.setTransform` → `sorter.sort()` → write `order` attribute → render
- **UI:** input → `ui.ts` mutates `state` → `onChange()` → `applyState(material)`
- **Debug mode:** "View Mode" dropdown → `state.debugMode` → `applyState` → `u_debug_mode` (one-way; key listeners removed)
- **Camera:** `createCamera()` returns `{ camera, controls }`. OrbitControls on the canvas after it is appended; `main.ts` targets the mesh position once; damping is enabled but never updated

### detailed data flow

Startup (once), composed in `src/main.ts`:

1. `createRenderer()` → append canvas
2. `createScene()` → `createCamera()` (returns `{ camera, controls }`; OrbitControls via `document.querySelector("canvas")`). After the mesh is added, `main.ts` sets `controls.target` to the mesh position and calls `controls.update()` once
3. `createSplatMaterial()`
4. `loadBinaryPly("/splats/point_cloud.ply")` → `SplatData` typed arrays
5. `createDataTextureSet(data)` → float data textures
6. `createSplatMesh(data, material, textures)` → `scene.add(mesh)`
7. `createSplatSorter(positions, order)` (owns a copy of positions + the index buffer)
8. `createUI(onChange)` + `applyState(material)`
9. Per frame: update model-view matrix → `sorter.setTransform(modelView.elements)` → `sorter.sort()` → copy indices into the `order` attribute → `renderer.render(scene, camera)` (does not call `controls.update()`)

## Current Issues

- Live fragment output is the disc Gaussian only. Modes 3 and 4 are dead/stubs.
- Instanced attributes and data textures both uploaded; live shader mostly uses textures.
- `u_size_multiplier` now scales the live footprint. `state.splatSize` defaults to `1.0` (natural size); slider range `0.1`–`4`.
- Resize updates the renderer only — not camera `aspect` or `u_viewport`.
- `createCamera()` finds the canvas with `document.querySelector("canvas")` instead of `renderer.domElement`.
- `OrbitControls.enableDamping = true` but the render loop never calls `controls.update()`. `controls.target` is copied from the mesh position once at startup, so later mesh moves do not re-target it.
- Material defaults to `AdditiveBlending`; `state.additive` is `false`. First `applyState` wins (`NormalBlending`).
- Instanced geometry bounds default to the 2×2 quad, so `splatMesh.ts` assigns `geometry.boundingSphere` from the splat positions, padded by `exp(max log-scale)`. A few outlier splats can inflate it (culling gets weaker, never wrong).
- `instanceCount` is never set (Three.js infers it). `createDataTextureSet` is `async` with no async work. `opacity` attribute is item size 1 but declared `vec4`. `u_debug_mode` is created as a float and declared `int`.
- No tests. Leftovers: `counter.ts`, leftover Vite CSS in `style.css` (still imported), `src/data/sample.json`, `*_OLD.ts`, `public/splats/test.py`. Scale min/max logging still lives in `main.ts`.

## Dependencies

- Runtime: `three` `^0.184.0` (`InstancedBufferGeometry`, `DataTexture`, `ShaderMaterial`, `OrbitControls` from `three/examples/jsm`)
- Tooling: `vite` `^8.0.4` (`?raw` GLSL, `public/`), `typescript` `~6.0.2`
- No splat-format library, no test runner. PLY parsing is custom.

## Working notes for self

- Dual GPU upload (instance attrs + textures). Sorting/LOD must pick one source of truth.
- Activation split: scale `exp` is GPU-only; opacity sigmoid is CPU-only. Do not add a second opacity sigmoid in the shader.
- `u_opacity_multiplier` is a temporary UI gain (`state.opacity` → uniform). It will be reimplemented; do not build new opacity-control design around this uniform.
- Quaternion layout is xyzw after load. 
- Color texture alpha duplicates opacity; a separate `RedFormat` opacity texture is what the shader samples.
- `u_size_multiplier` scales the live footprint (eigenvector basis). `state.splatSize` defaults to `1.0`.
- `opacity` attribute is item size 1 but declared `vec4` in the vertex shader.
- `createDataTextureSet` is `async` but has no async work.
- Sorting runs every frame (comparison sort) and rewrites the `order` attribute; the sorter must stay pure (no THREE/geometry/renderer). `main.ts` passes the model-view matrix (view × `splatMesh.matrixWorld`), so a mesh transform is honored; keep it that way.
- Culling uses `geometry.boundingSphere`, set in `splatMesh.ts` from the splat positions (padded by the largest splat scale), not the default 2×2 quad bounds.
- PlayCanvas / Inria v2 are not implemented **loader is format-generic.
- Header parser is not scoped to `element vertex`; extra `property` lines from other elements would be included.

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
