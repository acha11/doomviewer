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


import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls.js';


var clock = new Clock();

function buildGeometryForWallSection(geometry, faceIndex, v0x, v0y, bottom, v1x, v1y, top) {
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

    geometry.faceVertexUvs[0].push([new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1)]);
    geometry.faceVertexUvs[0].push([new Vector2(1, 1), new Vector2(0, 1), new Vector2(0, 0)]);
    
    var normal = new Vector3(0, 0, 1);
    var materialIndex = 0;
    geometry.faces.push(new Face3(faceIndex * 6 + 3, faceIndex * 6 + 4, faceIndex * 6 + 5, normal, color, materialIndex));
}

function fillTextureArrayWithTestPattern(data, width, height) {
    var size = width * height;

    for ( var i = 0; i < size; i ++ ) {
        var stride = i * 3;

        data[stride] = 0;
        data[stride + 1] = i / 256;
        data[stride + 2] = i % 256;
    }
}

function buildTexture(wad, textureName) {
//            fillTextureArrayWithTestPattern(data, width, height);

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

        if (foundTextureName == textureName) {
            var texWidth = wad.readInt16At(absoluteOffsetToTextureInfo + 12);
            var texHeight = wad.readInt16At(absoluteOffsetToTextureInfo + 14);

            var width = 64;
            var height = 128;

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

                for (var col = 0; col < picWidth; col++) {
                    var colOffset = wad.readInt32At(picLump.offset + 8 + col * 4) + picLump.offset;

                    var currentRow = wad.readByteAt(colOffset);

                    var postOffset = colOffset + 1;
                    
                    do {
                        var pixelsInRun = wad.readByteAt(postOffset);

                        if (pixelsInRun == 255) {
                            break;
                        }

                        for (var pixelOffset = postOffset + 3; pixelOffset < postOffset + 3 + pixelsInRun - 2; pixelOffset++) {
                            var colorIndex = wad.readByteAt(pixelOffset);

                            data[((height - currentRow - 1) * width + col) * 3 + 0] = palette[colorIndex * 3];
                            data[((height - currentRow - 1) * width + col) * 3 + 1] = palette[colorIndex * 3 + 1];
                            data[((height - currentRow - 1) * width + col) * 3 + 2] = palette[colorIndex * 3 + 2];

                            currentRow++;
                        }

                        postOffset += pixelsInRun + 3;
                    } while (pixelsInRun != 255);
                }
            }

            var texture = new DataTexture(data, width, height, RGBFormat);

            return texture;
        }
    }
}

function materialManager_getMaterial(texname) {
    var material = this.materialsByTexname[texname];

    if (!material) {
        // Textures
        this.texturesByTexname[texname] = buildTexture(this.wad, texname);

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

function buildSingleWallSectionGeometry(scene, materialManager, texname, faceIndex, v0x, v0y, bottom, v1x, v1y, top) {
    var geometry = new Geometry();

    buildGeometryForWallSection(geometry, 0, v0x, v0y, bottom, v1x, v1y, top);

    geometry.computeFaceNormals();
    geometry.computeVertexNormals();

    scene.add(new Mesh(geometry, materialManager.getMaterial(texname)));
}

function buildScene(wad, scene, materialManager) {
    var map01LumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("MAP01", 0);
    var lineDefsLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("LINEDEFS", map01LumpInfo.lumpIndex);
    var vertexesLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("VERTEXES", map01LumpInfo.lumpIndex);
    var sidedefsLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("SIDEDEFS", map01LumpInfo.lumpIndex);
    var sectorsLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("SECTORS", map01LumpInfo.lumpIndex);

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

        var frontTopTexture = wad.readStringAt(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 4, 8);
        var frontBottomTexture = wad.readStringAt(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 12, 8);
        var frontMiddleTexture = wad.readStringAt(sidedefsLumpInfo.offset + rightSideDefIndex * 30 + 20, 8);
        
        // If this is a one-sided wall
        if (leftSideDefIndex == -1) {
            if (frontMiddleTexture != '-') {
                buildSingleWallSectionGeometry(scene, materialManager, frontMiddleTexture, faceIndex, v0x, v0y, frontSectorFloorHeight, v1x, v1y, frontSectorCeilingHeight);
                faceIndex++;
            }
        } else {
            // This is a two-sided wall - read the far-side's details
            var leftSectorIndex = wad.readInt16At(sidedefsLumpInfo.offset + leftSideDefIndex * 30 + 28);
            var backSectorFloorHeight = wad.readInt16At(sectorsLumpInfo.offset + leftSectorIndex * 26 + 0);
            var backSectorCeilingHeight = wad.readInt16At(sectorsLumpInfo.offset + leftSectorIndex * 26 + 2);

            var backTopTexture = wad.readStringAt(sidedefsLumpInfo.offset + leftSideDefIndex * 30 + 4);
            var backBottomTexture = wad.readStringAt(sidedefsLumpInfo.offset + leftSideDefIndex * 30 + 12);
            var backMiddleTexture = wad.readStringAt(sidedefsLumpInfo.offset + leftSideDefIndex * 30 + 20);

            // Bottom section of front side
            if (frontBottomTexture != '-' && frontSectorFloorHeight != backSectorFloorHeight) {
                buildSingleWallSectionGeometry(scene, materialManager, frontBottomTexture, faceIndex, v0x, v0y, frontSectorFloorHeight, v1x, v1y, backSectorFloorHeight);
                faceIndex++;
            }

            // Top section of front side
            if (frontTopTexture != '-' && backSectorCeilingHeight != frontSectorCeilingHeight) {
                buildSingleWallSectionGeometry(scene, materialManager, frontTopTexture, faceIndex, v0x, v0y, backSectorCeilingHeight, v1x, v1y, frontSectorCeilingHeight);
                faceIndex++;
            }

            // Bottom section of back side
            if (backBottomTexture != '-' && frontSectorFloorHeight != backSectorFloorHeight) {
                buildSingleWallSectionGeometry(scene, materialManager, backBottomTexture, faceIndex, v1x, v1y, backSectorFloorHeight, v0x, v0y, frontSectorFloorHeight);
                faceIndex++;
            }

            // Top section of back side
            if (backTopTexture != '-' && backSectorCeilingHeight != frontSectorCeilingHeight) {
                buildSingleWallSectionGeometry(scene, materialManager, backTopTexture, faceIndex, v1x, v1y, frontSectorCeilingHeight, v0x, v0y, backSectorCeilingHeight);
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



    

    var controls = new FirstPersonControls(camera);
    controls.lookSpeed = 0.4;
    controls.movementSpeed = 200;
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

    buildScene(wad, scene, materialManager);

    camera.position.y = 1000;
    camera.position.z = 500;
    camera.rotation.x = -0.75;
    camera.rotation.y = -0.2;

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

    var map01LumpInfo =    wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("MAP01", 0);
    var lineDefsLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("LINEDEFS", map01LumpInfo.lumpIndex);
    var vertexesLumpInfo = wad.getFirstMatchingLumpAfterSpecifiedLumpIndex("VERTEXES", map01LumpInfo.lumpIndex);

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