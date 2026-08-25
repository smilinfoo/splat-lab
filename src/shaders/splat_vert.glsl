//attribute vec3 position;  //instanced plane local point poisitions - provided by 3

// --- Per Instance Attributes ---
attribute vec3 splatPosition;// The actual 3D world center of each Gaussian splat
attribute vec3 scale;        // Raw log-space scale vectors
attribute vec4 rotation;     // Unconstrained quaternions (w, x, y, z)
attribute vec4 opacity;      // Unused; live path samples u_opacity_texture (already sigmoid'd)
//attribute vec3 color;        // Splat color
attribute float order;        // Order of the splat in the data texture (used for indexing)

// --- Uniforms ---
// uniform mat4 modelViewMatrix;  already provided
// uniform mat4 projectionMatrix;
uniform vec2 u_viewport;    // Canvas resolution: vec2(window.innerWidth, window.innerHeight)
uniform float u_size_multiplier;         // Global size multiplier for all splats
uniform float u_opacity_multiplier;      // Temporary UI gain; will be reimplemented
uniform vec2 u_data_texture_dimensions; // Dimensions of the data texture (width, height)
uniform sampler2D u_position_texture; // Texture containing splat positions
uniform sampler2D u_color_texture;    // Texture containing splat colors
uniform sampler2D u_scale_texture;
uniform sampler2D u_rotation_texture;
uniform sampler2D u_opacity_texture;
uniform int u_debug_mode;    // Debug mode toggle (0.0 = normal, 1.0 = show scales, etc.)

// --- OUTPUTS TO FRAGMENT SHADER ---
varying float v_opacity;
varying vec3 v_color;
varying vec3 v_scale; //only needed to debug (could be moved to vert - but th4en debug would be set in multiple locations)
varying vec3 v_rot_debug;
varying vec3 v_debug_color;
varying vec3 v_position;

const float sqrt8 = sqrt(8.0);

// Computes upper triangular 3D covariance from quaternion and scale
// Returns vec6(cov_xx, cov_xy, cov_xz, cov_yy, cov_yz, cov_zz)
mat3 computeCovariance3D(vec4 quat, vec3 scale) {
    // 1. Normalize the quaternion
    vec4 q = normalize(quat);

    // 2. Convert quaternion to 3x3 rotation matrix (Column-Major)
    float x2 = q.x * q.x; float y2 = q.y * q.y; float z2 = q.z * q.z;
    float xy = q.x * q.y; float xz = q.x * q.z; float yz = q.y * q.z;
    float wx = q.w * q.x; float wy = q.w * q.y; float wz = q.w * q.z;

    mat3 R = mat3(
        1.0 - 2.0 * (y2 + z2), 2.0 * (xy - wz),       2.0 * (xz + wy),
        2.0 * (xy + wz),       1.0 - 2.0 * (x2 + z2), 2.0 * (yz - wx),
        2.0 * (xz - wy),       2.0 * (yz + wx),       1.0 - 2.0 * (x2 + y2)
    );

    // 3. Build scale matrix (S)
    mat3 S = mat3(
        scale.x, 0.0,     0.0,
        0.0,     scale.y, 0.0,
        0.0,     0.0,     scale.z
    );

    // 4. Compute M = R * S
    mat3 M = R * S;

    // 5. Compute Sigma = M * M^T (Since M^T is the same as M * M Transposed)
    mat3 Sigma = M * transpose(M);

    return Sigma;
}


mat3 quatToMat3(vec4 q) {
    mat3 m;
    
    float x = q.x;
    float y = q.y;
    float z = q.z;
    float w = q.w;

    float x2 = x * x;
    float y2 = y * y;
    float z2 = z * z;

    float xy = x * y;
    float xz = x * z;
    float yz = y * z;
    
    float wx = w * x;
    float wy = w * y;
    float wz = w * z;

    // First column
    m[0][0] = 1.0 - 2.0 * (y2 + z2);
    m[0][1] = 2.0 * (xy + wz);
    m[0][2] = 2.0 * (xz - wy);

    // Second column
    m[1][0] = 2.0 * (xy - wz);
    m[1][1] = 1.0 - 2.0 * (x2 + z2);
    m[1][2] = 2.0 * (yz + wx);

    // Third column
    m[2][0] = 2.0 * (xz + wy);
    m[2][1] = 2.0 * (yz - wx);
    m[2][2] = 1.0 - 2.0 * (x2 + y2);

    return m;
}

void main() {

    // RAW DATA EXTRACTION FROM TEXTURE
    float index = order;
    float x = mod(float(index), u_data_texture_dimensions.x);
    float y = floor(float(index) / u_data_texture_dimensions.x);
    vec2 data_texture_uv = vec2(x,y) + vec2(0.5, 0.5);
    data_texture_uv /= u_data_texture_dimensions;
    vec3 posFromText = texture2D(u_position_texture, data_texture_uv).rgb;
    vec4 colorFromText = texture2D(u_color_texture, data_texture_uv);
    vec3 scaleFromText = texture2D(u_scale_texture, data_texture_uv).rgb;
    vec4 rotationFromText = texture2D(u_rotation_texture, data_texture_uv);    
    float opacityFromText = texture2D(u_opacity_texture, data_texture_uv).r;
    vec3 pos3Fromtext = posFromText.xyz;



    // 1. ACTIVATION FUNCTIONS
    vec3 world_scale = exp(scaleFromText);
    float alpha = opacityFromText; // already sigmoid'd in the loader
    vec4 q = normalize(rotationFromText);
    
    


    
    v_opacity = alpha * u_opacity_multiplier;
    v_color = color;
    v_color.r = 1.0;
    v_scale = world_scale;
    v_color= colorFromText.rgb;
    float test = u_data_texture_dimensions.x;
    float need = 1116.0;
    // v_color.r = posFromText.x;//step(floor(test), need);
    // v_color.g = posFromText.y;//step(need, floor(test));
    // v_color.b = 0.0;//max(0.0, posFromText.z);
    //v_color.b = posFromText.z;
    // v_color.g = posFromText.y;
    // v_color.b = posFromText.z;

    // 2. CONSTRUCT 3D ROTATION MATRIX (R) FROM QUATERNION
    //mat3 R = quaternionToRotationMatrix(q);
    mat3 R = quatToMat3(q);

    // 3. CONSTRUCT 3D COVARIANCE MATRIX: Sigma3D = R * S * S^T * R^T
    // squareing so S * S^T ahead
    mat3 S = mat3(
        world_scale.x * world_scale.x, 0.0, 0.0,
        0.0, world_scale.y * world_scale.y, 0.0,
        0.0, 0.0, world_scale.z * world_scale.z
    );
    mat3 Sigma3D = R * S * transpose(R);
    //Sigma3D = computeCovariance3D(q, scale);
    
    // 4. TRANSFORM SPLAT CENTER TO CAMERA VIEW SPACE (Uses splatPosition instead of position)
    vec4 cam_pos = modelViewMatrix * vec4(pos3Fromtext, 1.0);

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

    // 6. BUILD JACOBIAN (J) AND VIEW ROTATION (W)
    // NOTE: mat3(...) is column-major, so the shear terms below land in the third
    // ROW. This makes the `J` variable hold the transpose of the textbook Jacobian
    // (which has shear in the third column). W is the transpose of the world->camera
    // rotation. Both transposes are intentional; step 7 undoes them.
    mat3 J = mat3(
        focal_x / cam_pos.z, 0.0, -(focal_x * cam_pos.x) / (cam_pos.z * cam_pos.z),
        0.0, focal_y / cam_pos.z, -(focal_y * cam_pos.y) / (cam_pos.z * cam_pos.z),
        0.0, 0.0, 0.0
    );
    mat3 W = transpose(mat3(modelViewMatrix));
    mat3 T = W * J;

    // 7. COMPUTE 2D SCREEN SPACE COVARIANCE.
    // transpose(T) * Sigma3D * T expands to J_textbook * R * Sigma3D * R^T * J_textbook^T,
    // i.e. the correct EWA projection. Do NOT "simplify" to J * ... * transpose(J):
    // that would use the wrong (transposed) Jacobian because of the column-major build above.
    mat3 Sigma2D = transpose(T) * Sigma3D * T;

    // 8. PROJECTED SPLAT CENTER IN NDC
    vec4 projected_center = projectionMatrix * cam_pos;
    vec3 screen_center = projected_center.xyz / projected_center.w;

    // 9. EIGEN-DECOMPOSE THE 2D COVARIANCE -> screen-space ellipse axes
    float a = Sigma2D[0][0];
    float b = Sigma2D[0][1];
    float d = Sigma2D[1][1];
    float D = a * d - b * b;
    float traceOver2 = 0.5 * (a + d);
    float term = sqrt(max(0.1, traceOver2 * traceOver2 - D));
    float eigenValue1 = traceOver2 + term;
    float eigenValue2 = traceOver2 - term;

    // Degenerate / non-positive-definite covariance: cull instead of leaving
    // gl_Position unwritten (matches the behind-camera cull above).
    if (eigenValue2 <= 0.0) {
        gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }
    vec2 eigenVector1 = normalize(vec2(b, eigenValue1 - a));
    vec2 eigenVector2 = vec2(eigenVector1.y, -eigenVector1.x);

    // 10. BUILD THE SCREEN QUAD FROM THE ELLIPSE AXES
    // basisVector = axis * sqrt(8 * eigenvalue) reaches ~3 std devs. The fragment
    // evaluates exp(-0.5 * |position * sqrt8|^2), so the sqrt8 factors cancel and
    // the footprint stays a correct Gaussian. u_size_multiplier scales the splat.
    vec2 basisViewport = vec2(1.0 / u_viewport.x, 1.0 / u_viewport.y);
    vec2 basisVector1 = eigenVector1 * u_size_multiplier * min(sqrt8 * sqrt(eigenValue1), 1024.0);
    vec2 basisVector2 = eigenVector2 * u_size_multiplier * min(sqrt8 * sqrt(eigenValue2), 1024.0);
    vec2 ndcOffset = (position.x * basisVector1 + position.y * basisVector2) * basisViewport;

    gl_Position = vec4(screen_center.xy + ndcOffset, screen_center.z, 1.0);

    v_position = position * sqrt8;
}