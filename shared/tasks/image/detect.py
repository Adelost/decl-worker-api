"""
YOLO-based detection, segmentation, and pose estimation.
Uses ultralytics library.
"""

from typing import Optional

from ..decorator import task


@task(
    name="yolo.detect",
    category="image",
    capabilities=["detect", "objects"],
    gpu="T4",
    timeout=300,
)
def detect(
    image_path: str,
    model: str = "yolo11n.pt",
    conf: float = 0.25,
    iou: float = 0.45,
    classes: Optional[list[int]] = None,
    device: str = "cuda",
) -> list[dict]:
    """Detect objects in image using YOLO."""
    from ultralytics import YOLO

    yolo = YOLO(model)
    results = yolo.predict(
        image_path,
        conf=conf,
        iou=iou,
        classes=classes,
        device=device,
        verbose=False,
    )

    detections = []
    for r in results:
        for i, box in enumerate(r.boxes):
            detections.append({
                "bbox": box.xyxy[0].tolist(),
                "class_id": int(box.cls[0]),
                "class_name": r.names[int(box.cls[0])],
                "confidence": float(box.conf[0]),
            })

    return detections


@task(
    name="yolo.segment",
    category="image",
    capabilities=["segment", "instances"],
    gpu="T4",
    timeout=300,
)
def segment(
    image_path: str,
    model: str = "yolo11n-seg.pt",
    conf: float = 0.25,
    device: str = "cuda",
) -> list[dict]:
    """Instance segmentation using YOLO-Seg."""
    from ultralytics import YOLO

    yolo = YOLO(model)
    results = yolo.predict(
        image_path,
        conf=conf,
        device=device,
        verbose=False,
    )

    segments = []
    for r in results:
        if r.masks is None:
            continue
        for i, (box, mask) in enumerate(zip(r.boxes, r.masks)):
            segments.append({
                "bbox": box.xyxy[0].tolist(),
                "class_id": int(box.cls[0]),
                "class_name": r.names[int(box.cls[0])],
                "confidence": float(box.conf[0]),
                "mask": mask.data[0].cpu().numpy().astype(bool).tolist(),
            })

    return segments


@task(
    name="yolo.pose",
    category="image",
    capabilities=["pose", "keypoints"],
    gpu="T4",
    timeout=300,
)
def pose(
    image_path: str,
    model: str = "yolo11n-pose.pt",
    conf: float = 0.25,
    device: str = "cuda",
) -> list[dict]:
    """Pose estimation using YOLO-Pose."""
    from ultralytics import YOLO

    yolo = YOLO(model)
    results = yolo.predict(
        image_path,
        conf=conf,
        device=device,
        verbose=False,
    )

    poses = []
    for r in results:
        if r.keypoints is None:
            continue
        for i, (box, kpts) in enumerate(zip(r.boxes, r.keypoints)):
            keypoints = []
            for j, kpt in enumerate(kpts.data[0]):
                keypoints.append({
                    "x": float(kpt[0]),
                    "y": float(kpt[1]),
                    "confidence": float(kpt[2]) if len(kpt) > 2 else 1.0,
                })
            poses.append({
                "bbox": box.xyxy[0].tolist(),
                "confidence": float(box.conf[0]),
                "keypoints": keypoints,
            })

    return poses


@task(
    name="yolo.detect_batch",
    category="image",
    capabilities=["detect", "objects", "batch"],
    gpu="T4",
    timeout=600,
)
def detect_batch(
    image_paths: list[str],
    model: str = "yolo11n.pt",
    conf: float = 0.25,
    device: str = "cuda",
) -> list[list[dict]]:
    """Batch detection for multiple images."""
    from ultralytics import YOLO

    yolo = YOLO(model)
    results = yolo.predict(
        image_paths,
        conf=conf,
        device=device,
        verbose=False,
    )

    all_detections = []
    for r in results:
        detections = []
        for box in r.boxes:
            detections.append({
                "bbox": box.xyxy[0].tolist(),
                "class_id": int(box.cls[0]),
                "class_name": r.names[int(box.cls[0])],
                "confidence": float(box.conf[0]),
            })
        all_detections.append(detections)

    return all_detections


@task(
    name="yolo.track",
    category="image",
    capabilities=["track", "objects", "video"],
    gpu="T4",
    timeout=600,
)
def track(
    video_path: str,
    model: str = "yolo11n.pt",
    conf: float = 0.25,
    tracker: str = "bytetrack.yaml",
    device: str = "cuda",
) -> list[dict]:
    """Track objects in video using YOLO + ByteTrack."""
    from ultralytics import YOLO

    yolo = YOLO(model)
    results = yolo.track(
        video_path,
        conf=conf,
        tracker=tracker,
        device=device,
        verbose=False,
        persist=True,
    )

    tracks = []
    for frame_idx, r in enumerate(results):
        if r.boxes.id is None:
            continue
        for box in r.boxes:
            if box.id is None:
                continue
            tracks.append({
                "frame": frame_idx,
                "track_id": int(box.id[0]),
                "bbox": box.xyxy[0].tolist(),
                "class_id": int(box.cls[0]),
                "class_name": r.names[int(box.cls[0])],
                "confidence": float(box.conf[0]),
            })

    return tracks
