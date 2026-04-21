import * as THREE from "three";

export function createSplatMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,

    uniforms: {
      uSize: { value: 1.0 },
      uOpacity: { value: 1.0 },
    },

    vertexShader: `
      attribute float scale;
      attribute float opacity;

      varying vec3 vColor;
      varying float vOpacity;

      uniform float uSize;

      void main() {
        vColor = color;
        vOpacity = opacity;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // screen-space splat size
        gl_PointSize = scale * uSize * 500.0 / -mvPosition.z;
      }
    `,

    fragmentShader: `
      precision mediump float;

      varying vec3 vColor;
      varying float vOpacity;

      uniform float uOpacity;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);

        // soft circular gaussian-like falloff
        float falloff = smoothstep(0.5, 0.0, dist);

        float alpha = falloff * vOpacity * uOpacity;

        if (alpha < 0.01) discard;

        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });
}