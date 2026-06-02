import os
from pathlib import Path

search_paths = [
    ".",
    os.path.expanduser("~\\Downloads"),
    os.path.expanduser("~\\Desktop"),
    "c:\\Users\\USUARIO\\Desktop\\REPESC\\Vini\\Unigran",
    "c:\\Users\\USUARIO\\AppData\\Local\\Temp"
]

print("Procurando arquivos .docx...")
found_files = []

for search_path in search_paths:
    if os.path.exists(search_path):
        for root, dirs, files in os.walk(search_path):
            for file in files:
                if file.endswith('.docx'):
                    full_path = os.path.join(root, file)
                    print(f"✓ {full_path}")
                    found_files.append(full_path)

if not found_files:
    print("\nNenhum .docx encontrado. Arquivos no diretório atual:")
    for item in os.listdir("."):
        print(f"  {item}")
