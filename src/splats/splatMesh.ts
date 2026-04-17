import * as THREE from "three";
import { createSplatMaterial } from "./splatMaterial";

export function createSplatMesh(data: any) {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(data.positions, 3)
  );

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(data.colors, 3)
  );

  const material = createSplatMaterial();

  const points = new THREE.Points(geometry, material);

  return points;
}