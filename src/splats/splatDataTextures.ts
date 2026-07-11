import * as THREE from "three";
import type { SplatData } from "./loader";

export type SplatDataTextureSet = {
    count: number;
    width: number;
    height: number;
    positions: THREE.DataTexture;
    colors: THREE.DataTexture;
    scales: THREE.DataTexture;
    rotations: THREE.DataTexture;
    opacities: THREE.DataTexture;
};

type TextureSpec = {
    data: Float32Array;
    itemSize: number;
    format: number;
};

export async function createDataTextureSet(data: SplatData): Promise<SplatDataTextureSet> {
    const count = getSplatCount(data);
    const { width, height } = getTextureDimensions(count);
    
    const reCastPositions = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
        reCastPositions[i * 4 + 0] = data.positions[i * 3 + 0];
        reCastPositions[i * 4 + 1] = data.positions[i * 3 + 1];
        reCastPositions[i * 4 + 2] = data.positions[i * 3 + 2];
        reCastPositions[i * 4 + 3] = 1.0; // Add a default w component
    }

    const reCastColors = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
        reCastColors[i * 4 + 0] = data.colors[i * 3 + 0];
        reCastColors[i * 4 + 1] = data.colors[i * 3 + 1];
        reCastColors[i * 4 + 2] = data.colors[i * 3 + 2];
        reCastColors[i * 4 + 3] = data.opacities[i]; // Use the opacity value for the alpha channel
    }

    const reCastScales = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
        reCastScales[i * 4 + 0] = data.scales[i * 3 + 0];
        reCastScales[i * 4 + 1] = data.scales[i * 3 + 1];
        reCastScales[i * 4 + 2] = data.scales[i * 3 + 2];
        reCastScales[i * 4 + 3] = 1.0; // Use the opacity value for the alpha channel
    }
    console.log(`color data`);
    console.log(data.colors);
    return {
        count,
        width,
        height,
        positions: createFloatDataTexture({
            data: reCastPositions,
            itemSize: 4,
            format: THREE.RGBAFormat,
        }, width, height),
        colors: createFloatDataTexture({
            data: reCastColors,
            itemSize: 4,
            format: THREE.RGBAFormat,
        }, width, height),
        scales: createFloatDataTexture({
            data: reCastScales,
            itemSize: 4,
            format: THREE.RGBAFormat,
        }, width, height),
        rotations: createFloatDataTexture({
            data: data.rotations,
            itemSize: 4,
            format: THREE.RGBAFormat,
        }, width, height),
        opacities: createFloatDataTexture({
            data: data.opacities,
            itemSize: 1,
            format: THREE.RedFormat,
        }, width, height),
    };
}

function getSplatCount(data: SplatData) {
    const count = data.colors.length / 3;

    //thi check is not worthwhile
    if (!Number.isInteger(count)) {
        throw new Error("Splat positions length must be divisible by 3");
    }

    validateArrayLength("colors", data.colors, count, 3);
    validateArrayLength("scales", data.scales, count, 3);
    validateArrayLength("rotations", data.rotations, count, 4);
    validateArrayLength("opacities", data.opacities, count, 1);

    return count;
}

function validateArrayLength(
    name: string,
    array: Float32Array,
    count: number,
    itemSize: number,
) {
    const expectedLength = count * itemSize;

    if (array.length !== expectedLength) {
        throw new Error(
            `Splat ${name} length must be ${expectedLength}, got ${array.length}`,
        );
    }
}

function getTextureDimensions(count: number) {
    if (count === 0) {
        return { width: 1, height: 1 };
    }

    const width = Math.ceil(Math.sqrt(count));
    const height = Math.ceil(count / width);

    return { width, height };
}

function createFloatDataTexture(
    spec: TextureSpec,
    width: number,
    height: number,
) {
    const paddedLength = width * height * spec.itemSize;
    const textureData =
        spec.data.length === paddedLength ? spec.data : new Float32Array(paddedLength);

    if (textureData !== spec.data) {
        textureData.set(spec.data);
    }
    console.log(spec.format);
    console.log();
    const texture = new THREE.DataTexture(
        textureData,
        width,
        height,
        spec.format,
        THREE.FloatType,
    );

    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;

    console.log(texture);
    
    return texture;
}
