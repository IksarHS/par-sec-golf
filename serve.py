# Dev server: plain static hosting with caching DISABLED, so a normal browser
# reload always gets the current build (python -m http.server lets Chrome serve
# stale JS from heuristic cache, which has repeatedly shipped half-old builds
# into playtests). Run:  python serve.py   ->  http://localhost:8099/run.html
import http.server
import socketserver

PORT = 8231

class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('0.0.0.0', PORT), NoStoreHandler) as srv:
    print('serving on 0.0.0.0:%d (no-store)' % PORT)
    srv.serve_forever()
