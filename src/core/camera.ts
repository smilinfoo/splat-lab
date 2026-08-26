import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 3);

  const renderer = document.querySelector("canvas");
  const controls = new OrbitControls(camera, renderer);
  controls.enableDamping = true;

  return camera;
}