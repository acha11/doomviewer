import { 
    Clock,
    PerspectiveCamera,
    Scene, 
    MeshBasicMaterial, 
    Geometry,
    Vector2, 
    Vector3, 
    Color, 
    Face3, 
    Mesh,
    DataTexture, 
    RepeatWrapping, 
    RGBAFormat, 
    FaceColors,
    WebGLRenderer,
    AmbientLight,
    DirectionalLight} from 'three';

import { FpsStyleControls } from './FpsStyleControls.js';
import { Wad } from './Wad.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import earcut from 'earcut';

var clock = new Clock();

// wallSection:
//    0 = lower
//    1 = middle
//    2 = upper
function calculateTopAndBottomTexelCoords(textureYOffset, wallSection, upperUnpeg, lowerUnpeg, bottomOfWallSection, topOfWallSection, ceilingHeight) {
    var bottomTexel, topTexel;

    var heightOfWallSection = topOfWallSection - bottomOfWallSection;

    switch (wallSection) {
        case 0: // lower - PLACEHOLDER!!! POSSIBLY WRONG!
            if (lowerUnpeg) {
                // Lower wall section, when lower-unpegged, should paint wall as if the texture had started
                // at the CEILING and extended down. So let's set 0 as ceiling level.
                bottomTexel = 0 - (ceilingHeight - bottomOfWallSection) - textureYOffset;
                topTexel = 0 - (ceilingHeight - topOfWallSection) - textureYOffset;
            } else {
                bottomTexel = 0 - heightOfWallSection - textureYOffset;
                topTexel = 0 - textureYOffset;
            }
            break;
        case 1: // middle
            if (lowerUnpeg) {
                bottomTexel = 0 - textureYOffset;
                topTexel = heightOfWallSection - textureYOffset;
            } else {
                bottomTexel = 0 - heightOfWallSection - textureYOffset;
                topTexel = 0 - textureYOffset;
            }
            break;
        case 2: // upper - PLACEHOLDER!!! POSSIBLY WRONG!
            if (upperUnpeg) {
                bottomTexel = 0 - heightOfWallSection - textureYOffset;
                topTexel = 0 - textureYOffset;
            } else {
                bottomTexel = 0 - textureYOffset;
                topTexel = heightOfWallSection - textureYOffset;
            }
            break;
    }

    return {
        bottom: bottomTexel,
        top: topTexel
    };
}

function buildGeometryForWallSection(geometry, faceIndex, v0x, v0y, bottom, v1x, v1y, top, textureXOffset, textureYOffset, wallSection, upperUnpeg, lowerUnpeg, ceilingHeight) {
    geometry.vertices.push(new Vector3(v0x, bottom, -v0y));
    geometry.vertices.push(new Vector3(v1x, bottom, -v1y));
    geometry.vertices.push(new Vector3(v1x, top, -v1y));
    geometry.vertices.push(new Vector3(v1x, top, -v1y));
    geometry.vertices.push(new Vector3(v0x, top, -v0y));
    geometry.vertices.push(new Vector3(v0x, bottom, -v0y));

    var normal = new Vector3(0, 0, 1);
    var color = new Color(0xffffffff);
    var materialIndex = 0;
    geometry.faces.push(new Face3(faceIndex * 6 + 0, faceIndex * 6 + 1, faceIndex * 6 + 2, normal, color, materialIndex));

    // distance from v0 to v1 in 2d (ignoring height dimension)
    var lengthIn2d = Math.sqrt((v1x - v0x) * (v1x - v0x) + (v1y - v0y) * (v1y - v0y));

    var verticalTexCoords = calculateTopAndBottomTexelCoords(textureYOffset, wallSection, upperUnpeg, lowerUnpeg, bottom, top, ceilingHeight);

    geometry.faceVertexUvs[0].push(
        [
            new Vector2(textureXOffset,              verticalTexCoords.bottom), 
            new Vector2(textureXOffset + lengthIn2d, verticalTexCoords.bottom), 
            new Vector2(textureXOffset + lengthIn2d, verticalTexCoords.top)
        ]
    );

    geometry.faceVertexUvs[0].push(
        [
            new Vector2(textureXOffset + lengthIn2d, verticalTexCoords.top), 
            new Vector2(textureXOffset,              verticalTexCoords.top), 
            new Vector2(textureXOffset,              verticalTexCoords.bottom)
        ]
    );
    
    var normal = new Vector3(0, 0, 1);
    var materialIndex = 0;
    geometry.faces.push(new Face3(faceIndex * 6 + 3, faceIndex * 6 + 4, faceIndex * 6 + 5, normal, color, materialIndex));
}

function buildTexture(wad, textureName) {
    // Find the texture in the wad
    var textureLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("TEXTURE1", 0);
    var pnamesLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("PNAMES", 0);
    var patchStartLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("P_START", 0);
    var playpalLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("PLAYPAL", 0);

    var palette = [];

    for (var i = 0; i < 768; i++) {
        palette.push(wad.readByteAt(playpalLumpInfo.offset + i));
    }

    var numTextures = wad.readInt32At(textureLumpInfo.offset);

    for (var i = 0; i < numTextures; i++) {
        var relativeOffsetToTextureInfo = wad.readInt32At(textureLumpInfo.offset + 4 + i * 4);

        var absoluteOffsetToTextureInfo = textureLumpInfo.offset + relativeOffsetToTextureInfo;

        var foundTextureName = wad.readStringAt(absoluteOffsetToTextureInfo, 8);

        if (foundTextureName.toLowerCase() == textureName.toLowerCase()) {
            var texWidth = wad.readInt16At(absoluteOffsetToTextureInfo + 12);
            var texHeight = wad.readInt16At(absoluteOffsetToTextureInfo + 14);

            var width = texWidth;
            var height = texHeight;

            var data = new Uint8Array(4 * width * height);

            var numberOfPatches = wad.readInt16At(absoluteOffsetToTextureInfo + 20);

            for (var j = 0; j < numberOfPatches; j++) {
                var offsetOfPatchInfo = absoluteOffsetToTextureInfo + 22 + j * 10;

                var patchXOffset = wad.readInt16At(offsetOfPatchInfo);
                var patchYOffset = wad.readInt16At(offsetOfPatchInfo + 2);
                var patchIndex = wad.readInt16At(offsetOfPatchInfo + 4);

                var patchName = wad.readStringAt(pnamesLumpInfo.offset + 4 + patchIndex * 8, 8);

                var picLump = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex(patchName, patchStartLumpInfo.lumpIndex);

                var picWidth = wad.readInt16At(picLump.offset);
                var picHeight = wad.readInt16At(picLump.offset + 2);
                var picLeftOffset = wad.readInt16At(picLump.offset + 4);
                var picTopOffset = wad.readInt16At(picLump.offset + 6);

                // For each column of the picture (patch)
                for (var col = 0; col < picWidth; col++) {
                    // Don't copy past the right edge of the texture
                    if (patchXOffset + col >= texWidth) {
                        continue;
                    }

                    var colOffset = wad.readInt32At(picLump.offset + 8 + col * 4) + picLump.offset;

                    var pointer = colOffset;

                    do {
                        var currentRow = wad.readByteAt(pointer++);

                        if (currentRow == 255) {
                            break;
                        }

                        var pixelsInRun = wad.readByteAt(pointer++);

                        // skip 1 byte for some reason
                        pointer++;

                        for (var pixelInRun = 0; pixelInRun < pixelsInRun; pixelInRun++) {
                            var colorIndex = wad.readByteAt(pointer++);

                            // RGB
                            data[((height - currentRow - 1 - patchYOffset) * width + patchXOffset + col) * 4 + 0] = palette[colorIndex * 3 + 0];
                            data[((height - currentRow - 1 - patchYOffset) * width + patchXOffset + col) * 4 + 1] = palette[colorIndex * 3 + 1];
                            data[((height - currentRow - 1 - patchYOffset) * width + patchXOffset + col) * 4 + 2] = palette[colorIndex * 3 + 2];

                            // Alpha
                            data[((height - currentRow - 1 - patchYOffset) * width + patchXOffset + col) * 4 + 3] = 0xff;

                            currentRow++;
                        }

                        // skip 1 byte for some reason
                        pointer++;
                    } while (pixelsInRun != 255);
                }
            }

            var texture = new DataTexture(data, width, height, RGBAFormat);

            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;

            // The effect of the following lines is: rather than texture u & v ranging from 0..1, they will range from 0..textureWidth
            // and 0..textureHeight respectively. This is convenient because in doom, u and v for a wall segment are calculated based
            // on the span of world space the wall covers - by setting the texture's u/v coordinate space to align with world units,
            // when we build geometry for walls, we can set u and v based on world space units.
            texture.repeat.x = 1.0 / texWidth;
            texture.repeat.y = 1.0 / texHeight;

            return texture;
        }
    }
}

function buildFlat(wad, flatName) {
    // Find the flat in the wad
    var flatStartLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("F_START", 0);
    var playpalLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("PLAYPAL", 0);

    var palette = [];

    for (var i = 0; i < 768; i++) {
        palette.push(wad.readByteAt(playpalLumpInfo.offset + i));
    }

    var flatLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex(flatName, flatStartLumpInfo.lumpIndex);

    var texWidth = 64;
    var texHeight = 64;

    var width = texWidth;
    var height = texHeight;

    var data = new Uint8Array(4 * width * height);

    var sourcePointer = flatLumpInfo.offset;
    var destPointer = 0;

    for (var col = 0; col < width; col++) {
        for (var row = 0; row < height; row++) {
            var colorIndex = wad.readByteAt(sourcePointer++);

            // RGB
            data[destPointer++] = palette[colorIndex * 3 + 0];
            data[destPointer++] = palette[colorIndex * 3 + 1];
            data[destPointer++] = palette[colorIndex * 3 + 2];

            // Alpha
            data[destPointer++] = 0xff;
        }
    }

    var texture = new DataTexture(data, width, height, RGBAFormat);

    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;

    // The effect of the following lines is: rather than texture u & v ranging from 0..1, they will range from 0..textureWidth
    // and 0..textureHeight respectively. This is convenient because in doom, u and v for a wall segment are calculated based
    // on the span of world space the wall covers - by setting the texture's u/v coordinate space to align with world units,
    // when we build geometry for walls, we can set u and v based on world space units.
    texture.repeat.x = 1.0 / texWidth;
    texture.repeat.y = 1.0 / texHeight;

    return texture;
}

function buildKeyForTexture(textureName) { return "TEXTURE_" + textureName; }
function buildKeyForFlat(flatName) { return "FLAT_" + flatName; }

function materialManager_getMaterialForFlat(flatname) {
    var key = buildKeyForFlat(flatname);

    var material = this.materialsByKey[key];

    if (!material) {
        // Textures
        var texture = buildFlat(this.wad, flatname);

        if (texture == null) {
            throw "Failed to load flat " + flatname;
        }

        this.texturesByKey[key] = texture;

        // Materials
        material =
            new MeshBasicMaterial({
                wireframe: false,
                vertexColors: FaceColors,
                map: this.texturesByKey[key],
                transparent: false,
                alphaTest: 0.01
            });

        this.materialsByKey[key] = material;
    }

    return material;
}

function materialManager_getMaterial(texname) {
    var key = buildKeyForTexture(texname);

    var material = this.materialsByKey[key];

    if (!material) {
        // Textures
        var texture = buildTexture(this.wad, texname);

        if (texture == null) {
            throw "Failed to load texture " + texname;
        }

        this.texturesByKey[key] = texture;

        // Materials
        material =
            new MeshBasicMaterial({
                wireframe: false,
                vertexColors: FaceColors,
                map: this.texturesByKey[key],
                transparent: false,
                alphaTest: 0.01
            });

        this.materialsByKey[key] = material;
    }

    return material;
}

function buildSingleWallSectionGeometry(scene, materialManager, texname, faceIndex, v0x, v0y, bottom, v1x, v1y, top, textureXOffset, textureYOffset, wallSection, upperUnpeg, lowerUnpeg, ceilingHeight) {
    var geometry = new Geometry();

    buildGeometryForWallSection(geometry, 0, v0x, v0y, bottom, v1x, v1y, top, textureXOffset, textureYOffset, wallSection, upperUnpeg, lowerUnpeg, ceilingHeight);

    geometry.computeFaceNormals();
    geometry.computeVertexNormals();

    scene.add(new Mesh(geometry, materialManager.getMaterial(texname)));
}

function buildScene(wad, mapLumpInfo, scene, materialManager) {
    var lineDefsLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("LINEDEFS", mapLumpInfo.lumpIndex);
    var vertexesLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("VERTEXES", mapLumpInfo.lumpIndex);
    var sidedefsLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("SIDEDEFS", mapLumpInfo.lumpIndex);
    var sectorsLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("SECTORS", mapLumpInfo.lumpIndex);

    var numberOfLineDefs = lineDefsLumpInfo.length / 14;

    // Build floors
    var sectorInfo = triangulateSectors(wad, mapLumpInfo);

    for (var sectorIndex in sectorInfo) {
        var sector = sectorInfo[sectorIndex];

        var floorHeight = wad.readInt16At(sectorsLumpInfo.offset + 26 * sectorIndex);
        var ceilingHeight = wad.readInt16At(sectorsLumpInfo.offset + 26 * sectorIndex + 2);

        var floorFlatName = wad.readStringAt(sectorsLumpInfo.offset + 26 * sectorIndex + 4, 8);

        if (floorFlatName != "F_SKY1" &&
            floorFlatName != "F_SKY2" &&
            floorFlatName != "F_SKY3") {
            var floorFlatMaterial = materialManager.getMaterialForFlat(floorFlatName);

            // Floor
            var geometry = new Geometry();

            var vertices = sector.vertices;
            var indices = sector.triangleIndices;

            for (var i = 0; i < indices.length; i++) {
                geometry.vertices.push(new Vector3(vertices[indices[i] * 2], floorHeight, -vertices[indices[i] * 2 + 1]));
            }
        
            var normal = new Vector3(0, 0, 1);
            var color = new Color(0xffffffff);
            var materialIndex = 0;

            for (var i = 0; i < indices.length; i += 3) {
                // Create a face, referencing the vertices by their index
                geometry.faces.push(
                    new Face3(i, i + 1, i + 2, normal, color, materialIndex)
                );

                // Create a "UV coordinates for face" entry. The new entry is an array with
                // one item for each point on the poly. Each of those items is a Vector2
                // containing the UV coordinates to use for that vertex of the polygon.
                geometry.faceVertexUvs[0].push(
                    [
                        new Vector2(geometry.vertices[i].x, geometry.vertices[i].z),
                        new Vector2(geometry.vertices[i + 1].x, geometry.vertices[i + 1].z),
                        new Vector2(geometry.vertices[i + 2].x, geometry.vertices[i + 2].z)
                    ]
                )
            }

            geometry.computeFaceNormals();
            geometry.computeVertexNormals();

            scene.add(new Mesh(geometry, floorFlatMaterial));
        }

        var ceilingFlatName = wad.readStringAt(sectorsLumpInfo.offset + 26 * sectorIndex + 12, 8);

        // Ceiling
        if (ceilingFlatName != "F_SKY1" &&
            ceilingFlatName != "F_SKY2" &&
            ceilingFlatName != "F_SKY3") {
            var ceilingFlatMaterial = materialManager.getMaterialForFlat(ceilingFlatName);

            var geometry = new Geometry();

            var vertices = sector.vertices;
            var indices = sector.triangleIndices;

            for (var i = indices.length - 1; i >= 0; i--) {
                geometry.vertices.push(new Vector3(vertices[indices[i] * 2], ceilingHeight, -vertices[indices[i] * 2 + 1]));
            }
        
            var normal = new Vector3(0, 0, 1);
            var color = new Color(0xffffffff);
            var materialIndex = 0;

            for (var i = 0; i < indices.length; i += 3) {
                geometry.faces.push(
                    new Face3(i, i + 1, i + 2, normal, color, materialIndex)
                );

                // Create a "UV coordinates for face" entry. The new entry is an array with
                // one item for each point on the poly. Each of those items is a Vector2
                // containing the UV coordinates to use for that vertex of the polygon.
                geometry.faceVertexUvs[0].push(
                    [
                        new Vector2(geometry.vertices[i].x, geometry.vertices[i].z),
                        new Vector2(geometry.vertices[i + 1].x, geometry.vertices[i + 1].z),
                        new Vector2(geometry.vertices[i + 2].x, geometry.vertices[i + 2].z)
                    ]
                )
            }

            geometry.computeFaceNormals();
            geometry.computeVertexNormals();

            scene.add(new Mesh(geometry, ceilingFlatMaterial));
        }
    }


    // Build walls

    var faceIndex = 0;

    for (var i = 0; i < numberOfLineDefs; i++) {
        var rightSideDefIndex = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14) + 10);
        var leftSideDefIndex = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14) + 12);

        var rightSectorIndex = wad.readInt16At(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 28, 8);
        var frontSectorFloorHeight = wad.readInt16At(sectorsLumpInfo.offset + rightSectorIndex * 26 + 0, 8);
        var frontSectorCeilingHeight = wad.readInt16At(sectorsLumpInfo.offset + rightSectorIndex * 26 + 2, 8);

        var vi0 = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14));
        var vi1 = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14) + 2);
        var flags = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14) + 4);

        var upperUnpegged = (flags & 8) == 8;
        var lowerUnpegged = (flags & 16) == 16;

        var v0x = wad.readInt16At(vertexesLumpInfo.offset + (vi0 * 4));
        var v0y = wad.readInt16At(vertexesLumpInfo.offset + (vi0 * 4) + 2);
        var v1x = wad.readInt16At(vertexesLumpInfo.offset + (vi1 * 4));
        var v1y = wad.readInt16At(vertexesLumpInfo.offset + (vi1 * 4) + 2);

        var textureXOffset = wad.readInt16At(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 0, 8);
        var textureYOffset = wad.readInt16At(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 2, 8);

        var frontTopTexture = wad.readStringAt(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 4, 8);
        var frontBottomTexture = wad.readStringAt(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 12, 8);
        var frontMiddleTexture = wad.readStringAt(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 20, 8);

        if (leftSideDefIndex == -1) {
            if (frontMiddleTexture != '-') {
                buildSingleWallSectionGeometry(scene, materialManager, frontMiddleTexture, faceIndex, v0x, v0y, frontSectorFloorHeight, v1x, v1y, frontSectorCeilingHeight, textureXOffset, textureYOffset, 1, upperUnpegged, lowerUnpegged, frontSectorCeilingHeight);
                faceIndex++;
            }
        } else {
            // This is a two-sided wall - read the far-side's details
            var leftSectorIndex = wad.readInt16At(sidedefsLumpInfo.offset + leftSideDefIndex * 30 + 28);
            var backSectorFloorHeight = wad.readInt16At(sectorsLumpInfo.offset + leftSectorIndex * 26 + 0);
            var backSectorCeilingHeight = wad.readInt16At(sectorsLumpInfo.offset + leftSectorIndex * 26 + 2);

            var backTopTexture = wad.readStringAt(sidedefsLumpInfo.offset + leftSideDefIndex * 30 + 4, 8);
            var backBottomTexture = wad.readStringAt(sidedefsLumpInfo.offset + leftSideDefIndex * 30 + 12, 8);
            var backMiddleTexture = wad.readStringAt(sidedefsLumpInfo.offset + leftSideDefIndex * 30 + 20, 8);

            // Middle section of front side
            if (frontMiddleTexture != '-') {
                // TODO: Correctly handle transparent textures like those to the player's left (near the chainsaw) at the 
                // start of Doom 2 MAP01 as per following text from unofficial doom spec:
                // There are some transparent textures which can be used as middle textures
                // on 2-sided sidedefs (between sectors). These textures need to be composed
                // of a single patch (see [8-4]), and note that on a very tall wall, they
                // will NOT be tiled. Only one will be placed, at the spot determined by
                // the "lower unpegged" flag being on/off and the sidedef's y offset. And
                // if a transparent texture is used as an upper or lower texture, then
                // the good old "Tutti Frutti" effect will have its way.


                buildSingleWallSectionGeometry(scene, materialManager, frontMiddleTexture, faceIndex, v0x, v0y, Math.max(frontSectorFloorHeight, backSectorFloorHeight), v1x, v1y, Math.min(frontSectorCeilingHeight, backSectorCeilingHeight), textureXOffset, textureYOffset, 1, upperUnpegged, lowerUnpegged, frontSectorCeilingHeight);
                faceIndex++;
            }

            // Bottom section of front side
            if (frontBottomTexture != '-' && frontSectorFloorHeight < backSectorFloorHeight) {
                buildSingleWallSectionGeometry(scene, materialManager, frontBottomTexture, faceIndex, v0x, v0y, frontSectorFloorHeight, v1x, v1y, backSectorFloorHeight, textureXOffset, textureYOffset, 0, upperUnpegged, lowerUnpegged, frontSectorCeilingHeight);
                faceIndex++;
            }

            // Top section of front side
            if (frontTopTexture != '-' && backSectorCeilingHeight < frontSectorCeilingHeight) {
                buildSingleWallSectionGeometry(scene, materialManager, frontTopTexture, faceIndex, v0x, v0y, backSectorCeilingHeight, v1x, v1y, frontSectorCeilingHeight, textureXOffset, textureYOffset, 2, upperUnpegged, lowerUnpegged, frontSectorCeilingHeight);
                faceIndex++;
            }

            // Bottom section of back side
            if (backBottomTexture != '-' && backSectorFloorHeight < frontSectorFloorHeight) {
                buildSingleWallSectionGeometry(scene, materialManager, backBottomTexture, faceIndex, v1x, v1y, backSectorFloorHeight, v0x, v0y, frontSectorFloorHeight, textureXOffset, textureYOffset, 0, upperUnpegged, lowerUnpegged, backSectorCeilingHeight);
                faceIndex++;
            }

            // Top section of back side
            if (backTopTexture != '-' && frontSectorCeilingHeight < backSectorCeilingHeight) {
                buildSingleWallSectionGeometry(scene, materialManager, backTopTexture, faceIndex, v1x, v1y, frontSectorCeilingHeight, v0x, v0y, backSectorCeilingHeight, textureXOffset, textureYOffset, 2, upperUnpegged, lowerUnpegged, backSectorCeilingHeight);
                faceIndex++;
            }
        }
    }
}

function renderToThreeJs(wad) {
    var scene = new Scene();
    var camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 20000);
    
    var renderer = new WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    
    var stats = new Stats();
    document.body.appendChild(stats.dom);

    var controls = new FpsStyleControls(camera);
    controls.lookSpeed = 0.2;
    controls.movementSpeed = 400;
    controls.noFly = true;
    controls.lookVertical = true;
    controls.constrainVertical = true;
    controls.verticalMin = 1.0;
    controls.verticalMax = 2.0;
    controls.lon = -150;
    controls.lat = 120;

    var materialManager = {
        texturesByKey: {},
        materialsByKey: {},
        wad: wad,

        getMaterial: materialManager_getMaterial,
        getMaterialForFlat: materialManager_getMaterialForFlat
    };
    
    // Lights
    var light = new AmbientLight(0x404040);
    scene.add(light);

    // White directional light at half intensity
    var directionalLight = new DirectionalLight(0xffffff, 0.5);
    directionalLight.position.x = 1;
    directionalLight.position.y = 1;
    directionalLight.position.z = 1;

    scene.add(directionalLight);

    var mapLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("MAP11", 0);

    buildScene(wad, mapLumpInfo, scene, materialManager);

    var thingsLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("THINGS", mapLumpInfo.lumpIndex);

    // Look for p1 start thing
    for (var thingIndex = 0; thingIndex < thingsLumpInfo.length / 10; thingIndex++) {
        var thingOffset = thingsLumpInfo.offset + 10 * thingIndex;

        var thingType = wad.readInt16At(thingOffset + 6);

        if (thingType == 1) {
            camera.position.x = wad.readInt16At(thingOffset + 0);

            // TODO: Set camera height based on floor height of sector we're in
            camera.position.y = 90;
            camera.position.z = wad.readInt16At(thingOffset + 2) * -1;
        }
    }

    var time = 0;
    function animate() {               
        var delta = clock.getDelta();
        controls.update(delta);
        stats.update();

        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    animate();
}

function loadWad() {
    var myRequest = new Request('doom2.wad');

    return (
        fetch(myRequest)
        .then(response => response.blob())
        .then(blob => blob.arrayBuffer())
        .then(arrayBuffer => {
            var wad = new Wad(new Uint8Array(arrayBuffer));

            return wad;
        })
    );
}

function triangulateSectors(wad, mapLumpInfo) {
    var lineDefsLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("LINEDEFS", mapLumpInfo.lumpIndex);
    var vertexesLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("VERTEXES", mapLumpInfo.lumpIndex);
    var sidedefsLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("SIDEDEFS", mapLumpInfo.lumpIndex);

    var numberOfLineDefs = lineDefsLumpInfo.length / 14;

    var linesBySector = {
    };

    // Build a map from sector id to the lines for that sector
    for (var i = 0; i < numberOfLineDefs; i++) {
        var vi0 = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14));
        var vi1 = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14) + 2);
        var rightSideDefIndex = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14) + 10);
        var leftSideDefIndex = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14) + 12);

        var rightSectorIndex = wad.readInt16At(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 28, 8);
        var leftSectorIndex = leftSideDefIndex == -1 ? -1 : wad.readInt16At(sidedefsLumpInfo.offset + leftSideDefIndex * 30 + 28, 8);

        // Filter out any lines that are "internal" to a sector, i.e. have sector inside on 
        // both sides of them.
        if (leftSectorIndex == rightSectorIndex) {
            continue;
        }

        var v0x = wad.readInt16At(vertexesLumpInfo.offset + (vi0 * 4));
        var v0y = wad.readInt16At(vertexesLumpInfo.offset + (vi0 * 4) + 2);
        var v1x = wad.readInt16At(vertexesLumpInfo.offset + (vi1 * 4));
        var v1y = wad.readInt16At(vertexesLumpInfo.offset + (vi1 * 4) + 2);

        if (!linesBySector[rightSectorIndex]) linesBySector[rightSectorIndex] = [];

        // If the sector is on the right-hand side of the line as we travel along it, then we
        // add the vertices in their existing order (v0 -> v1), so that as we travel along
        // the lines, we keep the "inside" of the sector on our right.
        linesBySector[rightSectorIndex].push({v0x: v0x, v0y: v0y, v1x: v1x, v1y: v1y});

        if (leftSectorIndex != -1) {
            if (!linesBySector[leftSectorIndex]) linesBySector[leftSectorIndex] = [];

            // But if the sector is on the left-hand side of the line as we travel along it,
            // then we add the vertices in reverse order (v1 -> v0), so that we get the
            // orientation we want (i.e., as we travel along the lines, we keep the "inside"
            // of the sector on our right)
            linesBySector[leftSectorIndex].push({v0x: v1x, v0y: v1y, v1x: v0x, v1y: v0y});
        }
    }

    var sectorInfo = {};

    // For each sector
    for (var sectorIndex in linesBySector) {
        // Break sector outline into paths (holes or disjoint outlines should be separate paths)
        var sectorLines = linesBySector[sectorIndex];

        // Strategy: assign every line to its own group. Repeatedly merge groups that share
        // a vertex until there there are no vertices shared between groups.        
        for (var j = 0; j < sectorLines.length; j++) {
            sectorLines[j].group = j;
        }

        var completedAPassWithoutMerging = false;

        var passes = 0;
        var MaxPasses = 25;

        while (!completedAPassWithoutMerging && passes < MaxPasses) {
            completedAPassWithoutMerging = true;

            // Look for lines in different groups that share a vertex. Merge their groups.
            for (var j = 0; j < sectorLines.length; j++) {
                var a = sectorLines[j];

                for (var k = 1; k < sectorLines.length; k++) {
                    var b = sectorLines[k];

                    if (a.group == b.group) continue;

                    if ( (a.v0x == b.v0x && a.v0y == b.v0y) ||
                         (a.v0x == b.v1x && a.v0y == b.v1y) ||
                         (a.v1x == b.v0x && a.v1y == b.v0y) ||
                         (a.v1x == b.v1x && a.v1y == b.v1y) ) {
                        // These points are assigned to different groups, but share a vertex.
                        // Move any lines in b's group into a's group.
                        var sourceGroup = b.group;

                        completedAPassWithoutMerging = false;

                        for (var m = 0; m < sectorLines.length; m++) {
                            var c = sectorLines[m];

                            if (c.group == sourceGroup) {
                                c.group = a.group;
                            }
                        }
                    }                        
                }
            }
        }

        if (!completedAPassWithoutMerging) {
            throw "Failed to group.";
        }

        // Build a map that contains one entry for each of the 'paths' (perimeters/holes)
        var paths = {};

        for (var k = 0; k < sectorLines.length; k++) {
            var a = sectorLines[k];

            if (!paths[a.group]) paths[a.group] = [];

            paths[a.group].push(a);
        }

        var wellFormed = true;

        // Go through each of the paths and sort the lines in the path
        for (var key in paths) {
            var path = paths[key];

            var sortedLines = [];

            var elementToMove = path[0];

            path.splice(path.indexOf(elementToMove), 1);

            sortedLines.push(elementToMove);

            while (path.length > 0) {
                var lastElement = sortedLines[sortedLines.length - 1];

                // Go looking for a line starting at the endpoint of the last element
                var matches = [];
                for (var j = 0; j < path.length; j++) {
                    var e = path[j];

                    if (e.v0x == lastElement.v1x && e.v0y == lastElement.v1y) {
                        matches.push(e);
                    }
                }

                if (!matches.length) {
                    window.console.log("Error for sector #" + sectorIndex + ": Could not find a line starting at end of last element.");
                    wellFormed = false;
                    break;
                }

                var match = null;
                if (matches.length == 1) {
                    match = matches[0];
                } else {
                    // Choose the successor line that is least bent to the right. THIS STRATEGY
                    // WILL ONLY WORK FOR PERIMETERS, NOT HOLES, WHICH BEND THE OTHER WAY. WE
                    // DON'T KNOW IF WE'RE DEALING WITH A PERIMETER OR A HOLE AT THIS POINT.
                    window.console.log("Error for sector #" + sectorIndex + ": More than one line starting at end of last element.");
                    wellFormed = false;
                    break;

                }

                path.splice(path.indexOf(match), 1);

                sortedLines.push(match);
            }

            if (!wellFormed) break;

            paths[key] = sortedLines;
        }

        if (!wellFormed) continue;

        var perimeters = [];
        var holes = [];

        // Go through each of the paths and calculate the total internal angle, and add the
        // path to the perimeters or holes list as appropriate
        for (var key in paths) {
            var path = paths[key];

            var accumulatedAngle = 0;

            for (var j = 0; j < path.length; j++) {
                var l1 = path[j];
                var l2 = path[(j + 1) % path.length];

                var line1 = new Vector2(l1.v1x - l1.v0x, l1.v1y - l1.v0y).normalize();
                var line2 = new Vector2(l2.v1x - l2.v0x, l2.v1y - l2.v0y).normalize();
                
                // Clamp from -1 to 1 to avoid isNaN
                var arg = line1.x * line2.x + line1.y * line2.y;
                arg = Math.min(arg, 1);
                arg = Math.max(arg, -1);

                var theta = Math.acos(arg);

                theta = theta * 180 / Math.PI;

                // Theta is now (unsigned) angle between line1 and line2
                
                // Flip theta if it's a CCW rotation.
                if (line1.x * line2.y - line1.y * line2.x > 0) theta *= -1;

                if (isNaN(theta)) {
                    window.console.log("Error for sector #" + sectorIndex + ", path " + key + ", line " + j + ": theta is NaN");
                    window.console.log("  first line is  (" + l1.v0x + ", " + l1.v0y + ") to (" + l1.v1x + ", " + l1.v1y + ")" );
                    window.console.log("  second line is (" + l2.v0x + ", " + l2.v0y + ") to (" + l2.v1x + ", " + l2.v1y + ")" );
                    window.console.log(line1, line2, theta);

                    wellFormed = false;
                    break;
                }

                accumulatedAngle += theta;
            }

            if (!wellFormed) break;

            (accumulatedAngle > 0 ? perimeters : holes).push(path);
        }

        if (!wellFormed) continue;

        var vertices = [];
        var holeStartIndexesForEarcut = [];

        for (var i = 0; i < perimeters.length; i++) {
            var path = perimeters[i];

            for (var j = 0; j < path.length; j++) {        
                var v = path[j];
                
                vertices.push(v.v0x);
                vertices.push(v.v0y);
            }
        }

        for (var i = 0; i < holes.length; i++) {
            var path = holes[i];

            holeStartIndexesForEarcut.push(vertices.length / 2);

            for (var j = 0; j < path.length; j++) {
                var v = path[j];

                vertices.push(v.v0x);
                vertices.push(v.v0y);
            }
        }

        var triangles = earcut(vertices, holeStartIndexesForEarcut, 2);

        sectorInfo[sectorIndex] = {
            vertices: vertices,
            triangleIndices: triangles,
            perimeters: perimeters,
            holes: holes
        };
    }

    return sectorInfo;
}

function render2dMapToCanvas(wad) {
    var canvas = document.getElementById('mainCanvas');

    canvas.style.display = "inline-block";

    var ctx = canvas.getContext('2d');

    var mapLumpInfo =    wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("MAP02", 0);
    var lineDefsLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("LINEDEFS", mapLumpInfo.lumpIndex);
    var vertexesLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("VERTEXES", mapLumpInfo.lumpIndex);

    var scaleFactor = 0.5;
    var xOffset = 1600 * scaleFactor;
    var yOffset = 3200 * scaleFactor;

    var numberOfLineDefs = lineDefsLumpInfo.length / 14;

    // Render all linedefs
    for (var i = 0; i < numberOfLineDefs; i++) {
        var vi0 = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14));
        var vi1 = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14) + 2);

        var v0x = wad.readInt16At(vertexesLumpInfo.offset + (vi0 * 4));
        var v0y = wad.readInt16At(vertexesLumpInfo.offset + (vi0 * 4) + 2);
        var v1x = wad.readInt16At(vertexesLumpInfo.offset + (vi1 * 4));
        var v1y = wad.readInt16At(vertexesLumpInfo.offset + (vi1 * 4) + 2);

        ctx.beginPath();
        ctx.moveTo(v0x * scaleFactor + xOffset, v0y * -scaleFactor + yOffset);
        ctx.lineTo(v1x * scaleFactor + xOffset, v1y * -scaleFactor + yOffset);
        ctx.closePath();
        ctx.stroke();
    }

    var sectorInfo = triangulateSectors(wad, mapLumpInfo);

    for (var sectorIndex in sectorInfo) {
        var sector = sectorInfo[sectorIndex];

        renderTriangles(ctx, sector.vertices, sector.triangleIndices, scaleFactor, xOffset, yOffset);
        
        ctx.strokeStyle = "blue";
    
        for (var i = 0; i < sector.perimeters.length; i++) {
            var path = sector.perimeters[i];
    
            for (var j = 0; j < path.length; j++) {        
                var v = path[j];
                
                canvas_arrow(ctx, v.v0x * scaleFactor + xOffset, v.v0y * -scaleFactor + yOffset, v.v1x * scaleFactor + xOffset, v.v1y * -scaleFactor + yOffset);
            }
        }
    
        ctx.strokeStyle = "red";
    
        for (var i = 0; i < sector.holes.length; i++) {
            var path = sector.holes[i];
    
            for (var j = 0; j < path.length; j++) {        
                var v = path[j];
                
                canvas_arrow(ctx, v.v0x * scaleFactor + xOffset, v.v0y * -scaleFactor + yOffset, v.v1x * scaleFactor + xOffset, v.v1y * -scaleFactor + yOffset);
            }
        }
    }
}

function renderTriangles(ctx, vertices, triangles, scaleFactor, xOffset, yOffset)
{
    ctx.fillStyle  = "yellow";
    ctx.strokeStyle  = "grey";

    for (var i = 0; i < triangles.length; i += 3) {
        ctx.beginPath();
        
        var x = vertices[triangles[i] * 2];
        var y = vertices[triangles[i] * 2 + 1];

        ctx.moveTo(x * scaleFactor + xOffset, y * -scaleFactor + yOffset);

        var x = vertices[triangles[i + 1] * 2];
        var y = vertices[triangles[i + 1] * 2 + 1];

        ctx.lineTo(x * scaleFactor + xOffset, y * -scaleFactor + yOffset);

        var x = vertices[triangles[i + 2] * 2];
        var y = vertices[triangles[i + 2] * 2 + 1];

        ctx.lineTo(x * scaleFactor + xOffset, y * -scaleFactor + yOffset);

        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

function canvas_arrow(context, fromx, fromy, tox, toy) {
    var headlen = 10; // length of head in pixels
    var dx = tox - fromx;
    var dy = toy - fromy;
    var angle = Math.atan2(dy, dx);
    context.beginPath();
    context.moveTo(fromx, fromy);
    context.lineTo(tox, toy);
    context.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    context.moveTo(tox, toy);
    context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    context.stroke();
}


//loadWad().then(render2dMapToCanvas);
loadWad().then(renderToThreeJs);