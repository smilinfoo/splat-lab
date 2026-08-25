import * as THREE from "three";

import vertShaderText from "../shaders/splat_vert.glsl?raw";
import fragShaderText from "../shaders/splat_frag.glsl?raw";

export function createSplatMaterial() {
    console.log('VIEW PORT SIZE', window.innerWidth, window.innerHeight);
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    
    uniforms: {
        u_size_multiplier: { value: 1.0 },
        u_opacity_multiplier: { value: 1.0 },
        u_debug_mode: { value: 0.0 },
        u_viewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        u_position_texture: { value: null },
        u_color_texture: { value: null },
        u_scale_texture: { value: null },
        u_rotation_texture: { value: null },
        u_opacity_texture: { value: null },
        u_data_texture_dimensions: { value: new THREE.Vector2(1, 1) },
    },

    vertexShader: vertShaderText,

    fragmentShader: fragShaderText,
  });
}