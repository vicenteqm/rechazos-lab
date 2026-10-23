"""Publica únicamente el modelo procesado autorizado, nunca las fuentes ni las rutas."""
import base64, gzip, json, os, re, shutil, subprocess, urllib.error, urllib.request
from pathlib import Path

def publish(config,private):
    target=config.get('publish',{})
    if not target.get('enabled'): return {'enabled':False}
    owner=target.get('owner');repo=target.get('repository');branch=target.get('branch','main')
    if (owner,repo)!=('vicenteqm','rechazos-lab'): raise ValueError('Destino de publicación distinto al repositorio autorizado.')
    site=Path(config['output']);version=json.loads((site/'data/version.json').read_text(encoding='utf-8'))
    state=private/'publicacion.json'
    if state.exists():
        previous=json.loads(state.read_text(encoding='utf-8'))
        if previous.get('id')==version['id']: return {'changed':False,**previous}
    if not re.fullmatch(r'model-[a-f0-9]+\.json',version['model']): raise ValueError('Referencia de modelo no válida.')
    raw=(site/'data'/version['model']).read_bytes()
    model=json.loads(raw)
    if not model.get('rows') or model['automation']['id']!=version['id']: raise ValueError('Modelo vacío o diferente a la versión que se quiere publicar.')
    compressed=gzip.compress(raw,compresslevel=9,mtime=0)
    if len(compressed)>90*1024*1024: raise ValueError('El modelo comprimido supera el tamaño admitido por esta publicación.')
    public_version={**version,'model':version['model']+'.gz'}
    git=shutil.which('git') or str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe')
    env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='never')
    result=subprocess.run([git,'credential','fill'],input='protocol=https\nhost=github.com\n\n',capture_output=True,text=True,env=env,timeout=30)
    credentials=dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
    token=credentials.get('password')
    if not token: raise ValueError('No hay una sesión GitHub disponible en Windows para publicar la actualización.')
    def api(method,path,data=None):
        request=urllib.request.Request('https://api.github.com'+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Rechazos-Lab'})
        try:
            with urllib.request.urlopen(request,timeout=180) as response:
                content=response.read();return json.loads(content) if content else {}
        except urllib.error.HTTPError as exc: raise ValueError(f'GitHub HTTP {exc.code} al publicar {path}') from None
    if api('GET','/user')['login'].lower()!=owner.lower(): raise ValueError('La sesión de Windows no pertenece al propietario autorizado.')
    prefix=f'/repos/{owner}/{repo}'
    head=api('GET',prefix+'/git/ref/heads/'+branch)['object']['sha']
    commit=api('GET',prefix+'/git/commits/'+head)
    tree=api('GET',prefix+'/git/trees/'+commit['tree']['sha']+'?recursive=1')
    path='data/'+public_version['model']
    blob=api('POST',prefix+'/git/blobs',{'content':base64.b64encode(compressed).decode(),'encoding':'base64'})
    entries=[{'path':path,'mode':'100644','type':'blob','sha':blob['sha']},{'path':'data/version.json','mode':'100644','type':'blob','content':json.dumps(public_version,ensure_ascii=False)},{'path':'data/status.json','mode':'100644','type':'blob','content':json.dumps({'ok':True,'checked':version['generated']})}]
    # Keep one public generation in the current tree. Prior commits remain in Git history.
    entries += [{'path':item['path'],'mode':'100644','type':'blob','sha':None} for item in tree['tree'] if item['type']=='blob' and re.fullmatch(r'data/model-[a-f0-9]+\.json(?:\.gz)?',item['path']) and item['path']!=path]
    new_tree=api('POST',prefix+'/git/trees',{'base_tree':commit['tree']['sha'],'tree':entries})
    new_commit=api('POST',prefix+'/git/commits',{'message':'Actualizar datos publicados del tablero '+version['generated'][:10],'tree':new_tree['sha'],'parents':[head]})
    api('PATCH',prefix+'/git/refs/heads/'+branch,{'sha':new_commit['sha'],'force':False})
    published={'id':version['id'],'commit':new_commit['sha'],'url':f'https://{owner}.github.io/{repo}/','compressedBytes':len(compressed),'rows':len(model['rows'])}
    state.parent.mkdir(exist_ok=True);tmp=state.with_suffix('.tmp');tmp.write_text(json.dumps(published,ensure_ascii=False),encoding='utf-8');os.replace(tmp,state)
    print(json.dumps({'published':True,**published},ensure_ascii=False),flush=True)
    return {'changed':True,**published}
