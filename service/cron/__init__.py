from service.cron.expiredrecords import delete_expired_records_forever
from service.cron.autodeactivate2 import autodeactivate2_forever
from service.cron.emailnotifications import send_notifications_forever
from service.cron.photocleaner import clean_photos_forever
import asyncio
from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from database.asyncdatabase import check_connections_forever

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
        # Fetched: 11k, returned: 670k <- unoptimized
        # Fetched:  1k, returned:  84k <- optimized
        autodeactivate2_forever(),

        # Fetched: 0.1k, returned: 2k
        delete_expired_records_forever(),

        # Fetched: 0.1k, returned: 100k
        clean_photos_forever(),

        # Fetched: 9k, returned: 70k
        send_notifications_forever(),

        check_connections_forever(),

        http_server(),
    )

if __name__ == '__main__':
    asyncio.run(main())
