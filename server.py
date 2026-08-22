import http.server
import socketserver
import os

PORT = 5173
WEB_DIR = os.path.abspath('frontend/dist')

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)
        
    def translate_path(self, path):
        path = path.split('?')[0].lstrip('/')
        full_path = os.path.join(WEB_DIR, path)
        if os.path.exists(full_path) and not os.path.isdir(full_path):
            return full_path
        return os.path.join(WEB_DIR, 'index.html')
        
    def log_message(self, format, *args):
        pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('0.0.0.0', PORT), SPAHandler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    httpd.serve_forever()
