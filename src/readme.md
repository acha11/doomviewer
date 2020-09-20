## Todo

* Render Back middle walls (e.g. gratings on hallway intersection on MAP26)
* Clip camera movement to geometry
* Animated floors and ceilings
* Skybox
* Animated Walls
* Spawn at correct height and look angle
* Stick to floor
* Things
* Bundle geometry with same material to reduce draw calls
* Player as light source (to approximate original's distance-based falloff)
* Things as light sources?
* Ambient occlusion?

## Done

* Triangulation: Don't ignore sectors whose perimeter kisses itself 
* Set brightness of floors, walls and ceilings based on sector
* Triangulation: Handle failure to detect winding of sector path due to imprecision causing value above 1.0 being passed to Math.acos()
* Triangulation: Don't crash on open sectors
* Triangulation: Don't ignore sectors that have internal lines
* Floors and ceilings
* Walls