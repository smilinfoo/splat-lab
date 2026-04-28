
type SplatData = {
  positions: Float32Array;
  colors: Float32Array;
  scales: Float32Array;
  opacities: Float32Array;
};

type PlyProperty = {
  name: string;
  type: string;
};

type BinaryPlyHeader = {
  dataOffset: number;
  littleEndian: boolean;
  properties: PlyProperty[];
  vertexCount: number;
};

const SH_C0 = 0.28209479177387814;

export async function loadBinaryPly(url: string): Promise<SplatData> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load PLY: ${res.status} ${res.statusText}`);
  }

  const buffer = await res.arrayBuffer();
  const header = parseBinaryPlyHeader(buffer);
  const propertyOffsets = new Array<number>(header.properties.length);

  let stride = 0;
  for (let i = 0; i < header.properties.length; i++) {
    propertyOffsets[i] = stride;
    stride += getPlyTypeSize(header.properties[i].type);
  }

  const view = new DataView(buffer, header.dataOffset);
  const positions = new Float32Array(header.vertexCount * 3);
  const colors = new Float32Array(header.vertexCount * 3);
  const scales = new Float32Array(header.vertexCount);
  const opacities = new Float32Array(header.vertexCount);

  const propertyIndex = (name: string) =>
    header.properties.findIndex((property) => property.name === name);

  const xIdx = propertyIndex("x");
  const yIdx = propertyIndex("y");
  const zIdx = propertyIndex("z");

  if (xIdx < 0 || yIdx < 0 || zIdx < 0) {
    throw new Error("Binary PLY is missing one or more position properties");
  }

  const fdc0Idx = propertyIndex("f_dc_0");
  const fdc1Idx = propertyIndex("f_dc_1");
  const fdc2Idx = propertyIndex("f_dc_2");
  const redIdx = propertyIndex("red");
  const greenIdx = propertyIndex("green");
  const blueIdx = propertyIndex("blue");
  const opacityIdx = propertyIndex("opacity");
  const scaleIndices = [
    propertyIndex("scale_0"),
    propertyIndex("scale_1"),
    propertyIndex("scale_2"),
  ].filter((index) => index >= 0);

  for (let i = 0; i < header.vertexCount; i++) {
    const baseOffset = i * stride;
    const readProp = (index: number) => {
      if (index < 0) {
        return undefined;
      }

      const property = header.properties[index];
      return readPlyValue(
        view,
        baseOffset + propertyOffsets[index],
        property.type,
        header.littleEndian,
      );
    };

    positions[i * 3 + 0] = toFiniteNumber(readProp(xIdx), 0);
    positions[i * 3 + 1] = toFiniteNumber(readProp(yIdx), 0);
    positions[i * 3 + 2] = toFiniteNumber(readProp(zIdx), 0);

    if (fdc0Idx >= 0 && fdc1Idx >= 0 && fdc2Idx >= 0) {
      colors[i * 3 + 0] = clamp01(
        0.5 + SH_C0 * toFiniteNumber(readProp(fdc0Idx), 0),
      );
      colors[i * 3 + 1] = clamp01(
        0.5 + SH_C0 * toFiniteNumber(readProp(fdc1Idx), 0),
      );
      colors[i * 3 + 2] = clamp01(
        0.5 + SH_C0 * toFiniteNumber(readProp(fdc2Idx), 0),
      );
    } else {
      colors[i * 3 + 0] = normalizeColorComponent(readProp(redIdx));
      colors[i * 3 + 1] = normalizeColorComponent(readProp(greenIdx));
      colors[i * 3 + 2] = normalizeColorComponent(readProp(blueIdx));
    }

    if (scaleIndices.length > 0) {
      let logScaleSum = 0;
      for (const scaleIndex of scaleIndices) {
        logScaleSum += toFiniteNumber(readProp(scaleIndex), 0);
      }
      scales[i] = Math.exp(logScaleSum / scaleIndices.length);
    } else {
      scales[i] = 1;
    }

    const rawOpacity = readProp(opacityIdx);
    opacities[i] = rawOpacity === undefined ? 1 : sigmoid(toFiniteNumber(rawOpacity, 0));

    scales[i] = 0.01;
    opacities[i]= 1;
  }

  return {
    positions,
    colors,
    scales,
    opacities,
  };
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizeColorComponent(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return 1;
  }

  if (value > 1 || value < 0) {
    return clamp01(value / 255);
  }

  return clamp01(value);
}

function toFiniteNumber(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function getPlyTypeSize(type: string) {
  switch (type) {
    case "char":
    case "int8":
    case "uchar":
    case "uint8":
      return 1;
    case "short":
    case "int16":
    case "ushort":
    case "uint16":
      return 2;
    case "int":
    case "int32":
    case "uint":
    case "uint32":
    case "float":
    case "float32":
      return 4;
    case "double":
    case "float64":
      return 8;
    default:
      throw new Error(`Unsupported PLY property type: ${type}`);
  }
}

function readPlyValue(
  view: DataView,
  offset: number,
  type: string,
  littleEndian: boolean,
) {
  switch (type) {
    case "char":
    case "int8":
      return view.getInt8(offset);
    case "uchar":
    case "uint8":
      return view.getUint8(offset);
    case "short":
    case "int16":
      return view.getInt16(offset, littleEndian);
    case "ushort":
    case "uint16":
      return view.getUint16(offset, littleEndian);
    case "int":
    case "int32":
      return view.getInt32(offset, littleEndian);
    case "uint":
    case "uint32":
      return view.getUint32(offset, littleEndian);
    case "float":
    case "float32":
      return view.getFloat32(offset, littleEndian);
    case "double":
    case "float64":
      return view.getFloat64(offset, littleEndian);
    default:
      throw new Error(`Unsupported PLY property type: ${type}`);
  }
}

function parseBinaryPlyHeader(buffer: ArrayBuffer): BinaryPlyHeader {
  const dataOffset = findPlyDataOffset(buffer);
  const headerText = new TextDecoder("utf-8").decode(buffer.slice(0, dataOffset));
  const lines = headerText.split(/\r?\n/);

  let vertexCount = 0;
  let littleEndian = true;
  let hasBinaryFormat = false;
  const properties: PlyProperty[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith("format ")) {
      const [, format] = line.split(/\s+/);
      if (format === "binary_little_endian") {
        littleEndian = true;
        hasBinaryFormat = true;
      } else if (format === "binary_big_endian") {
        littleEndian = false;
        hasBinaryFormat = true;
      } else {
        throw new Error(`Unsupported PLY format: ${format}`);
      }
    } else if (line.startsWith("element vertex")) {
      const [, , count] = line.split(/\s+/);
      vertexCount = Number.parseInt(count, 10);
    } else if (line.startsWith("property ")) {
      const [, type, name] = line.split(/\s+/);
      if (type === "list") {
        throw new Error("List properties are not supported in gaussian splat PLY files");
      }
      properties.push({ name, type });
    }
  }

  if (!hasBinaryFormat) {
    throw new Error("PLY file is not a binary format");
  }

  if (!Number.isFinite(vertexCount) || vertexCount <= 0) {
    throw new Error("PLY header does not contain a valid vertex count");
  }

  return {
    dataOffset,
    littleEndian,
    properties,
    vertexCount,
  };
}

function findPlyDataOffset(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const marker = new TextEncoder().encode("end_header");

  for (let i = 0; i <= bytes.length - marker.length; i++) {
    let matched = true;
    for (let j = 0; j < marker.length; j++) {
      if (bytes[i + j] !== marker[j]) {
        matched = false;
        break;
      }
    }

    if (!matched) {
      continue;
    }

    let offset = i + marker.length;
    while (offset < bytes.length && bytes[offset] !== 10) {
      offset++;
    }

    if (offset >= bytes.length) {
      throw new Error("Invalid PLY header termination");
    }

    return offset + 1;
  }

  throw new Error("Invalid PLY: no end_header");
}
