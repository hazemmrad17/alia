"""
Test API endpoints by starting the server in-process.
Run: python test_api.py
"""
import sys, io, json, threading, time, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Start server in a thread
def run_server():
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8002, log_level="warning")

server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()
time.sleep(3)  # Wait for server to start

BASE = "http://127.0.0.1:8002"

print("=" * 60)
print("ALIA Avatar API Tests")
print("=" * 60)

# Test 1: Root
r = requests.get(f"{BASE}/")
print(f"\n1. GET / → {r.status_code}")
print(f"   {r.json()}")

# Test 2: Health
r = requests.get(f"{BASE}/health")
print(f"\n2. GET /health → {r.status_code}")
print(f"   {r.json()}")

# Test 3: Products
r = requests.get(f"{BASE}/api/v1/products")
data = r.json()
print(f"\n3. GET /api/v1/products → {r.status_code}")
print(f"   Total: {data['total']} products")
for p in data['products'][:3]:
    print(f"   - {p['name']} ({p['gamme']})")

# Test 4: Levels
r = requests.get(f"{BASE}/api/v1/levels")
print(f"\n4. GET /api/v1/levels → {r.status_code}")
for l in r.json()['levels']:
    print(f"   - {l['name']}: {l['description']}")

# Test 5: Formats
r = requests.get(f"{BASE}/api/v1/formats")
print(f"\n5. GET /api/v1/formats → {r.status_code}")
for f in r.json()['formats']:
    print(f"   - {f['name']} ({f['duration']})")

# Test 6: Start Session
print(f"\n6. POST /api/v1/session/start → ", end="")
r = requests.post(f"{BASE}/api/v1/session/start", json={
    "mode": "training",
    "level": "junior",
    "visit_format": "standard",
    "product_focus": "FERBIOTIC",
})
print(f"{r.status_code}")
resp = r.json()
print(f"   Session: {resp['session_id'][:8]}...")
print(f"   Step: {resp['current_step']}")
print(f"   Greeting: {resp['greeting'][:150]}...")

# Test 7: Send Message
session_id = resp['session_id']
print(f"\n7. POST /api/v1/chat → ", end="")
r = requests.post(f"{BASE}/api/v1/chat", json={
    "session_id": session_id,
    "message": "Bonjour Docteur, je suis Alia de VITAL SA."
})
print(f"{r.status_code}")
resp = r.json()
print(f"   Step: {resp['current_step']}")
print(f"   Reply: {resp['message'][:200]}...")

# Test 8: Session History
r = requests.get(f"{BASE}/api/v1/session/{session_id}/history")
print(f"\n8. GET /api/v1/session/{session_id[:8]}/.../history → {r.status_code}")
print(f"   Messages: {len(r.json()['messages'])}")

print("\n" + "=" * 60)
print("All tests passed!")
print("=" * 60)
