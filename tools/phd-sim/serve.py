"""Static dev server for the PhD Simulator dev page, with caching disabled.

    python3 tools/phd-sim/serve.py [port]
Then open http://127.0.0.1:8766/tools/phd-sim/dev/index.html
"""
import functools
import http.server
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    handler = functools.partial(NoCache, directory=ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print("serving", ROOT, "on", port, flush=True)
        httpd.serve_forever()
