"""
SmartFace IP Camera Stream Pusher Utility
==========================================
Captures frames from a local webcam or USB camera and streams them
to the Bus/Gate Camera API Server (http://143.244.140.108:10000/upload).

Usage:
    python push_webcam_to_api.py
    python push_webcam_to_api.py --cam 0 --interval 1.5 --preview
    python push_webcam_to_api.py --cam 0 --no-preview
"""

import sys
import time
import argparse
import datetime
import urllib.request
import urllib.error
import cv2

DEFAULT_SERVER_URL = "http://143.244.140.108:10000/upload"

def main():
    parser = argparse.ArgumentParser(description="Push local camera frames to SmartFace IP Camera API")
    parser.add_argument("--cam", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument("--url", type=str, default=DEFAULT_SERVER_URL, help="Target API upload URL")
    parser.add_argument("--interval", type=float, default=1.5, help="Upload interval in seconds (default: 1.5)")
    parser.add_argument("--no-preview", action="store_true", help="Run in headless mode without preview window")
    parser.add_argument("--lat", type=str, default="28.593055", help="Latitude metadata")
    parser.add_argument("--lon", type=str, default="77.466884", help="Longitude metadata")
    args = parser.parse_args()

    print(f"==================================================")
    print(f" SmartFace Live Camera Pusher")
    print(f" Target Server : {args.url}")
    print(f" Camera Index  : {args.cam}")
    print(f" Upload Rate   : Every {args.interval}s")
    print(f" Mode          : {'Headless (No GUI)' if args.no_preview else 'GUI Preview (Press Q to quit)'}")
    print(f"==================================================")

    cap = cv2.VideoCapture(args.cam)
    if not cap.isOpened():
        print(f"[ERROR] Could not open camera with index {args.cam}!")
        print("Tip: If you have an external USB camera, try --cam 1 or --cam 2.")
        sys.exit(1)

    # Set recommended resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    last_upload_time = 0
    upload_count = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                print("[WARNING] Frame grab failed, retrying...")
                time.sleep(0.1)
                continue

            current_time = time.time()
            if (current_time - last_upload_time) >= args.interval:
                now_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                file_name = f"E_{now_str}_LAT{args.lat}_LON{args.lon}.jpg"

                # Encode to JPEG
                success, encoded_img = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                if success:
                    jpeg_bytes = encoded_img.tobytes()
                    req = urllib.request.Request(
                        args.url,
                        data=jpeg_bytes,
                        headers={
                            "X-File-Name": file_name,
                            "Content-Type": "image/jpeg",
                            "User-Agent": "SmartFace-Webcam-Pusher/1.0"
                        },
                        method="POST"
                    )
                    try:
                        with urllib.request.urlopen(req, timeout=3.0) as resp:
                            upload_count += 1
                            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Frame #{upload_count} uploaded -> {file_name} (Size: {len(jpeg_bytes)//1024} KB)")
                    except Exception as e:
                        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [UPLOAD ERROR]: {e}")
                    
                    last_upload_time = current_time

            if not args.no_preview:
                # Add status text to preview window
                disp = frame.copy()
                cv2.putText(
                    disp,
                    f"SmartFace Streaming -> API ({upload_count} frames)",
                    (15, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (0, 255, 0),
                    2
                )
                cv2.imshow("SmartFace Camera Pusher (Press Q to stop)", disp)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("[INFO] User stopped streaming.")
                    break

    except KeyboardInterrupt:
        print("\n[INFO] Stream pusher stopped by user.")
    finally:
        cap.release()
        if not args.no_preview:
            cv2.destroyAllWindows()
        print("[INFO] Camera released cleanly.")

if __name__ == "__main__":
    main()
