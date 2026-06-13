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

mat3 quaternionToRotationMatrix(vec4 q) {
    float x2 = q.x * q.x;
    float y2 = q.y * q.y;
    float z2 = q.z * q.z;
    float xy = q.x * q.y;
    float xz = q.x * q.z;
    float yz = q.y * q.z;
    float wx = q.w * q.x;
    float wy = q.w * q.y;
    float wz = q.w * q.z;

    return mat3(
        1.0 - 2.0 * (y2 + z2),       2.0 * (xy - wz),       2.0 * (xz + wy),
              2.0 * (xy + wz), 1.0 - 2.0 * (x2 + z2),       2.0 * (yz - wx),
              2.0 * (xz - wy),       2.0 * (yz + wx), 1.0 - 2.0 * (x2 + y2)
    );
}

void main() {
    // 1. ACTIVATION FUNCTIONS
    vec3 world_scale = exp(scale);
    float alpha = 1.0 / (1.0 + exp(-opacity.x));
    vec4 q = normalize(rotation);
    
    v_opacity = alpha * u_opacity_multiplier;
    v_color = color;
    v_scale = world_scale;

    // 2. CONSTRUCT 3D ROTATION MATRIX (R) FROM QUATERNION
    mat3 R = quaternionToRotationMatrix(q);

    // 3. CONSTRUCT 3D COVARIANCE MATRIX: Sigma3D = R * S * S^T * R^T
    mat3 S = mat3(
        world_scale.x, 0.0, 0.0,
        0.0, world_scale.y, 0.0,
        0.0, 0.0, world_scale.z
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
    vec2 quad_offset = position.xy * 2.0  * u_size_multiplier; 

    // Compute dynamic pixel offset and transform to Normalized Device Coordinates (NDC)
    vec2 pixel_offset = quad_offset * max_radius;
    vec2 ndc_offset = (pixel_offset / u_viewport) * 2.0 * 0.1;

    // Pass the exact sub-pixel offset to the fragment shader for evaluation
    v_pixel_offset = pixel_offset;

    // Output final clip space positions matching the expanded quad bounds
    gl_Position = vec4((screen_center + ndc_offset) * projected_center.w, projected_center.z, projected_center.w);
}