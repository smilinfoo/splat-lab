export async function loadSplats(url: string) {
    const res = await fetch(url);
    return await res.json();
  }

  type SplatData = {
    positions: Float32Array;
    colors: Float32Array;
    scales: Float32Array;
    opacities: Float32Array;
  };
  
  export async function loadPLY(url: string): Promise<SplatData> {
    const res = await fetch(url);
    const text = await res.text();
  
    const lines = text.split("\n");
  
    // --- Parse header
    let vertexCount = 0;
    let headerEnded = false;
    let headerLength = 0;
  
    const properties: string[] = [];
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
  
      if (line.startsWith("element vertex")) {
        vertexCount = parseInt(line.split(" ")[2]);
      }
  
      if (line.startsWith("property")) {
        const parts = line.split(" ");
        properties.push(parts[2]); // property name
      }
  
      if (line === "end_header") {
        headerEnded = true;
        headerLength = i + 1;
        break;
      }
    }
  
    if (!headerEnded) {
      throw new Error("Invalid PLY: no end_header");
    }
  
    // --- Find property indices
    const idx = (name: string) => properties.indexOf(name);
  
    const xIdx = idx("x");
    const yIdx = idx("y");
    const zIdx = idx("z");
  
    const rIdx = idx("red");
    const gIdx = idx("green");
    const bIdx = idx("blue");
  
    const s0Idx = idx("scale_0");
    const s1Idx = idx("scale_1");
  
    const opacityIdx = idx("opacity");
  
    // --- Allocate arrays
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const scales = new Float32Array(vertexCount);
    const opacities = new Float32Array(vertexCount);
  
    // --- Parse data
    for (let i = 0; i < vertexCount; i++) {
      const line = lines[headerLength + i].trim();
      if (!line) continue;
  
      const parts = line.split(/\s+/);
  
      // position
      positions[i * 3 + 0] = parseFloat(parts[xIdx]);
      positions[i * 3 + 1] = parseFloat(parts[yIdx]);
      positions[i * 3 + 2] = parseFloat(parts[zIdx]);
  
      // color (normalize 0–255 → 0–1)
      colors[i * 3 + 0] = rIdx >= 0 ? parseFloat(parts[rIdx]) / 255 : 1;
      colors[i * 3 + 1] = gIdx >= 0 ? parseFloat(parts[gIdx]) / 255 : 1;
      colors[i * 3 + 2] = bIdx >= 0 ? parseFloat(parts[bIdx]) / 255 : 1;
  
      // scale (fallback if missing)
      if (s0Idx >= 0) {
        scales[i] = parseFloat(parts[s0Idx]);
      } else {
        scales[i] = 0.05;
      }
  
      // opacity
      if (opacityIdx >= 0) {
        opacities[i] = parseFloat(parts[opacityIdx]);
      } else {
        opacities[i] = 1.0;
      }
    }
  
    return {
      positions,
      colors,
      scales,
      opacities,
    };
  }