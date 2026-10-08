import os
import sys
import subprocess
import time
import webbrowser

def main():
    print("=" * 75)
    print("  🚀 STARTING SMARTFACE ENTERPRISE ATTENDANCE MANAGEMENT PLATFORM")
    print("=" * 75)
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend")
    
    print("\n[+] Launching FastAPI Backend & Production React Application...")
    print(f"    Directory: {backend_dir}")
    print(f"    URL: http://localhost:8000")
    print(f"    Admin Login: admin@smartface.com / admin123")
    print("\n[+] Press Ctrl+C in this terminal to stop the server.")
    print("=" * 75)
    
    time.sleep(1)
    try:
        # Open browser after a short delay
        webbrowser.open("http://localhost:8000")
    except Exception:
        pass
        
    cmd = [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    subprocess.run(cmd, cwd=backend_dir)

if __name__ == "__main__":
    main()
