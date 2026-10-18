import * as THREE from "three";
import type { SplatDataTextureSet } from "./splatDataTextures";

export function createSplatMesh(data: any, material: THREE.ShaderMaterial, dataTextures:SplatDataTextureSet) {

  console.log(`creating splat mesh with ${data.positions.length / 3} instances`);
  console.log(dataTextures);
  // 1. Initialize an empty InstancedBufferGeometry
  const geometry = new THREE.InstancedBufferGeometry();

  // 2. Load the base 1x1 quad geometry
  const perInstanceGeo = new THREE.PlaneGeometry(2, 2, 1, 1);//male vert pos 1,1
  
  // 3. Copy the base quad's standard attributes (index, position, uv) 
  geometry.index = perInstanceGeo.index;
  geometry.setAttribute("position", perInstanceGeo.attributes.position);
  geometry.setAttribute("uv", perInstanceGeo.attributes.uv);
  console.log(`count ${perInstanceGeo.index.length}`);
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

  geometry.setAttribute(
    "order",
    new THREE.InstancedBufferAttribute(new Float32Array(data.order), 1)
  );

  console.log(`data textures!!!`);
  console.log(dataTextures.colors);
  
  material.uniforms.u_data_texture_dimensions.value = new THREE.Vector2(dataTextures.width, dataTextures.height);
  material.uniforms.u_position_texture.value = dataTextures.positions;
  material.uniforms.u_color_texture.value = dataTextures.colors;
  material.uniforms.u_scale_texture.value = dataTextures.scales;
  material.uniforms.u_rotation_texture.value = dataTextures.rotations;
  material.uniforms.u_opacity_texture.value = dataTextures.opacities;
  // Bounding sphere over the whole cloud (default is the 2x2 base quad), padded
  // by the largest splat scale so edge splats are not culled early.
  const box = new THREE.Box3().setFromArray(data.positions);
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  let maxScale = 0;
  for (let i = 0; i < data.scales.length; i++) {
    if (data.scales[i] > maxScale) maxScale = data.scales[i];
  }
  sphere.radius += Math.exp(maxScale); // scales are log-space
  geometry.boundingSphere = sphere;

  // 5. Use THREE.Mesh instead of THREE.Points
  const mesh = new THREE.Mesh(geometry, material);

  return mesh;
  
}