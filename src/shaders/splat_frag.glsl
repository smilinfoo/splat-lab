uniform vec2 u_viewport;    // Canvas resolution: vec2(window.innerWidth, window.innerHeight)
uniform float u_size_multiplier;         // Global size multiplier for all splats
uniform float u_opacity_multiplier;      // Temporary UI gain; will be reimplemented
uniform int u_debug_mode;    // Debug mode toggle (0.0 = normal, 1.0 = show scales, etc.)

// --- INPUTS PASSED FROM THE VERTEX SHADER ---
varying float v_opacity;     // Activated global opacity (0.0 to 1.0)
varying vec3 v_color;        // Splat RGB values
varying vec3 v_scale;        // Only used for debugging purposes
varying vec3 v_rot_debug;
varying vec3 v_debug_color;
varying vec3 v_position;

void main() {
    // Gaussian falloff in quad-local space. v_position = quad position * sqrt8,
    // matching the sqrt(8 * eigenvalue) basis that sizes the quad in the vertex
    // shader, so this is a correct elliptical Gaussian in screen space.
    float A = dot(v_position, v_position);
    if (A > 8.0) discard; // clip to ~3 std devs (inscribed disc of the quad)

    vec3 outColor = v_color;
    outColor = step(0.0, outColor);
    if (u_debug_mode == 1) {
        gl_FragColor = vec4(outColor, 1.0);
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
    // if (alpha < (1.0 / 255.0)) {
    //     discard;
    // }

    float opacity = exp(-0.5 * A) * v_opacity;

    // 5. OUTPUT: premultiplied alpha.
    // Material sets premultipliedAlpha: true, so Normal blend = correct "over"
    // and Additive blend = straight add. Both need color already scaled by alpha.
    gl_FragColor = vec4(v_color.rgb * opacity, opacity);
}