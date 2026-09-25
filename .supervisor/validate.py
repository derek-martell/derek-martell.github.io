"""
Validador automatico para derek-martell.github.io.
Revisa HTML bien formado, enlaces/recursos locales existentes,
rel="noopener noreferrer" en enlaces externos con target=_blank o externos,
y sintaxis JS (si Node esta disponible). Sale con codigo != 0 si hay errores.
"""

import os
import re
import sys
import shutil
import subprocess
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", ".supervisor", "node_modules"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input",
             "link", "meta", "param", "source", "track", "wbr"}
# Etiquetas cuyo cierre es opcional en HTML5
OPTIONAL_CLOSE = {"p", "li", "dt", "dd", "tr", "td", "th", "thead", "tbody",
                  "tfoot", "option", "optgroup", "colgroup", "caption",
                  "rb", "rt", "rp", "html", "head", "body"}

errors = []
warnings = []


def rel(path):
    return os.path.relpath(path, PROJECT_DIR).replace("\\", "/")


def iter_files(ext):
    for root, dirs, files in os.walk(PROJECT_DIR):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if name.lower().endswith(ext):
                yield os.path.join(root, name)


def is_external(url):
    return urlparse(url).scheme in ("http", "https") or url.startswith("//")


def check_local_ref(src_file, url, line):
    if not url or url.startswith(("#", "mailto:", "tel:", "data:", "javascript:")):
        return
    if is_external(url) or urlparse(url).scheme:
        return
    if "${" in url or "{{" in url:
        return
    path = unquote(url.split("#")[0].split("?")[0])
    if not path:
        return
    if path.startswith("/"):
        target = os.path.join(PROJECT_DIR, path.lstrip("/"))
    else:
        target = os.path.join(os.path.dirname(src_file), path)
    target = os.path.normpath(target)
    if os.path.isdir(target):
        target = os.path.join(target, "index.html")
    if not os.path.exists(target):
        errors.append(f"{rel(src_file)}:{line}: referencia local rota -> '{url}'")


class Checker(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.stack = []
        self.ids = {}

    def handle_starttag(self, tag, attrs):
        line = self.getpos()[0]
        a = dict(attrs)
        if "id" in a and a["id"]:
            if a["id"] in self.ids:
                errors.append(f"{rel(self.path)}:{line}: id duplicado '{a['id']}' "
                              f"(primero en linea {self.ids[a['id']]})")
            else:
                self.ids[a["id"]] = line
        for attr in ("href", "src"):
            if a.get(attr):
                check_local_ref(self.path, a[attr].strip(), line)
        if tag == "a" and a.get("href") and is_external(a["href"].strip()):
            tokens = set((a.get("rel") or "").lower().split())
            if not {"noopener", "noreferrer"} <= tokens:
                errors.append(f"{rel(self.path)}:{line}: enlace externo sin "
                              f"rel=\"noopener noreferrer\" -> {a['href']}")
        if tag not in VOID_TAGS:
            self.stack.append((tag, line))

    def handle_startendtag(self, tag, attrs):
        # <tag /> : procesar atributos pero no apilar
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS and self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        line = self.getpos()[0]
        if tag in VOID_TAGS:
            return
        if not any(t == tag for t, _ in self.stack):
            errors.append(f"{rel(self.path)}:{line}: cierre </{tag}> sin apertura")
            return
        while self.stack:
            t, l = self.stack.pop()
            if t == tag:
                break
            if t not in OPTIONAL_CLOSE:
                errors.append(f"{rel(self.path)}:{l}: <{t}> no se cerro antes de </{tag}>")

    def close(self):
        super().close()
        for t, l in self.stack:
            if t not in OPTIONAL_CLOSE:
                errors.append(f"{rel(self.path)}:{l}: <{t}> nunca se cerro")


def check_html():
    for path in iter_files(".html"):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        c = Checker(path)
        c.feed(content)
        c.close()


def check_css():
    for path in iter_files(".css"):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        stripped = re.sub(r"/\*.*?\*/", "", content, flags=re.DOTALL)
        stripped = re.sub(r"\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'", "\"\"", stripped)
        depth = 0
        for i, ch in enumerate(stripped):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth < 0:
                    line = stripped.count("\n", 0, i) + 1
                    errors.append(f"{rel(path)}:~{line}: '}}' sin apertura")
                    depth = 0
        if depth != 0:
            errors.append(f"{rel(path)}: llaves desbalanceadas ({depth} sin cerrar)")
        for m in re.finditer(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)", stripped):
            line = stripped.count("\n", 0, m.start()) + 1
            check_local_ref(path, m.group(1).strip(), line)


def check_js():
    node = shutil.which("node")
    if not node:
        warnings.append("Node.js no disponible: se omite la verificacion de sintaxis JS.")
    for path in iter_files(".js"):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        if node:
            res = subprocess.run([node, "--check", path], capture_output=True,
                                 text=True, encoding="utf-8", errors="replace")
            if res.returncode != 0:
                errors.append(f"{rel(path)}: error de sintaxis JS\n{res.stderr.strip()}")
        if re.search(r"\beval\s*\(|new\s+Function\s*\(|document\.write\s*\(", content):
            warnings.append(f"{rel(path)}: uso de eval/new Function/document.write")


def main():
    check_html()
    check_css()
    check_js()
    for w in warnings:
        print(f"[WARN] {w}")
    for e in errors:
        print(f"[ERROR] {e}")
    if errors:
        print(f"\nValidacion fallida: {len(errors)} error(es).")
        sys.exit(1)
    print("Validacion exitosa: HTML, CSS, JS y enlaces correctos.")
    sys.exit(0)


if __name__ == "__main__":
    main()
