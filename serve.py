# Dev server: static hosting with REVALIDATE-don't-restore caching. 'no-cache' lets the
# browser keep files but forces it to check freshness on every reload (a conditional GET);
# unchanged files come back as a tiny 304 (near-instant), edited files reload as a full 200.
# This kills both problems: stale builds (it always revalidates) AND slow reloads (the old
# 'no-store' re-downloaded all ~70 dev files every refresh). Run: python serve.py -> :8231/run.html
import http.server
import socketserver

PORT = 8231

class RevalidateHandler(http.server.SimpleHTTPRequestHandler):
    # HTTP/1.1 = keep-alive: the browser REUSES a few TCP connections for all ~70 dev files instead
    # of opening+closing one per file (the HTTP/1.0 default), which was the real cause of the slow load.
    protocol_version = 'HTTP/1.1'
    # SimpleHTTPRequestHandler already emits Last-Modified + honours If-Modified-Since (-> 304).
    # We just set no-cache so the browser revalidates instead of serving from heuristic cache.
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('0.0.0.0', PORT), RevalidateHandler) as srv:
    print('serving on 0.0.0.0:%d (no-cache / revalidate)' % PORT)
    srv.serve_forever()
