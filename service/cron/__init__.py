from service.cron.autodeactivate2 import autodeactivate2_forever
from service.cron.emailnotifications import send_notifications_forever
from service.cron.insertlast import insert_last_forever
from service.cron.photocleaner import clean_photos_forever
import asyncio
from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer

class HealthCheckHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'Healthy')
        else:
            self.send_response(404)
            self.end_headers()

async def http_server():
    with TCPServer(('0.0.0.0', 8080), HealthCheckHandler) as httpd:
        print("Serving health check on port 8080...", flush=True)
        await asyncio.to_thread(httpd.serve_forever)

async def main():
    await asyncio.gather(
        autodeactivate2_forever(),
        clean_photos_forever(),
        http_server(),
        insert_last_forever(),
        send_notifications_forever(),
    )

if __name__ == '__main__':
    asyncio.run(main())
