import * as THREE from "three";

export function createSplatMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,

    uniforms: {
        u_size_multiplier: { value: 1.0 },
        u_opacity_multiplier: { value: 1.0 },
        u_debug_mode: { value: 0.0 },
        u_viewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },

    vertexShader: `
//attribute vec3 position;  //instanced plane local point poisitions - provided by 3

// --- Per Instance Attributes ---
attribute vec3 splatPosition;// The actual 3D world center of each Gaussian splat
attribute vec3 scale;        // Raw log-space scale vectors
attribute vec4 rotation;     // Unconstrained quaternions (w, x, y, z)
attribute vec4 opacity;      // Unconstrained alpha value (pre-sigmoid)
//attribute vec3 color;        // Splat color

// --- Uniforms ---
// uniform mat4 modelViewMatrix;  already provided
// uniform mat4 projectionMatrix;
uniform vec2 u_viewport;    // Canvas resolution: vec2(window.innerWidth, window.innerHeight)
uniform float u_size_multiplier;         // Global size multiplier for all splats
uniform float u_opacity_multiplier;      // Global opacity multiplier for all splats
uniform int u_debug_mode;    // Debug mode toggle (0.0 = normal, 1.0 = show scales, etc.)

// --- OUTPUTS TO FRAGMENT SHADER ---
varying vec2 v_pixel_offset;
varying float v_opacity;
varying vec3 v_color;
varying vec3 v_conic;        // Holds the upper-triangle of the inverse 2D covariance
varying vec3 v_scale; //only needed to debug (could be moved to vert - but th4en debug would be set in multiple locations)
varying vec3 v_rot_debug;

void main() {
    // 1. ACTIVATION FUNCTIONS
    vec3 world_scale = exp(scale);
    float alpha = 1.0 / (1.0 + exp(-opacity.x));
    vec4 q = normalize(rotation);
    
    v_opacity = alpha * u_opacity_multiplier;
    v_color = color;
    v_scale = world_scale;

    // 2. CONSTRUCT 3D ROTATION MATRIX (R) FROM QUATERNION
    mat3 R = mat3(
        1.0 - 2.0 * (q.y*q.y + q.z*q.z), 2.0 * (q.x*q.y - q.w*q.z), 2.0 * (q.x*q.z + q.w*q.y),
        2.0 * (q.x*q.y + q.w*q.z), 1.0 - 2.0 * (q.x*q.x + q.z*q.z), 2.0 * (q.y*q.z - q.w*q.x),
        2.0 * (q.x*q.z - q.w*q.y), 2.0 * (q.y*q.z + q.w*q.x), 1.0 - 2.0 * (q.x*q.x + q.y*q.y)
    );

    // 3. CONSTRUCT 3D COVARIANCE MATRIX: Sigma3D = R * S * S^T * R^T
    mat3 S = mat3(
        world_scale.x * world_scale.x, 0.0, 0.0,
        0.0, world_scale.y * world_scale.y, 0.0,
        0.0, 0.0, world_scale.z * world_scale.z
    );
    mat3 Sigma3D = R * S * transpose(R);

    // 4. TRANSFORM SPLAT CENTER TO CAMERA VIEW SPACE (Uses splatPosition instead of position)
    vec4 cam_pos = modelViewMatrix * vec4(splatPosition, 1.0);

    // Early discard check if the splat is entirely behind the camera lens
    if (cam_pos.z >= 0.0) {
        gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    // 5. EXTRACT FOCAL LENGTH FROM THE THREE.JS PROJECTION MATRIX
    float fx = projectionMatrix[0][0];
    float fy = projectionMatrix[1][1];

    // Convert normalized focal values to actual screen pixel dimensions
    float focal_x = fx * u_viewport.x * 0.5;
    float focal_y = fy * u_viewport.y * 0.5;

    // 6. BUILD JACOBIAN (J) & TOTAL TRANSFORM MATRIX (T = J * W)
    mat3 J = mat3(
        focal_x / cam_pos.z, 0.0, -(focal_x * cam_pos.x) / (cam_pos.z * cam_pos.z),
        0.0, focal_y / cam_pos.z, -(focal_y * cam_pos.y) / (cam_pos.z * cam_pos.z),
        0.0, 0.0, 0.0
    );
    mat3 W = mat3(modelViewMatrix);
    mat3 T = J * W;

    // 7. COMPUTE 2D SCREEN SPACE COVARIANCE: Sigma2D = T * Sigma3D * T^T
    mat3 Sigma2D = T * Sigma3D * transpose(T);

    // 8. ANTI-ALIASING LOW-PASS FILTER (Add 0.3 pixel variance to the diagonal)
    float a = Sigma2D[0][0] + 0.3;
    float b = Sigma2D[0][1];
    float c = Sigma2D[1][1] + 0.3;

    // 9. INVERT THE 2x2 MATRIX (Calculate the Conic values)
    float det = a * c - b * b;
    if (det == 0.0) {
        gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }
    float inv_det = 1.0 / det;
    
    // v_conic stores the unique elements of the inverse matrix: [a_inv, b_inv, c_inv]
    v_conic = vec3(c * inv_det, -b * inv_det, a * inv_det);

    // 10. DETERMINE THE 2D BOUNDING FOOTPRINT FOR THE SCREEN QUAD
    // Using eigenvalues/determinants to find standard deviation radius in pixels
    float mid = 0.5 * (a + c);
    float term = sqrt(max(0.1, mid * mid - det));
    float lambda1 = mid + term;
    float lambda2 = mid - term;
    float max_radius = ceil(3.0 * sqrt(max(lambda1, lambda2))); // 3 standard deviations

    // 11. GENERATE SCREEN PROJECTED VERTEX POSITION
    vec4 projected_center = projectionMatrix * cam_pos;
    vec2 screen_center = (projected_center.xy / projected_center.w);

    // Map base PlaneGeometry coordinates ([-0.5, -0.5] to [0.5, 0.5]) to bounding box space ([-3.0stdev, 3.0stdev])
    // Multiplied by 2.0 because PlaneGeometry width and height is 1.0 (0.5 - (-0.5) = 1.0)
    vec2 quad_offset = position.xy * 2.0 * 0.01 * u_size_multiplier; 

    // Compute dynamic pixel offset and transform to Normalized Device Coordinates (NDC)
    vec2 pixel_offset = quad_offset * max_radius;
    vec2 ndc_offset = (pixel_offset / u_viewport) * 2.0;

    // Pass the exact sub-pixel offset to the fragment shader for evaluation
    v_pixel_offset = pixel_offset;

    // Output final clip space positions matching the expanded quad bounds
    gl_Position = vec4((screen_center + ndc_offset) * projected_center.w, projected_center.z, projected_center.w);
}
    `,

    fragmentShader: `

uniform vec2 u_viewport;    // Canvas resolution: vec2(window.innerWidth, window.innerHeight)
uniform float u_size_multiplier;         // Global size multiplier for all splats
uniform float u_opacity_multiplier;      // Global opacity multiplier for all splats
uniform int u_debug_mode;    // Debug mode toggle (0.0 = normal, 1.0 = show scales, etc.)

// --- INPUTS PASSED FROM THE VERTEX SHADER ---
varying vec2 v_pixel_offset; // Local pixel coordinates relative to splat center
varying float v_opacity;     // Activated global opacity (0.0 to 1.0)
varying vec3 v_color;        // Splat RGB values
varying vec3 v_conic;        // Symmetrical inverse 2D covariance components
varying vec3 v_scale;        // Only used for debugging purposes
varying vec3 v_rot_debug;

void main() {
    // 1. EXTRACT INVERSE COVARIANCE PARAMETERS
    float a = v_conic.x;
    float b = v_conic.y;
    float c = v_conic.z;

    // 2. EVALUATE THE MULTIVARIATE GAUSSIAN EXPONENT
    // Formula: -0.5 * (a*x^2 + 2*b*x*y + c*y^2)
    float power = -0.5 * (a * v_pixel_offset.x * v_pixel_offset.x 
                        + 2.0 * b * v_pixel_offset.x * v_pixel_offset.y 
                        + c * v_pixel_offset.y * v_pixel_offset.y);

    // 3. ALPHA OUTSIDE EVALUATION AREA
    // Optimization: Reject pixels where influence decays past 3 standard deviations
    if (power > 0.0) {
        discard;
    }

    // 4. COMBINE OPACITIES
    float alpha = v_opacity * exp(power);

    if (u_debug_mode == 1) {
        gl_FragColor = vec4(v_color, 1.0);
        return;
    } 
    if (u_debug_mode == 2) {
        //vec3 s = normalize(v_scale); 
        // BETTER SCALE DEBUG would allow toggle between normalized and not and seperate scale to color multiplier.
        // possibly seperate modes
        vec3 s = clamp(v_scale * 220.0, 0.0, 1.0);
        gl_FragColor = vec4(s, 1.0);
        return;
    }
    if (u_debug_mode == 3) {
        gl_FragColor = vec4(v_rot_debug, 1.0);
        return;
      } 
    if (u_debug_mode == 4) {
        float r = clamp(1.04, 0.0, 1.0);
        gl_FragColor = vec4(step(r, 0.000000), 0.0, 0.0, 1.0);
        return;
      }
    if (u_debug_mode == 5) {
        gl_FragColor = vec4(vec3(v_opacity), 1.0);
        return;
    }

    // Final visibility floor thresholding
    if (alpha < (1.0 / 255.0)) {
        discard;
    }

    // 5. OUTPUT RENDER TARGET COLOUR
    gl_FragColor = vec4(v_color * alpha, alpha); // Premultiplied Alpha output
}
    `,
  });
}