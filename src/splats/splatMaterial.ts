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
      attribute vec3 scale;
      attribute vec4 rotation;
      attribute float opacity;

      varying vec3 vColor;
      varying float vOpacity;
      varying vec3 vScale;
      varying vec4 vRotation;
      varying vec3 vViewPos;
      varying vec3 vInvCov;
      varying float vPointSize;

      uniform float uSize;

      mat3 quatToMat3(vec4 q) {
          float x = q.x;
          float y = q.y;
          float z = q.z;
          float w = q.w;

          return mat3(
              1.0 - 2.0*y*y - 2.0*z*z,
              2.0*x*y - 2.0*z*w,
              2.0*x*z + 2.0*y*w,

              2.0*x*y + 2.0*z*w,
              1.0 - 2.0*x*x - 2.0*z*z,
              2.0*y*z - 2.0*x*w,

              2.0*x*z - 2.0*y*w,
              2.0*y*z + 2.0*x*w,
              1.0 - 2.0*x*x - 2.0*y*y
          );
      }

      void main() {
        vColor = color;
        vOpacity = opacity;
        vScale = scale;
        vRotation = rotation;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mvPosition.xyz;

        // local covariance
        mat3 R = quatToMat3(rotation);
        mat3 S = mat3(
            scale.x * scale.x, 0.0, 0.0,
            0.0, scale.y * scale.y, 0.0,
            0.0, 0.0, scale.z * scale.z
        );
        mat3 cov3D = R * S * transpose(R);
        // Approximate projection Jacobian
        float z = -mvPosition.z;
        float f = 50.0 / z;
        mat2 J = mat2(
            f, 0.0,
            0.0, f
        );

        // Drop z axis for projected covariance
        mat2 cov2D = mat2(
            cov3D[0][0], cov3D[0][1],
            cov3D[1][0], cov3D[1][1]
        );

        cov2D = J * cov2D * transpose(J);

        // Invert
        float det = cov2D[0][0] * cov2D[1][1]
                  - cov2D[0][1] * cov2D[1][0];
        det = max(det, 1e-8);

        mat2 invCov = mat2(
            cov2D[1][1], -cov2D[0][1],
            -cov2D[1][0],  cov2D[0][0]
        ) / det;

        vInvCov = vec3(
            invCov[0][0],
            invCov[0][1],
            invCov[1][1]
        );

        // Bounding box
        float radius = sqrt(max(scale.x, max(scale.y, scale.z)));
        float sizeMult = 4.0 * uSize; // adjust as needed
        gl_PointSize = radius * f * sizeMult;
        vPointSize = gl_PointSize;
        
        gl_Position = projectionMatrix * mvPosition;
      }
    `,

    fragmentShader: `
    precision mediump float;

    varying vec3 vColor;
    varying float vOpacity;
    varying vec3 vScale;
    varying vec4 vRotation;
    varying vec3 vViewPos;
    varying vec3 vInvCov;
    varying float vPointSize;

    uniform float uOpacity;

    void main() {
      vec2 uv = (gl_PointCoord - vec2(0.5)) * vPointSize;

      mat2 invCov = mat2(
          vInvCov.x, vInvCov.y,
          vInvCov.y, vInvCov.z
      );

      float exponent = dot(uv, invCov * uv);
      //exponent = dot(uv, uv) * 16.0;

      float alpha = exp(-0.5 * exponent);

      alpha *= vOpacity * uOpacity;

      if (alpha < 0.01) discard;
      gl_FragColor = vec4(vColor, alpha);  
    }
    `,
  });
}