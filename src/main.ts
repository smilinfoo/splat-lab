import './style.css'
import { createRenderer } from "./core/renderer";
import { createScene } from "./core/scene";
import { createCamera } from "./core/camera";
import { createSplatMesh } from "./splats/splatMesh";
import { createSplatMaterial } from "./splats/splatMaterial";

import { loadBinaryPly } from "./splats/loader";
import { createDataTextureSet, type SplatDataTextureSet } from "./splats/splatDataTextures";
import { createSplatSorter } from "./splats/splatSorter";

import { createUI } from "./ui/ui";
import { applyState } from "./ui/bindings";

async function init() {

  const renderer = createRenderer();
  document.body.appendChild(renderer.domElement);
  const scene = createScene();
  const camera = createCamera();
  const material = createSplatMaterial();

  // TEMP: load sample data
  const data = await loadBinaryPly("/splats/point_cloud.ply");
  console.log("scale sample:", data.scales.slice(0, 20));
  const dataTextures:SplatDataTextureSet  = await createDataTextureSet(data);

  console.log("data texture size:", dataTextures.width, dataTextures.height);
  console.log("data texture count:", dataTextures.count);
  console.log(`color in MAIN`);
  console.log(dataTextures.colors)

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.scales.length; i++) {
    const v = data.scales[i];
    if (v < min) min = v;
    if (v > max) max = v;
  } //move to loader
  console.log("scale range:", min, max);

  const splatMesh = createSplatMesh(data, material, dataTextures);
  scene.add(splatMesh);

  // Depth sorting: the sorter owns positions + draw order; main owns the buffer.
  const orderAttr = splatMesh.geometry.getAttribute("order");
  const sorter = createSplatSorter(
    Float32Array.from(data.positions),
    Uint32Array.from(data.order),
  );

  window.addEventListener("keydown", (e) => {
    if (e.key >= "0" && e.key <= "5") {
      material.uniforms.u_debug_mode.value = Number(e.key);
    }
  });

  const onChange = () => {
    applyState(material);
    material.needsUpdate = true;
  };
  createUI(onChange);
  applyState(material);

  function animate() {
    requestAnimationFrame(animate);

    // 1. Make the view matrix current, 2. set transform, 3. sort,
    // 4. update the index buffer. The sorter never touches the buffer or renderer.
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    sorter.setTransform(camera.matrixWorldInverse.elements);
    const sorted = sorter.sort();
    (orderAttr.array as Float32Array).set(sorted);
    orderAttr.needsUpdate = true;

    renderer.render(scene, camera);
  }

  animate();
  console.log('init!!!')
}

init();


