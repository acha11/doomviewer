## Todo

* Spawn at correct height and look angle
* Stick to floor
* Skybox
* Accelerating movement
* Correctly handle transparent textures like those to the player's left (near the chainsaw) at the start of Doom 2 MAP01
* Animated floors and ceilings
* Animated Walls
* Things
* Bundle geometry with same material to reduce draw calls
* Flickering lights

## Done

* Render back middle walls (e.g. gratings on "windows" user starts looking at on MAP26)
* Triangulation: Don't ignore sectors whose perimeter kisses itself 
* Set brightness of floors, walls and ceilings based on sector
* Triangulation: Handle failure to detect winding of sector path due to imprecision causing value above 1.0 being passed to Math.acos()
* Triangulation: Don't crash on open sectors
* Triangulation: Don't ignore sectors that have internal lines
* Floors and ceilings
* Walls