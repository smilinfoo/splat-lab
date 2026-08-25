// Depth sort for splats. Pure module: no three, no geometry, no renderer.
// It owns the positions and a working index buffer, takes a transform per
// frame, and returns a back-to-front draw order. The caller is responsible
// for copying that order into the GPU index buffer.

export type SplatSorter = {
  readonly count: number;
  // Transform used for the next sort: a column-major 16-float view (or
  // modelView) matrix, e.g. THREE.Matrix4.elements. Copied, not retained.
  setTransform(viewMatrixElements: ArrayLike<number>): void;
  // Reorder the held indices far -> near for the current transform and return
  // them. The returned array is the sorter's internal buffer (do not retain).
  sort(): Uint32Array;
};

// positions: length 3*N (xyz per splat), retained by reference.
// indices: initial draw order; defaults to identity [0..N-1].
export function createSplatSorter(
  positions: Float32Array,
  indices?: Uint32Array,
): SplatSorter {
  const count = Math.floor(positions.length / 3);

  const order = indices ?? identityIndices(count);
  if (order.length !== count) {
    throw new Error(
      `Sorter indices length must be ${count}, got ${order.length}`,
    );
  }

  const depth = new Float32Array(count);
  const m = new Float32Array(16);

  function setTransform(viewMatrixElements: ArrayLike<number>): void {
    if (viewMatrixElements.length < 16) {
      throw new Error("setTransform expects 16 matrix elements (column-major)");
    }
    for (let i = 0; i < 16; i++) {
      m[i] = viewMatrixElements[i];
    }
  }

  function sort(): Uint32Array {
    // View-space Z (row 2 of the column-major matrix). In three's -Z-forward
    // view space, farther splats have more negative Z, so ascending Z is
    // far -> near: the correct back-to-front order for over/premultiplied blend.
    const m2 = m[2];
    const m6 = m[6];
    const m10 = m[10];
    const m14 = m[14];
    for (let i = 0; i < count; i++) {
      const p = i * 3;
      depth[i] = m2 * positions[p] + m6 * positions[p + 1] + m10 * positions[p + 2] + m14;
    }

    order.sort((a, b) => depth[a] - depth[b]);
    return order;
  }

  return {
    count,
    setTransform,
    sort,
  };
}

function identityIndices(count: number): Uint32Array {
  const out = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = i;
  }
  return out;
}
