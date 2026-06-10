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
      uDebugMode: { value: 0.0 }
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
      varying vec3 vRotDebug;
      varying float vRadius;

      varying vec3 vScaleDebug;

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

        vec3 logScale = exp(scale);
        
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
        //mat3 viewRot = mat3(viewMatrix);
        mat3 viewRot = transpose(mat3(viewMatrix));
        cov3D = viewRot * cov3D * transpose(viewRot); 
        // Approximate projection Jacobian
        float z = -mvPosition.z;
        float x = mvPosition.x;
        float y = mvPosition.y;
        float f = 500.0 / z;
        float fx = projectionMatrix[0][0];
        float fy = projectionMatrix[1][1];
        mat2 J = mat2(
            fx / z, 0.0,
            0.0, fy / z
        );

        // Drop z axis for projected covariance
        mat2 cov2D = mat2(
            cov3D[0][0], cov3D[0][1],
            cov3D[1][0], cov3D[1][1]
        );

        //cov2D = J * cov2D * transpose(J);
        cov2D *= uSize * uSize;

        // Invert
        float det = cov2D[0][0] * cov2D[1][1]
                  - cov2D[0][1] * cov2D[1][0];
        det = max(det, 1e-8);

        mat2 invCov = mat2(
            cov2D[1][1], -cov2D[0][1],
            -cov2D[1][0],  cov2D[0][0]
        ) / det;
        invCov = inverse(cov2D);
        vInvCov = vec3(
            invCov[0][0],
            invCov[0][1],
            invCov[1][1]
        );

        //debug
        vec3 axis = R * vec3(0.0, 0.0, 1.0);
        //vec3 axis = transpose(R) * vec3(1,0,0);
        vRotDebug = axis * 0.5 + 0.5;

        // Bounding box
        float radius = sqrt(max(cov2D[0][0], cov2D[1][1]));
        float pointSize = radius * 16.0;
        pointSize = max(vScale.x, max(vScale.y, vScale.z));;
        gl_PointSize = pointSize * 16.0 * uSize;
        vPointSize = pointSize;
        vScaleDebug = scale;
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
    varying vec3 vRotDebug;
    varying float vRadius;
    varying vec3 vScaleDebug;

    uniform float uOpacity;
    uniform int uDebugMode;

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

      vec3 testColor = vec3(gl_PointCoord.x, gl_PointCoord.y, 1.0);


      if (uDebugMode == 1) {
        gl_FragColor = vec4(vColor, 1.0);
        return;
      } 
      if (uDebugMode == 2) {
        //vec3 s = normalize(vScale); 
        // BETTER SCALE DEBUG would allow toggle between normalized and not and seperate scale to color multiplier.
        // possibly seperate modes
        vec3 s = clamp(vScale * 220.0, 0.0, 1.0);
        gl_FragColor = vec4(s, 1.0);
        return;
      }
      if (uDebugMode == 3) {
          gl_FragColor = vec4(vRotDebug, 1.0);
          return;
      } 
      if (uDebugMode == 4) {
          float r = clamp(1.04, 0.0, 1.0);
          gl_FragColor = vec4(step(r, 0.000000), 0.0, 0.0, 1.0);
          return;
      }
      if (uDebugMode == 5) {
          gl_FragColor = vec4(vec3(vOpacity), 1.0);
          return;
      }

      //if (alpha < 0.01) discard;
      //gl_FragColor = vec4(vColor,alpha); 
      vec3 col = vScaleDebug;
      gl_FragColor = vec4(col, 1.0); 
    }
    `,
  });
}