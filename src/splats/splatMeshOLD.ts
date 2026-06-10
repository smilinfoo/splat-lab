import * as THREE from "three";
import { createSplatMaterial } from "./splatMaterial_OLD";

export function createSplatMesh(data: any, material: THREE.ShaderMaterial) {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(data.positions, 3)
  );

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(data.colors, 3)
  );

  geometry.setAttribute(
    "scale",
    new THREE.Float32BufferAttribute(data.scales, 3)
  );

  geometry.setAttribute(
    "rotation",
    new THREE.Float32BufferAttribute(data.rotations, 4)
  );
  
  geometry.setAttribute(
    "opacity",
    new THREE.Float32BufferAttribute(data.opacities, 1)
  );

  const points = new THREE.Points(geometry, material);

  return points;
}