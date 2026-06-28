import * as THREE from "three";

import vertShaderText from "../shaders/splat_vert.glsl?raw";
import fragShaderText from "../shaders/splat_frag.glsl?raw";

export function createSplatMaterial() {
    console.log('VIEW PORT SIZE', window.innerWidth, window.innerHeight);
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    
    uniforms: {
        u_size_multiplier: { value: 1.0 },
        u_opacity_multiplier: { value: 1.0 },
        u_debug_mode: { value: 0.0 },
        u_viewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },

    vertexShader: vertShaderText,

    fragmentShader: fragShaderText,
  });
}