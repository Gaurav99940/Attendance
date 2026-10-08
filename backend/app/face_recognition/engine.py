import os
import cv2
import base64
import numpy as np
import torch
from torchvision import transforms
from PIL import Image
import logging
from typing import List, Tuple, Optional, Dict, Any
from facenet_pytorch import InceptionResnetV1, MTCNN
from app.config.settings import settings

logger = logging.getLogger("smartface.vision")
logging.basicConfig(level=logging.INFO)

class FaceRecognitionEngine:
    _instance = None

    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Initializing Face Recognition Engine on device: {self.device}")
        
        # 1. Load FaceNet InceptionResnetV1 model for 512-D biometric embeddings
        try:
            self.model = InceptionResnetV1(pretrained='vggface2').eval().to(self.device)
            logger.info("FaceNet InceptionResnetV1 model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load FaceNet model: {e}")
            self.model = None

        # 2. MTCNN detector for high precision bounding box extraction and landmarks
        try:
            self.mtcnn = MTCNN(
                keep_all=True,
                device=self.device,
                min_face_size=35,
                thresholds=[0.6, 0.7, 0.7],
                post_process=False
            )
            logger.info("MTCNN face detector initialized successfully.")
        except Exception as e:
            logger.warning(f"MTCNN initialization note: {e}")
            self.mtcnn = None

        # Transform pipeline for cropped face to InceptionResnetV1 input (160x160 normalized tensor)
        self.transform = transforms.Compose([
            transforms.Resize((160, 160)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
        ])

        # In-memory embeddings cache: { employeeId: [ [embedding_512], ... ] }
        self.embeddings_cache: Dict[str, List[np.ndarray]] = {}
        self.employee_meta_cache: Dict[str, Dict[str, Any]] = {}
        self.is_cache_loaded = False

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = FaceRecognitionEngine()
        return cls._instance

    def load_embeddings_from_db(self, db):
        """Loads and caches all face embeddings and employee metadata from MongoDB"""
        try:
            self.embeddings_cache.clear()
            self.employee_meta_cache.clear()

            # Load active employees
            employees = list(db.employees.find({"status": "Active"}))
            for emp in employees:
                emp_id = emp.get("employeeId")
                self.employee_meta_cache[emp_id] = {
                    "employeeId": emp_id,
                    "name": emp.get("name", "Unknown"),
                    "department": emp.get("department", "General"),
                    "designation": emp.get("designation", "Staff"),
                    "profilePhoto": emp.get("profilePhoto", ""),
                    "shiftId": emp.get("shiftId", "shift_general")
                }

            # Load embeddings
            embeddings_docs = list(db.face_embeddings.find({}))
            for doc in embeddings_docs:
                emp_id = doc.get("employeeId")
                emb_list = doc.get("embedding")
                if emp_id and emb_list:
                    emb_arr = np.array(emb_list, dtype=np.float32)
                    norm = np.linalg.norm(emb_arr)
                    if norm > 0:
                        emb_arr = emb_arr / norm  # Ensure normalized L2 unit vector
                    if emp_id not in self.embeddings_cache:
                        self.embeddings_cache[emp_id] = []
                    self.embeddings_cache[emp_id].append(emb_arr)

            self.is_cache_loaded = True
            logger.info(f"Loaded face cache: {len(self.embeddings_cache)} employees with embeddings, {len(self.employee_meta_cache)} metadata.")
        except Exception as e:
            logger.error(f"Error loading embeddings cache from DB: {e}")

    def detect_faces(self, image: Any) -> List[Tuple[int, int, int, int]]:
        """Extracts face bounding boxes [x, y, w, h] using MTCNN detector"""
        if isinstance(image, np.ndarray):
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb)
        elif isinstance(image, Image.Image):
            pil_image = image
        else:
            return []

        if self.mtcnn is None:
            w, h = pil_image.size
            return [(0, 0, w, h)]
        try:
            boxes, probs = self.mtcnn.detect(pil_image)
            if boxes is None or len(boxes) == 0:
                return []
            
            clean_boxes = []
            img_w, img_h = pil_image.size
            for box in boxes:
                x1, y1, x2, y2 = box
                x = max(0, int(x1))
                y = max(0, int(y1))
                w = min(img_w - x, int(x2 - x1))
                h = min(img_h - y, int(y2 - y1))
                if w >= 20 and h >= 20:
                    clean_boxes.append((x, y, w, h))
            return clean_boxes
        except Exception as e:
            logger.error(f"MTCNN detection error: {e}")
            return []

    def generate_embedding_from_crop(self, rgb_crop: Image.Image) -> Optional[np.ndarray]:
        """Generates a 512-D L2-normalized embedding vector from a cropped PIL face image"""
        if self.model is None:
            return None
        try:
            tensor = self.transform(rgb_crop).unsqueeze(0).to(self.device)
            with torch.no_grad():
                embedding = self.model(tensor).cpu().numpy().flatten()
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            return embedding
        except Exception as e:
            logger.error(f"Embedding generation error: {e}")
            return None

    def process_image_for_registration(self, image_bytes: bytes) -> Tuple[bool, Optional[np.ndarray], Optional[str], Optional[Tuple[int, int, int, int]]]:
        """
        Validates uploaded image during employee registration:
        1. Checks face presence using MTCNN
        2. Crops detected face
        3. Generates 512-D embedding
        Returns: (success, embedding_array, error_message, bbox)
        """
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img_bgr is None:
                return False, None, "Invalid image format.", None

            rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)
            faces = self.detect_faces(pil_img)

            if len(faces) == 0:
                # If MTCNN didn't find clear face, try central crop fallback
                w, h = pil_img.size
                min_dim = min(w, h)
                left = (w - min_dim) // 2
                top = (h - min_dim) // 2
                crop_pil = pil_img.crop((left, top, left + min_dim, top + min_dim))
                emb = self.generate_embedding_from_crop(crop_pil)
                if emb is not None:
                    return True, emb, None, (left, top, min_dim, min_dim)
                return False, None, "No face detected in the image. Please provide a clear front-facing photo.", None

            # Sort by area to take primary face
            faces.sort(key=lambda b: b[2] * b[3], reverse=True)
            x, y, w, h = faces[0]

            # Add padding
            img_w, img_h = pil_img.size
            pad_x = int(w * 0.15)
            pad_y = int(h * 0.15)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(img_w, x + w + pad_x)
            y2 = min(img_h, y + h + pad_y)

            crop_pil = pil_img.crop((x1, y1, x2, y2))
            embedding = self.generate_embedding_from_crop(crop_pil)

            if embedding is None:
                return False, None, "Failed to compute face embedding.", None

            return True, embedding, None, (x, y, w, h)
        except Exception as e:
            logger.error(f"Image registration processing failed: {e}")
            return False, None, str(e), None

    def match_embedding(self, query_embedding: np.ndarray, threshold: float = 0.60) -> Tuple[Optional[str], float, float]:
        """
        Compares query embedding with all stored embeddings using cosine similarity.
        Returns: (matched_employee_id, cosine_similarity, confidence_percentage)
        """
        if query_embedding is None or not self.embeddings_cache:
            return None, 0.0, 0.0

        best_match_id = None
        best_sim = -1.0

        for emp_id, emb_list in self.embeddings_cache.items():
            for emb in emb_list:
                sim = float(np.dot(query_embedding, emb))
                if sim > best_sim:
                    best_sim = sim
                    best_match_id = emp_id

        # Normalize score to human-readable confidence % (0.35 -> 0%, 0.85 -> 99.9%)
        confidence_percent = round(float(np.clip((best_sim - 0.35) / 0.50 * 100.0, 0.0, 99.9)), 1)

        if best_sim >= threshold and best_match_id is not None:
            return best_match_id, best_sim, confidence_percent
        else:
            return None, best_sim, confidence_percent

    def decode_base64_frame(self, base64_str: str) -> Optional[np.ndarray]:
        """Decodes base64 string or data URL to OpenCV BGR image"""
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]
            img_bytes = base64.b64decode(base64_str)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            logger.error(f"Failed to decode base64 frame: {e}")
            return None

    def process_frame(self, bgr_image: np.ndarray, threshold: float = 0.60) -> List[Dict[str, Any]]:
        """
        Processes a camera frame:
        1. Detects all faces
        2. Extracts embeddings for each face
        3. Matches with employee database
        4. Returns structured detections with bbox, employee info, confidence
        """
        results = []
        if bgr_image is None:
            return results

        rgb_image = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb_image)
        faces = self.detect_faces(pil_img)
        img_w, img_h = pil_img.size

        for (x, y, w, h) in faces:
            pad_x = int(w * 0.1)
            pad_y = int(h * 0.1)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(img_w, x + w + pad_x)
            y2 = min(img_h, y + h + pad_y)

            crop_pil = pil_img.crop((x1, y1, x2, y2))
            if crop_pil.size[0] == 0 or crop_pil.size[1] == 0:
                continue

            # Convert crop to BGR for verification image saving
            face_crop_bgr = cv2.cvtColor(np.array(crop_pil), cv2.COLOR_RGB2BGR)
            query_emb = self.generate_embedding_from_crop(crop_pil)

            matched_id, sim, conf_pct = self.match_embedding(query_emb, threshold=threshold)

            if matched_id and matched_id in self.employee_meta_cache:
                emp_info = self.employee_meta_cache[matched_id]
                results.append({
                    "box": [x, y, w, h],
                    "employeeId": matched_id,
                    "name": emp_info["name"],
                    "department": emp_info["department"],
                    "designation": emp_info["designation"],
                    "profilePhoto": emp_info.get("profilePhoto", ""),
                    "similarity": round(sim, 3),
                    "confidence": conf_pct,
                    "isRecognized": True,
                    "faceCrop": face_crop_bgr
                })
            else:
                results.append({
                    "box": [x, y, w, h],
                    "employeeId": None,
                    "name": "Unknown Person",
                    "department": "Unidentified",
                    "designation": "",
                    "profilePhoto": "",
                    "similarity": round(sim, 3),
                    "confidence": conf_pct,
                    "isRecognized": False,
                    "faceCrop": face_crop_bgr
                })

        return results

def get_face_engine():
    return FaceRecognitionEngine.get_instance()
