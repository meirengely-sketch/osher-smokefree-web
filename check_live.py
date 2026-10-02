"""Read-only public GitHub Pages health check."""

import json
import urllib.request

BASE = "https://meirengely-sketch.github.io/osher-smokefree-web/"
PATHS = ("", "app.js", "style.css", "content.json", "RESEARCH_HE.md", "manifest.webmanifest", "sw.js")

for path in PATHS:
    with urllib.request.urlopen(BASE + path, timeout=15) as response:
        body = response.read()
        assert response.status == 200 and body, path
        if path == "":
            assert "נושמים קדימה".encode() in body
        if path == "content.json":
            assert len(json.loads(body)["events"]) == 8
        print(f"PASS {path or '/'}: HTTP {response.status}, {len(body)} bytes")
