import * as THREE from "three";
import { state } from "./state";

export function applyState(material: THREE.ShaderMaterial) {
    console.log(state);
    material.uniforms.uOpacity.value = state.opacity;
    material.uniforms.uSize.value = state.splatSize;

    material.blending = state.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
//   material.uniforms = material.uniforms || {};

//   // We’ll use material.uniforms as a lightweight bridge
//   material.onBeforeCompile = (shader) => {
//     shader.uniforms.uSize = { value: state.splatSize };
//     shader.uniforms.uOpacity = { value: state.opacity };

//     shader.vertexShader = shader.vertexShader.replace(
//       "#include <common>",
//       `
//       #include <common>
//       uniform float uSize;
//       `
//     );

//     shader.vertexShader = shader.vertexShader.replace(
//       "gl_PointSize = scale * 200.0 / -mvPosition.z;",
//       "gl_PointSize = scale * uSize * 200.0 / -mvPosition.z;"
//     );

//     shader.fragmentShader = shader.fragmentShader.replace(
//       "#include <common>",
//       `
//       #include <common>
//       uniform float uOpacity;
//       `
//     );

//     shader.fragmentShader = shader.fragmentShader.replace(
//       "gl_FragColor = vec4(vColor, alpha);",
//       "gl_FragColor = vec4(vColor, alpha * uOpacity);"
//     );
//   };
}