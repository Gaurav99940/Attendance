import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.clean_service import clear_all_demo_data

if __name__ == "__main__":
    print("=" * 70)
    print("Wiping all demo employees, mock records, and face embeddings...")
    res = clear_all_demo_data()
    print("Result:", res)
    print("=" * 70)
