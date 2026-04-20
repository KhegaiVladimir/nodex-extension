# MediaPipe Face Mesh — Landmark Reference

Total landmarks: **468** (standard) / **478** (with `REFINE_LANDMARKS: true`, adds iris ring)

## Landmarks Used by Nodex

### Head Pose

| Index | Location | Used for |
|---|---|---|
| 1 | Nose tip | Yaw, Pitch anchor |
| 10 | Forehead center | Pitch reference (top) |
| 152 | Chin | Pitch reference (bottom) |
| 234 | Left cheek side | Yaw left edge, Roll |
| 454 | Right cheek side | Yaw right edge, Roll |

### Right Eye (EAR computation)

| Index | Location |
|---|---|
| 33 | Outer corner |
| 133 | Inner corner |
| 145 | Lower lid (primary) |
| 153 | Lower lid (secondary) |
| 158 | Upper lid (secondary) |
| 159 | Upper lid (primary) |

### Left Eye (EAR computation)

| Index | Location |
|---|---|
| 263 | Outer corner |
| 362 | Inner corner |
| 374 | Lower lid (primary) |
| 380 | Lower lid (secondary) |
| 385 | Upper lid (secondary) |
| 386 | Upper lid (primary) |

### Iris (refined landmarks only, `REFINE_LANDMARKS: true`)

Right iris (indices 468–471 in 0-based, shown as 469–472 in some docs):

| Index | Location |
|---|---|
| 469 | Right iris right point |
| 470 | Right iris top point |
| 471 | Right iris left point |
| 472 | Right iris bottom point |

Left iris:

| Index | Location |
|---|---|
| 474 | Left iris right point |
| 475 | Left iris top point |
| 476 | Left iris left point |
| 477 | Left iris bottom point |

### Mouth

| Index | Location |
|---|---|
| 13 | Upper lip center |
| 14 | Lower lip center |
| 78 | Left mouth corner |
| 308 | Right mouth corner |

## Coordinate System

- `x`, `y`: normalized 0.0–1.0 within the image frame (0,0 = top-left)
- `z`: depth relative to nose tip, normalized. Negative = closer to camera.
- Webcam is typically mirrored horizontally → left in image = user's right

**Sign convention in Nodex:** yaw is inverted after computation to account for mirror. Positive yaw = user's head turned right.

## EAR Formula

```
EAR = (vertical_1 + vertical_2) / (2 × horizontal)

vertical_1 = distance(upper_primary, lower_primary)
vertical_2 = distance(upper_secondary, lower_secondary)
horizontal = distance(inner_corner, outer_corner)
```

Both eyes computed, then averaged.

## Iris Openness Formula (refined only)

```
openness = vertical_iris_extent / horizontal_eye_width

vertical_iris_extent = distance(iris_top, iris_bottom)
horizontal_eye_width = distance(inner_corner, outer_corner)
```

## Full Landmark Map

The complete 468-landmark mesh is documented in MediaPipe's canonical index at:
https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png

For the mesh connectivity, see MediaPipe's face mesh topology documentation. The subset Nodex uses covers the minimum landmarks needed for head pose + blink detection.
