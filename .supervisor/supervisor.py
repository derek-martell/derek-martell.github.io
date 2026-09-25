"""
Supervisor Multi-Agente para derek-martell.github.io
Coordina la planificacion, ejecucion (Claude Code), validacion automatica y control de versiones.
"""

import sys
import os
import json
import subprocess
import datetime
import argparse
import re

# Configuracion de codificacion para Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SUPERVISOR_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SUPERVISOR_DIR)
CONFIG_FILE = os.path.join(SUPERVISOR_DIR, "config.json")
TASK_FILE = os.path.join(SUPERVISOR_DIR, "tarea_actual.md")
HISTORY_DIR = os.path.join(SUPERVISOR_DIR, "historial")

def log(msg, prefix="[*]"):
    print(f"{prefix} {msg}")

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "claude_path": r"C:\Users\Derek Martell\.local\bin\claude.exe",
        "max_retries": 3,
        "git_branch_prefix": "agent/",
        "auto_commit": True
    }

def read_task_from_file():
    if not os.path.exists(TASK_FILE):
        return None
    with open(TASK_FILE, "r", encoding="utf-8") as f:
        content = f.read().strip()
    
    clean_content = re.sub(r"<!--.*?-->", "", content, flags=re.DOTALL)
    
    clean_lines = []
    for line in clean_content.splitlines():
        if line.strip().lower().startswith("# tarea actual"):
            continue
        clean_lines.append(line)
        
    task_text = "\n".join(clean_lines).strip()
    return task_text if task_text else None

def run_cmd(cmd_list, cwd=PROJECT_DIR, capture=True):
    try:
        res = subprocess.run(
            cmd_list,
            cwd=cwd,
            stdin=subprocess.DEVNULL,
            text=True,
            capture_output=capture,
            encoding="utf-8",
            errors="replace"
        )
        return res.returncode, res.stdout, res.stderr
    except Exception as e:
        return 1, "", str(e)

def run_validation():
    val_script = os.path.join(SUPERVISOR_DIR, "validate.py")
    code, stdout, stderr = run_cmd([sys.executable, val_script])
    return code == 0, stdout + "\n" + stderr

def main():
    parser = argparse.ArgumentParser(description="Supervisor Multi-Agente para derek-martell.github.io")
    parser.add_argument("task", nargs="*", help="Descripcion de la tarea a realizar")
    parser.add_argument("--dry-run", action="store_true", help="Simular sin invocar a Claude ni tocar Git")
    parser.add_argument("--no-git", action="store_true", help="No crear rama de git")
    args = parser.parse_args()

    cfg = load_config()
    claude_bin = cfg.get("claude_path", "claude")

    # 1. Obtener la tarea
    if args.task:
        task_description = " ".join(args.task).strip()
    else:
        task_description = read_task_from_file()

    if not task_description:
        log("No se encontro ninguna tarea especificada.", "[!]")
        log(f"Por favor escribe tu tarea en '{TASK_FILE}' o ejecutalo asi:", "   ")
        log('python .supervisor/supervisor.py "Cambiar color del boton a verde"', "   ")
        sys.exit(1)

    print("\n" + "=" * 65)
    print("        🚀 SUPERVISOR MULTI-AGENTE INICIADO")
    print("=" * 65)
    log(f"Proyecto: {PROJECT_DIR}")
    log(f"Tarea detectada: \"{task_description}\"\n")

    if args.dry_run:
        log("MODO SIMULACION (--dry-run): Verificacion de configuración correcta.", "[SIM]")
        log("El supervisor esta listo para ejecutarse sin problemas.")
        sys.exit(0)

    os.makedirs(HISTORY_DIR, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    session_log = []

    # 2. Gestion de Git (Rama aislada de trabajo)
    branch_name = None
    if not args.no_git:
        code, stdout, _ = run_cmd(["git", "status", "--porcelain"])
        if code == 0:
            branch_name = f"{cfg.get('git_branch_prefix', 'agent/')}task-{timestamp}"
            log(f"Creando rama aislada de trabajo: '{branch_name}'", "[Git]")
            run_cmd(["git", "checkout", "-b", branch_name])
            session_log.append(f"Git Branch: {branch_name}")

    # 3. Preparar el Prompt para Claude Code
    system_instruction = (
        "Eres el agente implementador para el sitio web estatico derek-martell.github.io.\n"
        "Debes modificar los archivos necesarios segun el requerimiento solicitado.\n"
        "REGLAS CRITICAS:\n"
        "1. No introduzcas dependencias externas ni frameworks innecesarios.\n"
        "2. Mantén la coherencia visual con la estetica limpia y editorial existente.\n"
        "3. No rompas enlaces relativos existentes ni referencias locales.\n"
        "4. Enlaces externos deben incluir rel='noopener noreferrer'.\n"
        "5. Modifica directamente los archivos con tus herramientas de edicion y resume que tocaste."
    )

    full_prompt = f"{system_instruction}\n\nREQUERIMIENTO DEL USUARIO:\n{task_description}"

    log("Enviando requerimiento a Claude Code CLI...", "[Claude]")
    log("Por favor espera mientras Claude analiza e implementa los cambios...")

    # Ejecutar Claude Code con aceptacion de ediciones en workspace local
    claude_cmd = [claude_bin, "-p", full_prompt, "--permission-mode", "acceptEdits"]
    code, stdout, stderr = run_cmd(claude_cmd)
    
    session_log.append(f"--- Ejecucion Claude (Intento 1) ---\nSalida:\n{stdout}\nErrores:\n{stderr}")

    if code != 0 and not stdout:
        log(f"Fallo la ejecucion de Claude Code CLI: {stderr}", "[ERROR]")
        sys.exit(1)

    print("\n" + "-" * 50)
    print("Respuesta de Claude:")
    print(stdout.strip())
    print("-" * 50 + "\n")

    # 4. Validacion automatica y bucle de autocorreccion
    max_retries = cfg.get("max_retries", 3)
    attempt = 1
    passed = False

    while attempt <= max_retries:
        log(f"Verificando codigo automaticamente (Intento {attempt}/{max_retries})...", "[Test]")
        valid, val_output = run_validation()
        print(val_output.strip())

        if valid:
            passed = True
            log("¡Validacion exitosa! No se encontraron errores de sintaxis ni enlaces rotos.", "[OK]")
            break
        else:
            log(f"Se detectaron problemas en el codigo.", "[ALERTA]")
            if attempt < max_retries:
                attempt += 1
                log(f"Enviando errores a Claude Code para autocorreccion inmediata...", "[Auto-Fix]")
                fix_prompt = (
                    f"La validacion automatica del sitio fallo con los siguientes errores:\n\n"
                    f"{val_output}\n\n"
                    f"Corrige inmediatamente los archivos afectados para que la validacion sea exitosa."
                )
                code_fix, stdout_fix, stderr_fix = run_cmd([claude_bin, "-p", fix_prompt, "--permission-mode", "acceptEdits"])
                session_log.append(f"--- Intento de correccion {attempt} ---\n{stdout_fix}")
                print(stdout_fix.strip())
            else:
                log("Se alcanzo el limite de intentos de autocorreccion.", "[!]")
                break

    # 5. Cierre y Commit
    log_file = os.path.join(HISTORY_DIR, f"{timestamp}.log")
    with open(log_file, "w", encoding="utf-8") as f:
        f.write("\n".join(session_log))

    print("\n" + "=" * 65)
    if passed:
        print("  🎉 TAREA FINALIZADA CON EXITO")
        print("=" * 65)
        if branch_name and cfg.get("auto_commit", True):
            run_cmd(["git", "add", "."])
            short_task = task_description[:50].replace('"', "'").replace("\n", " ")
            run_cmd(["git", "commit", "-m", f"feat(supervisor): {short_task}"])
            log(f"Cambios guardados en la rama: '{branch_name}'", "[Git]")
            log(f"Para ver tus cambios abre 'index.html' en tu navegador.", "   ")
            log(f"Para unir los cambios a master cuando estes satisfecho:", "   ")
            log(f"    git checkout master", "   ")
            log(f"    git merge {branch_name}", "   ")
    else:
        print("  ⚠️ TAREA COMPLETADA CON ADVERTENCIAS (Requiere revision manual)")
        print("=" * 65)
        log(f"Revisa los detalles en: '{log_file}'")

if __name__ == "__main__":
    main()
