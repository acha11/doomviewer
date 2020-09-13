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
    TextureLoader, 
    DataTexture, 
    RepeatWrapping, 
    RGBFormat, 
    FaceColors,
    WebGLRenderer,
    AmbientLight,
    DirectionalLight} from 'three';


import { FpsStyleControls } from './FpsStyleControls.js';


var clock = new Clock();

function buildGeometryForWallSection(geometry, faceIndex, v0x, v0y, bottom, v1x, v1y, top, textureXOffset, textureYOffset) {
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

    // TODO: Implement lower unpegged behaviour (draws top up)
    var lowerUnpegged = false;
    var texelAtTop =    (lowerUnpegged ? top - bottom : 0) + textureYOffset;
    var texelAtBottom = (lowerUnpegged ? 0 : 0 - (top - bottom)) + textureYOffset;

    geometry.faceVertexUvs[0].push(
        [
            new Vector2(textureXOffset,              texelAtBottom), 
            new Vector2(textureXOffset + lengthIn2d, texelAtBottom), 
            new Vector2(textureXOffset + lengthIn2d, texelAtTop)
        ]
    );

    geometry.faceVertexUvs[0].push(
        [
            new Vector2(textureXOffset + lengthIn2d, texelAtTop), 
            new Vector2(textureXOffset,              texelAtTop), 
            new Vector2(textureXOffset,              texelAtBottom)
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

            var data = new Uint8Array(3 * width * height);

            window.console.log(i + " " + textureName + ", dims " + texWidth + " x " + texHeight);

            var numberOfPatches = wad.readInt16At(absoluteOffsetToTextureInfo + 20);

            for (var j = 0; j < numberOfPatches; j++) {
                var offsetOfPatchInfo = absoluteOffsetToTextureInfo + 22 + j * 10;

                var patchXOffset = wad.readInt16At(offsetOfPatchInfo);
                var patchYOffset = wad.readInt16At(offsetOfPatchInfo + 2);
                var patchIndex = wad.readInt16At(offsetOfPatchInfo + 4);

                var patchName = wad.readStringAt(pnamesLumpInfo.offset + 4 + patchIndex * 8, 8);

                window.console.log("  Applying patch " + j + ", patch index " + patchIndex + ", with name " + patchName);

                var picLump = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex(patchName, patchStartLumpInfo.lumpIndex);

                var picWidth = wad.readInt16At(picLump.offset);
                var picHeight = wad.readInt16At(picLump.offset + 2);
                var picLeftOffset = wad.readInt16At(picLump.offset + 4);
                var picTopOffset = wad.readInt16At(picLump.offset + 6);

                window.console.log("    Pic dims: " + picWidth + " x " + picHeight + ", offset " + picLeftOffset + ", " + picTopOffset);

                // For each column of the picture (patch)
                for (var col = 0; col < picWidth; col++) {
                    var colOffset = wad.readInt32At(picLump.offset + 8 + col * 4) + picLump.offset;

                    var currentRow = wad.readByteAt(colOffset);

                    var postOffset = colOffset + 1;
                    
                    do {
                        var pixelsInRun = wad.readByteAt(postOffset);

                        if (pixelsInRun == 255) {
                            break;
                        }

                        for (var pixelOffset = postOffset + 1; pixelOffset < postOffset + 3 + pixelsInRun; pixelOffset++) {
                            var colorIndex = wad.readByteAt(pixelOffset);

                            data[((height - currentRow - 1 - patchYOffset) * width + patchXOffset + col) * 3 + 0] = palette[colorIndex * 3];
                            data[((height - currentRow - 1 - patchYOffset) * width + patchXOffset + col) * 3 + 1] = palette[colorIndex * 3 + 1];
                            data[((height - currentRow - 1 - patchYOffset) * width + patchXOffset + col) * 3 + 2] = palette[colorIndex * 3 + 2];

                            currentRow++;
                        }

                        postOffset += pixelsInRun + 3;
                    } while (pixelsInRun != 255);
                }
            }

            var texture = new DataTexture(data, width, height, RGBFormat);

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

function materialManager_getMaterial(texname) {
    var material = this.materialsByTexname[texname];

    if (!material) {
        // Textures
        var texture = buildTexture(this.wad, texname);

        if (texture == null) {
            throw "Failed to load texture " + texname;
        }

        this.texturesByTexname[texname] = texture;

        // Materials
        material =
            new MeshBasicMaterial({
                wireframe: false,
                vertexColors: FaceColors,
                map: this.texturesByTexname[texname]
            });

        this.materialsByTexname[texname] = material;
    }

    return material;
}

function buildSingleWallSectionGeometry(scene, materialManager, texname, faceIndex, v0x, v0y, bottom, v1x, v1y, top, textureXOffset, textureYOffset) {
    var geometry = new Geometry();

    buildGeometryForWallSection(geometry, 0, v0x, v0y, bottom, v1x, v1y, top, textureXOffset, textureYOffset);

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

    var faceIndex = 0;

    for (var i = 0; i < numberOfLineDefs; i++) {
        var rightSideDefIndex = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14) + 10);
        var leftSideDefIndex = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14) + 12);

        var rightSectorIndex = wad.readInt16At(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 28, 8);
        var frontSectorFloorHeight = wad.readInt16At(sectorsLumpInfo.offset + rightSectorIndex * 26 + 0, 8);
        var frontSectorCeilingHeight = wad.readInt16At(sectorsLumpInfo.offset + rightSectorIndex * 26 + 2, 8);

        var vi0 = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14));
        var vi1 = wad.readInt16At(lineDefsLumpInfo.offset + (i * 14) + 2);

        var v0x = wad.readInt16At(vertexesLumpInfo.offset + (vi0 * 4));
        var v0y = wad.readInt16At(vertexesLumpInfo.offset + (vi0 * 4) + 2);
        var v1x = wad.readInt16At(vertexesLumpInfo.offset + (vi1 * 4));
        var v1y = wad.readInt16At(vertexesLumpInfo.offset + (vi1 * 4) + 2);

        var textureXOffset = wad.readInt16At(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 0, 8);
        var textureYOffset = wad.readInt16At(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 2, 8);

        var frontTopTexture = wad.readStringAt(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 4, 8);
        var frontBottomTexture = wad.readStringAt(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 12, 8);
        var frontMiddleTexture = wad.readStringAt(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 20, 8);
        
        // If this is a one-sided wall
        if (leftSideDefIndex == -1) {
            if (frontMiddleTexture != '-') {
                buildSingleWallSectionGeometry(scene, materialManager, frontMiddleTexture, faceIndex, v0x, v0y, frontSectorFloorHeight, v1x, v1y, frontSectorCeilingHeight, textureXOffset, textureYOffset);
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

            // Bottom section of front side
            if (frontBottomTexture != '-' && frontSectorFloorHeight < backSectorFloorHeight) {
                buildSingleWallSectionGeometry(scene, materialManager, frontBottomTexture, faceIndex, v0x, v0y, frontSectorFloorHeight, v1x, v1y, backSectorFloorHeight, 0, 0);
                faceIndex++;
            }

            // Top section of front side
            if (frontTopTexture != '-' && backSectorCeilingHeight < frontSectorCeilingHeight) {
                buildSingleWallSectionGeometry(scene, materialManager, frontTopTexture, faceIndex, v0x, v0y, backSectorCeilingHeight, v1x, v1y, frontSectorCeilingHeight, 0, 0);
                faceIndex++;
            }

            // Bottom section of back side
            if (backBottomTexture != '-' && backSectorFloorHeight < frontSectorFloorHeight) {
                buildSingleWallSectionGeometry(scene, materialManager, backBottomTexture, faceIndex, v1x, v1y, backSectorFloorHeight, v0x, v0y, frontSectorFloorHeight, 0, 0);
                faceIndex++;
            }

            // Top section of back side
            if (backTopTexture != '-' && frontSectorCeilingHeight < backSectorCeilingHeight) {
                buildSingleWallSectionGeometry(scene, materialManager, backTopTexture, faceIndex, v1x, v1y, frontSectorCeilingHeight, v0x, v0y, backSectorCeilingHeight, 0, 0);
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
        texturesByTexname: {},
        materialsByTexname: {},
        wad: wad,

        getMaterial: materialManager_getMaterial
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

    var mapLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("MAP03", 0);

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

        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    animate();
}

function loadWad() {
    var myRequest = new Request('doom2.wad');

    var wad = {
        bytes: null,
        NumLumps: null,
        DirectoryOffset: null
    };

    function readByteAt(offset) { 
        return wad.bytes[offset];
    }

    function readInt32At(offset) {
        var val =
            (wad.bytes[offset    ] << 0) + 
            (wad.bytes[offset + 1] << 8) +
            (wad.bytes[offset + 2] << 16) +
            (wad.bytes[offset + 3] << 24);

        return val;
    }

    
    function readInt16At(offset) {
        var val =
            (wad.bytes[offset    ] << 0) + 
            (wad.bytes[offset + 1] << 8);

        if (val > 32767) {
            val = -65536 + val;
        }

        return val;
    }

    function readStringAt(offset, maxLength) {
        var s = "";

        var i = 0;

        do {
            var b = wad.bytes[offset + i];

            if (b) {
                s += String.fromCharCode(b);
            }

            i++;
        } while (i < maxLength);

        return s;
    }

    function dumpLumps() {
        for (var i = 0; i < wad.NumLumps; i++) {
            var directoryEntryOffset = wad.DirectoryOffset + i * 16;
            
            var lumpName = readStringAt(directoryEntryOffset + 8, 8);

            window.console.log(lumpName);
        }
    }

    function getFirstMatchingLumpAfterSpecifiedLumpIndex(name, startIndex) {
        for (var i = startIndex; i < wad.NumLumps; i++) {
            var directoryEntryOffset = wad.DirectoryOffset + i * 16;
            
            var lumpName = readStringAt(directoryEntryOffset + 8, 8);

            if (lumpName == name) {
                return {
                    offset: readInt32At(directoryEntryOffset),
                    length: readInt32At(directoryEntryOffset + 4),
                    name: name,
                    lumpIndex: i
                };
            }
        }
    }

    return (
        fetch(myRequest)
        .then(response => response.blob())
        .then(blob => blob.arrayBuffer())
        .then(arrayBuffer => {
            wad.bytes = new Uint8Array(arrayBuffer);

            wad.NumLumps = readInt32At(4);
            wad.DirectoryOffset = readInt32At(8);

            wad.getFirstMatchingLumpAfterSpecifiedLumpIndex = getFirstMatchingLumpAfterSpecifiedLumpIndex;
            wad.readByteAt = readByteAt;
            wad.readInt16At = readInt16At;
            wad.readInt32At = readInt32At;
            wad.readStringAt = readStringAt;

            return wad;
        })
    );
}

function render2dMapToCanvas(wad) {
    var canvas = document.getElementById('mainCanvas');

    canvas.style.display = "inline-block";

    var ctx = canvas.getContext('2d');

    var mapLumpInfo =    wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("MAP01", 0);
    var lineDefsLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("LINEDEFS", mapLumpInfo.lumpIndex);
    var vertexesLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("VERTEXES", mapLumpInfo.lumpIndex);

    var scaleFactor = 0.25;
    var xOffset = 400;
    var yOffset = 800;

    var numberOfLineDefs = lineDefsLumpInfo.length / 14;

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
        ctx.stroke();
    }
}

//loadWad().then(render2dMapToCanvas);
loadWad().then(renderToThreeJs);