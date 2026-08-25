# Architecture

Canonical architecture map. Overview and current bugs: `docs/project-overview.md`. Agent rules: `.cursor/rules/`.

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

Keep rendering logic separate from application/state logic. Do not move functionality between these layers without discussion.

| Step | Module | Job |
|---|---|---|
| Load / parse | `splats/loader.ts` | Binary PLY → typed arrays |
| Pack | `splats/splatDataTextures.ts` | Arrays → GPU textures |
| Mesh / draw setup | `splats/splatMesh.ts` | Geometry + instance attrs. Also binds texture uniforms onto the material — a known leak |
| Material factory | `splats/splatMaterial.ts` | `ShaderMaterial` wrapper and uniform defaults. No Gaussian math |
| Shaders | `src/shaders/*.glsl` | Covariance, projection, quad expansion, Gaussian/disc eval, debug |
| Sort | `splats/splatSorter.ts` | Pure module: owns positions + index buffer; `setTransform` then `sort()` returns far→near indices. Writes nothing to the GPU |
| App state | `ui/state.ts` + `ui.ts` + `bindings.ts` | Store / DOM writes / material apply |
| Render loop | `main.ts` | Per frame: refresh view matrix → drive the sorter → copy indices into the `order` attribute → `renderer.render`. Owns the GPU buffer write. Does not update OrbitControls |

`main.ts` is the only composition root. Add new steps as named functions called from there. Today it still contains loader-ish scale stats and debug key handling.

## Dependencies

- Runtime: `three` `^0.184.0` (`InstancedBufferGeometry`, `DataTexture`, `ShaderMaterial`, `OrbitControls` from `three/examples/jsm`)
- Tooling: `vite` `^8.0.4` (`?raw` GLSL, `public/`), `typescript` `~6.0.2`
- No splat-format library, no test runner. PLY parsing is custom.

## Intentional separations

- Core vs splats vs UI vs shaders
- Load vs texture pack vs mesh vs material vs sort (sort is pure; buffer write stays in `main.ts`)
- Store (`state.ts`) vs DOM (`ui.ts`) vs apply (`bindings.ts`)
- Shaders as raw files, not inlined (the old material inlined them)
- `order` kept as a separate attribute so sorting can land without changing texture layout
- Debug modes live in the fragment shader so visualization does not change the CPU path

Favour a readable list of steps over efficiency. Do not merge steps to save a pass without discussion.

## Control flow

- **Init:** renderer → append canvas → scene → camera → material → load PLY → textures → mesh → sorter → UI → animate
- **Frame:** refresh view matrix → `sorter.setTransform` → `sorter.sort()` → write `order` attribute → render
- **UI:** input → `ui.ts` mutates `state` → `onChange()` → `applyState(material)`
- **Debug keys:** `keydown` `0`–`5` sets `u_debug_mode` directly (not in `state`)
- **Camera:** OrbitControls on the canvas after it is appended; damping is enabled but never updated

## Not on the live path

Unused by `main.ts`: `splatMeshOLD.ts`, `splatMaterial_OLD.ts`, `counter.ts`, `src/data/sample.json`, `public/splats/test.py`.

Imported leftover: `src/style.css` (Vite starter CSS; `body` background is live under the canvas).

## Risks when changing code

- Dual GPU upload (instance attrs + textures). Sorting/LOD must pick one source of truth.
- Activation split: scale `exp` is GPU-only; opacity sigmoid is CPU-only. Do not add a second opacity sigmoid in the shader.
- `u_opacity_multiplier` is a temporary UI gain (`state.opacity` → uniform). It will be reimplemented; do not build new opacity-control design around this uniform.
- Quaternion layout is xyzw after load. Changing either side without the other breaks rotation.
- Color texture alpha duplicates opacity; a separate `RedFormat` opacity texture is what the shader samples.
- `u_size_multiplier` scales the live footprint (eigenvector basis). `state.splatSize` defaults to `1.0`.
- `opacity` attribute is item size 1 but declared `vec4` in the vertex shader.
- `createDataTextureSet` is `async` but has no async work.
- Sorting runs every frame (comparison sort) and rewrites the `order` attribute; the sorter must stay pure (no THREE/geometry/renderer). Assumes the mesh transform is identity — if the mesh gets a transform, pass `mesh.modelViewMatrix.elements` instead of the view matrix.
- Additive vs normal blending look very different. Material default is additive; UI state default is normal (first `applyState` wins).
- Instanced mesh `frustumCulled` uses the 2×2 quad bounds, not the splat cloud.
- README format notes (PlayCanvas / Inria v2) are not implemented; do not assume the loader is format-generic.
- Header parser is not scoped to `element vertex`; extra `property` lines from other elements would be included.

## Before modifying

Follow `.cursor/rules/guidelines.mdc`. If a change conflicts with this layering, explain the conflict before editing.
