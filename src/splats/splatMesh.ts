import * as THREE from "three";
import { createSplatMaterial } from "./splatMaterial_OLD";

export function createSplatMesh(data: any, material: THREE.ShaderMaterial) {

  // 1. Initialize an empty InstancedBufferGeometry
  const geometry = new THREE.InstancedBufferGeometry();

  // 2. Load the base 1x1 quad geometry
  const perInstanceGeo = new THREE.PlaneGeometry(1, 1);
  
  // 3. Copy the base quad's standard attributes (index, position, uv) 
  geometry.index = perInstanceGeo.index;
  geometry.setAttribute("position", perInstanceGeo.attributes.position);
  geometry.setAttribute("uv", perInstanceGeo.attributes.uv);

  // 4. Attach your custom point cloud data as InstancedBufferAttributes
  // The '3', '4', or '1' matches your existing item sizes
  geometry.setAttribute(
    "splatPosition",
    new THREE.InstancedBufferAttribute(new Float32Array(data.positions), 3)
  );

  geometry.setAttribute(
    "color",
    new THREE.InstancedBufferAttribute(new Float32Array(data.colors), 3)
  );

  geometry.setAttribute(
    "scale",
    new THREE.InstancedBufferAttribute(new Float32Array(data.scales), 3)
  );

  geometry.setAttribute(
    "rotation",
    new THREE.InstancedBufferAttribute(new Float32Array(data.rotations), 4)
  );
  
  geometry.setAttribute(
    "opacity",
    new THREE.InstancedBufferAttribute(new Float32Array(data.opacities), 1)
  );

  // 5. Use THREE.Mesh instead of THREE.Points
  const mesh = new THREE.Mesh(geometry, material);

  return mesh;
  
}