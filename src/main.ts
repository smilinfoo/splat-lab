import './style.css'
import { createRenderer } from "./core/renderer";
import { createScene } from "./core/scene";
import { createCamera } from "./core/camera";
import { createSplatMesh } from "./splats/splatMesh";
import { createSplatMaterial } from "./splats/splatMaterial";

import { loadBinaryPly } from "./splats/loader";

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



  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.scales.length; i++) {
    const v = data.scales[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  console.log("scale range:", min, max);



  const splatMesh = createSplatMesh(data, material);
  scene.add(splatMesh);

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
    renderer.render(scene, camera);
  }

  animate();
  console.log('init!!!')
}

init();



