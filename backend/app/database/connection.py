import os
import json
import logging
from pymongo import MongoClient
import mongomock
from app.config.settings import settings

logger = logging.getLogger("smartface.database")
logging.basicConfig(level=logging.INFO)

class DatabaseManager:
    _instance = None
    client = None
    db = None
    is_mock = False
    active_uri = settings.MONGODB_URI
    active_db_name = settings.DB_NAME
    store_file = os.path.join(settings.DATA_DIR, "db_storage.json")

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = DatabaseManager()
            cls._instance.connect()
        return cls._instance

    def connect(self, uri: str = None, db_name: str = None):
        target_uri = uri or self.active_uri
        target_db = db_name or self.active_db_name

        try:
            logger.info(f"Connecting to MongoDB at: {target_uri}")
            real_client = MongoClient(target_uri, serverSelectionTimeoutMS=2500)
            real_client.admin.command('ping')
            self.client = real_client
            self.db = self.client[target_db]
            self.is_mock = False
            self.active_uri = target_uri
            self.active_db_name = target_db
            logger.info(f"Successfully connected to live MongoDB database '{target_db}'")
            self._ensure_indexes()
            return True, f"Connected to live MongoDB ({target_db})"
        except Exception as e:
            logger.warning(f"Live MongoDB connection note ({e}). Initializing embedded persistence engine.")
            self.is_mock = True
            self.client = mongomock.MongoClient()
            self.db = self.client[target_db]
            self.active_uri = "embedded_json_mode"
            self.active_db_name = target_db
            self._load_mock_from_disk()
            self._ensure_indexes()
            logger.info("Embedded persistence engine active and synced with disk storage.")
            return False, f"Using local disk persistence engine: {str(e)}"

    def get_connection_status(self):
        return {
            "isLiveMongo": not self.is_mock,
            "mode": "Live MongoDB / Atlas Cluster" if not self.is_mock else "Local File Persistence Engine",
            "activeUri": self.active_uri if not self.is_mock else "Local Embedded (backend/data/db_storage.json)",
            "databaseName": self.active_db_name,
            "storageLocation": self.store_file if self.is_mock else "Remote / Server MongoDB Database"
        }

    def _ensure_indexes(self):
        try:
            self.db.employees.create_index("employeeId", unique=True)
            self.db.employees.create_index("email")
            self.db.face_embeddings.create_index("employeeId")
            self.db.attendance.create_index([("employeeId", 1), ("date", 1)])
            self.db.attendance.create_index("date")
            self.db.admins.create_index("email", unique=True)
            self.db.shifts.create_index("name")
        except Exception as e:
            logger.debug(f"Index creation note: {e}")

    def save_state(self):
        if not self.is_mock:
            return
        try:
            data = {}
            for col_name in ["employees", "face_embeddings", "attendance", "shifts", "admins", "unknown_detections", "audit_logs", "settings", "cameras"]:
                col = self.db[col_name]
                docs = list(col.find({}))
                serialized_docs = []
                for doc in docs:
                    d = dict(doc)
                    if "_id" in d:
                        d["_id"] = str(d["_id"])
                    serialized_docs.append(d)
                data[col_name] = serialized_docs

            with open(self.store_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error persisting state to disk: {e}")

    def _load_mock_from_disk(self):
        if not os.path.exists(self.store_file):
            return
        try:
            with open(self.store_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for col_name, docs in data.items():
                col = self.db[col_name]
                col.delete_many({})
                if docs:
                    for doc in docs:
                        if "_id" in doc and isinstance(doc["_id"], str):
                            pass
                    col.insert_many(docs)
            logger.info(f"Loaded existing database state from {self.store_file}")
        except Exception as e:
            logger.error(f"Failed to load database state from {self.store_file}: {e}")

def get_db():
    mgr = DatabaseManager.get_instance()
    return mgr.db

def get_db_manager():
    return DatabaseManager.get_instance()
