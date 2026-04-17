import './style.css'
//import typescriptLogo from './assets/typescript.svg'
//import viteLogo from './assets/vite.svg'
//import heroImg from './assets/hero.png'
//import { setupCounter } from './counter.ts'


import { createRenderer } from "./core/renderer";
import { createScene } from "./core/scene";
import { createCamera } from "./core/camera";
import { loadSplats } from "./splats/loader";
import { createSplatMesh } from "./splats/splatMesh";

async function init() {
  const renderer = createRenderer();
  const scene = createScene();
  const camera = createCamera();

  document.body.appendChild(renderer.domElement);

  // TEMP: load sample data
  const splatData = await loadSplats("/src/data/sample.json");

  const splatMesh = createSplatMesh(splatData);
  scene.add(splatMesh);

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  animate();
  console.log('init!!!')
}

init();



