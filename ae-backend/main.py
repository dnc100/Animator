import cv2
import numpy as np
import tempfile
import os
import math
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Auto-Animator Vector Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def extract_stable_shape(contour, num_points=40):
    """
    Resamples the contour to a fixed number of points and ANCHORS Point 0 
    to the top-left to prevent After Effects from twisting the shape.
    """
    pts = contour.reshape(-1, 2)
    # Close polygon
    pts = np.vstack((pts, pts[0]))
    
    # Calculate perimeter distances
    diffs = np.diff(pts, axis=0)
    dists = np.linalg.norm(diffs, axis=1)
    cum_dists = np.concatenate(([0], np.cumsum(dists)))
    total_dist = cum_dists[-1]
    
    if total_dist == 0:
        return [{"x": float(pts[0][0]), "y": float(pts[0][1])} for _ in range(num_points)]
        
    # Interpolate exact target distances for evenly spaced points
    target_dists = np.linspace(0, total_dist, num_points, endpoint=False)
    x_interp = np.interp(target_dists, cum_dists, pts[:, 0])
    y_interp = np.interp(target_dists, cum_dists, pts[:, 1])
    
    resampled = [{"x": round(float(x), 2), "y": round(float(y), 2)} for x, y in zip(x_interp, y_interp)]
    
    # --- THE ANCHOR FIX ---
    # Find the top-left-most point (lowest x + y value)
    anchor_idx = min(range(num_points), key=lambda i: resampled[i]["x"] + resampled[i]["y"])
    
    # Roll the array so the anchor is always at index 0. This stops AE from twisting!
    stabilized = resampled[anchor_idx:] + resampled[:anchor_idx]
    
    return stabilized

@app.post("/api/track")
async def track_video(file: UploadFile = File(...)):
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video.")

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    try:
        content = await file.read()
        temp_file.write(content)
        temp_file.close()

        cap = cv2.VideoCapture(temp_file.name)
        if not cap.isOpened():
            raise HTTPException(status_code=500, detail="Could not open video file.")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        
        tracks = {}           
        active_objects = {}   
        next_track_id = 1
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break 
                
            # --- UPGRADED: OTSU'S AUTOMATIC THRESHOLDING ---
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            # The '0' is a placeholder. THRESH_OTSU mathematically finds the optimal split 
            # between the dark red background and the bright yellow shapes.
            _, binary_mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
            contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            valid_contours = [c for c in contours if cv2.contourArea(c) > 50]
            valid_contours = sorted(valid_contours, key=cv2.contourArea, reverse=True)
            
            accepted_objects = []
            
            for c in valid_contours:
                M = cv2.moments(c)
                if M['m00'] == 0: continue
                cx = int(M['m10'] / M['m00'])
                cy = int(M['m01'] / M['m00'])
                
                # --- THE FIX: Calculate Aspect Ratio ---
                # Grab the bounding box to figure out if it's a circle or a flat line
                x, y, w, h = cv2.boundingRect(c)
                aspect_ratio = float(w) / float(h)
                
                normalized_shape = extract_stable_shape(c, num_points=40)
                accepted_objects.append((cx, cy, normalized_shape, aspect_ratio))
            
            time_sec = float(frame_idx / fps)
            current_active_objects = {}
            used_accepted_indices = set()
            
            # Match existing tracks using Distance + Aspect Ratio Profile
            for obj_id, obj_data in active_objects.items():
                ox, oy, o_ar = obj_data["x"], obj_data["y"], obj_data["aspect_ratio"]
                best_match_idx = None
                best_cost = float('inf')
                
                for i, (cx, cy, shape_pts, ar) in enumerate(accepted_objects):
                    if i in used_accepted_indices: continue
                    
                    dist = math.hypot(cx - ox, cy - oy)
                    
                    # --- THE FIX: The Cost Function ---
                    # If the shape changes from a ball (1.0) to a line (10.0), it adds a massive penalty
                    ar_diff = abs(ar - o_ar)
                    cost = dist + (ar_diff * 100) # Heavy penalty for changing shape
                    
                    # Only accept if it's geographically close enough AND has the best cost
                    if cost < best_cost and dist < 200: 
                        best_cost = cost
                        best_match_idx = i
                
                if best_match_idx is not None:
                    cx, cy, shape_pts, ar = accepted_objects[best_match_idx]
                    used_accepted_indices.add(best_match_idx)
                    
                    tracks[obj_id].append({"time": round(time_sec, 3), "path": shape_pts})
                    current_active_objects[obj_id] = {
                        "x": cx, "y": cy, "aspect_ratio": ar, "lost_frames": 0
                    }
                else:
                    if obj_data["lost_frames"] < 5:
                        current_active_objects[obj_id] = {
                            "x": ox, "y": oy, "aspect_ratio": o_ar, 
                            "lost_frames": obj_data["lost_frames"] + 1
                        }

            # Register new tracks
            for i, (cx, cy, shape_pts, ar) in enumerate(accepted_objects):
                if i not in used_accepted_indices:
                    tracks[next_track_id] = [{"time": round(time_sec, 3), "path": shape_pts}]
                    current_active_objects[next_track_id] = {
                        "x": cx, "y": cy, "aspect_ratio": ar, "lost_frames": 0
                    }
                    next_track_id += 1

            active_objects = current_active_objects
            frame_idx += 1

        cap.release()
        
        final_tracks = {}
        clean_id = 1
        for t_id, points in tracks.items():
            if len(points) > 5:
                final_tracks[str(clean_id)] = points
                clean_id += 1

        return JSONResponse(content={"tracks": final_tracks})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Processing error")
    finally:
        if os.path.exists(temp_file.name):
            os.remove(temp_file.name)

@app.get("/")
def health_check():
    return {"status": "CV Backend is running!"}