#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Processa o arquivo anexado
"""
import subprocess
import sys

# Primeiro tenta listar tudo
print("🔍 Procurando por DOCX...")
resultado = subprocess.run(
    ['powershell', '-Command', 'Get-ChildItem -Recurse -Filter "*.docx" | Select-Object FullName'],
    capture_output=True,
    text=True,
    cwd='.'
)

print("Resultado da busca:")
print(resultado.stdout)
if resultado.stderr:
    print("Erros:", resultado.stderr)

# Tenta encontrar na pasta de Downloads também
print("\n📁 Verificando Downloads...")
resultado2 = subprocess.run(
    ['powershell', '-Command', f'ls $env:USERPROFILE\\Downloads\\*.docx 2>$null | % FullName'],
    capture_output=True,
    text=True
)
print(resultado2.stdout)
