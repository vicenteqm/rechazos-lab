"""Servidor privado y monitor de carpetas para Rechazos Lab."""
import contextlib, json, logging, os, sys, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from update import CONFIG, PRIVATE, run

def main():
    config=json.loads(CONFIG.read_text(encoding='utf-8'))
    PRIVATE.mkdir(exist_ok=True)
    logging.basicConfig(filename=PRIVATE/'servicio.log',level=logging.INFO,format='%(asctime)s %(message)s',encoding='utf-8')
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self,*args,**kwargs): super().__init__(*args,directory=config['output'],**kwargs)
        def do_GET(self):
            if self.path=='/health.json':
                data=b'{"app":"rechazos-lab-local"}';self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(data)
            else: super().do_GET()
        def end_headers(self):
            self.send_header('Cache-Control','no-store');super().end_headers()
        def log_message(self,fmt,*args): logging.info(fmt,*args)
    try: server=ThreadingHTTPServer(('127.0.0.1',int(config.get('port',8798))),Handler)
    except OSError as exc: logging.error('No se pudo iniciar el servidor: %s',exc);return 1
    def watch():
        while True:
            try:
                with (PRIVATE/'actualizacion.log').open('a',encoding='utf-8') as log,contextlib.redirect_stdout(log),contextlib.redirect_stderr(log): run(config)
            except Exception as exc: logging.exception('No se actualizó: %s',exc)
            time.sleep(max(30,int(config.get('intervalSeconds',300))))
    threading.Thread(target=watch,daemon=True).start()
    server.serve_forever()
if __name__=='__main__': sys.exit(main())
