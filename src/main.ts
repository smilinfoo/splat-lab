import './style.css'
import { createRenderer } from "./core/renderer";
import { createScene } from "./core/scene";
import { createCamera } from "./core/camera";
import { createSplatMesh } from "./splats/splatMesh";
import { createSplatMaterial } from "./splats/splatMaterial";

import { loadBinaryPly } from "./splats/loader";
import { createDataTextureSet, type SplatDataTextureSet } from "./splats/splatDataTextures";
import { createSplatSorter } from "./splats/splatSorter";
import * as THREE from "three";

import { createUI } from "./ui/ui";
import { applyState } from "./ui/bindings";

async function init() {

  // component setup
  const renderer = createRenderer();
  document.body.appendChild(renderer.domElement);
  const scene = createScene();
  const { camera, controls } = createCamera();
  const material = createSplatMaterial();

  // TEMP: load sample data
  const data = await loadBinaryPly("/splats/point_cloud.ply");
  const dataTextures:SplatDataTextureSet  = await createDataTextureSet(data);

  const splatMesh = createSplatMesh(data, material, dataTextures);
  // Hard-coded splat offset transform within the scene.
  splatMesh.position.set(0, 0, -0);
  splatMesh.rotation.set(2.3, 0, 0);
  scene.add(splatMesh);
  // Orbit around the splat, not the world origin.
  controls.target.copy(splatMesh.position);
  controls.update();
  const modelView = new THREE.Matrix4(); // reused each frame

  // Depth sorting: the sorter owns positions + draw order; main owns the buffer.
  const orderAttr = splatMesh.geometry.getAttribute("order");
  const sorter = createSplatSorter(
    Float32Array.from(data.positions),
    Uint32Array.from(data.order),
  );

  const onChange = () => {
    applyState(material);
    material.needsUpdate = true;
  };
  createUI(onChange);
  applyState(material);

  function animate() {
    requestAnimationFrame(animate);

    // 1. Make the model-view matrix current, 2. set transform, 3. sort,
    // 4. update the index buffer. The sorter never touches the buffer or renderer.
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    splatMesh.updateMatrixWorld();
    modelView.multiplyMatrices(camera.matrixWorldInverse, splatMesh.matrixWorld);
    sorter.setTransform(modelView.elements);
    const sorted = sorter.sort();
    (orderAttr.array as Float32Array).set(sorted);
    orderAttr.needsUpdate = true;

    renderer.render(scene, camera);
  }

  animate();

}

init();


