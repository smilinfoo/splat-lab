import * as THREE from "three";

export function createSplatMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.NormalBlending,

    vertexShader: `
      varying vec3 vColor;

      void main() {
        vColor = color;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        gl_PointSize = 60.0 / -mvPosition.z;
      }
    `,

    fragmentShader: `
      varying vec3 vColor;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);

        float alpha = smoothstep(0.5, 0.0, dist);

        if (alpha < 0.01) discard;

        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });
}