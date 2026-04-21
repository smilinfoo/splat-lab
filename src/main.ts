import './style.css'
import { createRenderer } from "./core/renderer";
import { createScene } from "./core/scene";
import { createCamera } from "./core/camera";
import { loadSplats } from "./splats/loader";
import { createSplatMesh } from "./splats/splatMesh";
import { createSplatMaterial } from "./splats/splatMaterial";

import { loadPLY } from "./splats/loader";

import { createUI } from "./ui/ui";
import { state } from "./ui/state";
import { applyState } from "./ui/bindings";

async function init() {

  const renderer = createRenderer();
  document.body.appendChild(renderer.domElement);
  const scene = createScene();
  const camera = createCamera();
  const material = createSplatMaterial();

  // TEMP: load sample data
  //const splatData = await loadSplats("/src/data/sample.json");
  const splatData = await loadPLY("/data/sample.ply");

  const splatMesh = createSplatMesh(splatData, material);
  scene.add(splatMesh);

  const onChange = () => {
    applyState(material);
    material.needsUpdate = true;
  };
  createUI(onChange);
  applyState(material);

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  animate();
  console.log('init!!!')
}

init();



