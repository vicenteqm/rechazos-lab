"""Entrada silenciosa para el Programador de tareas. Sin credenciales ni publicación."""
import contextlib, sys, traceback
from update import PRIVATE, main
PRIVATE.mkdir(exist_ok=True)
with (PRIVATE/'actualizacion.log').open('a',encoding='utf-8') as log,contextlib.redirect_stdout(log),contextlib.redirect_stderr(log):
    try: sys.exit(main())
    except Exception: traceback.print_exc();sys.exit(1)
