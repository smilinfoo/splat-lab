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