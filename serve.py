#!/usr/bin/env python3
# Simple no-store dev server (a plain refresh always gets the current build).
import http.server, socketserver

PORT = 8230


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('0.0.0.0', PORT), NoStoreHandler) as srv:
    print('faceted-golf serving on 0.0.0.0:%d (no-store) -> http://localhost:%d/' % (PORT, PORT))
    srv.serve_forever()
