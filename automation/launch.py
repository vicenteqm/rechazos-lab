"""Abre el tablero local; arranca el servidor oculto si hace falta."""
import json, subprocess, sys, time, urllib.request, webbrowser
from pathlib import Path
from update import CONFIG, PRIVATE
config=json.loads(CONFIG.read_text(encoding='utf-8'));url='http://127.0.0.1:'+str(config.get('port',8798))
def healthy():
    try:
        with urllib.request.urlopen(url+'/health.json',timeout=2) as r: return json.load(r).get('app')=='rechazos-lab-local'
    except Exception: return False
if not healthy():
    flags=getattr(subprocess,'CREATE_NO_WINDOW',0)
    subprocess.Popen([sys.executable,str(Path(__file__).with_name('service.py'))],creationflags=flags,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for _ in range(30):
        if healthy(): break
        time.sleep(1)
    else: raise SystemExit('No se pudo iniciar el tablero. Revisa .private/servicio.log')
webbrowser.open(url)
print('Tablero local: '+url)
