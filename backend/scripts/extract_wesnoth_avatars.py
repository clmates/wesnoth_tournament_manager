#!/usr/bin/env python3
"""
Extract and download Wesnoth Default Era unit avatars from saved HTML.
Reads the HTML downloaded from browser (page.html in frontend/public/wesnoth-units/)
and extracts unit image URLs to download.
"""

import requests
from bs4 import BeautifulSoup
from pathlib import Path
import json
import re

# Base directory for avatars
AVATAR_DIR = Path(__file__).parent.parent.parent / "frontend" / "public" / "wesnoth-units"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

# Path to local HTML file downloaded from browser
HTML_FILE = AVATAR_DIR / "page.html"

def extract_images_from_html(html_path):
    """Extrae las imágenes de unidades del HTML"""
    print(f"📖 Leyendo HTML de {html_path}...")
    
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    images = {}
    
    # Encontrar todas las referencias a imágenes dentro de <div class="pic">
    # Las imágenes de unidad están en: <div class="pic"><a href="..."><img src="../../pics/...png">
    pic_divs = soup.find_all('div', class_='pic')
    
    print(f"📊 Encontrados {len(pic_divs)} contenedores de imágenes")
    
    for pic_div in pic_divs:
        # Buscar el título/nombre en el elemento padre (unitcell)
        unit_cell = pic_div.find_parent('td', class_='unitcell')
        if not unit_cell:
            continue
        
        # El nombre está en el primer <a> de la celda de unidad
        name_link = unit_cell.find('a')
        if not name_link:
            continue
        
        unit_name = name_link.get_text(strip=True)
        
        # La imagen puede estar en <img> directo o en style="background-image:url(...)"
        img_tag = pic_div.find('img')
        if not img_tag:
            continue
        
        img_src = img_tag.get('src', '')
        
        # Si no hay src directo, buscar en background-image de spritebg
        if not img_src:
            sprite_div = pic_div.find('div', class_='spritebg')
            if sprite_div:
                style = sprite_div.get('style', '')
                match = re.search(r"url\('([^']+)'\)", style)
                if match:
                    img_src = match.group(1)
        
        # Filtrar iconos de ataque (melee_attack, blade, etc.)
        if any(icon in img_src for icon in ['melee_attack', 'ranged_attack', 'blade', 'fire', 'pierce', 'impact', 'leader-crown']):
            continue
        
        if img_src and '.png' in img_src:
            # Eliminar el nombre de la unidad si ya existe (evitar duplicados)
            if unit_name not in images:
                images[unit_name] = img_src
                print(f"  ✓ {unit_name}: {img_src}")
    
    return images

def download_images(images):
    """Descarga las imágenes"""
    base_url = "https://units.wesnoth.org/1.18"
    
    print(f"\n📥 Descargando {len(images)} imágenes...")
    
    downloaded = 0
    failed = 0
    
    for unit_name, img_src in images.items():
        # Convertir URL relativa a absoluta
        if img_src.startswith('../../'):
            img_url = base_url + img_src[5:]  # Quitar ../../
        else:
            img_url = base_url + "/" + img_src
        
        # Crear nombre de archivo (sanitizar)
        filename = re.sub(r'[<>:"/\\|?*]', '', unit_name) + ".png"
        filepath = AVATAR_DIR / filename
        
        # No descargar si ya existe
        if filepath.exists():
            print(f"⏭️  {filename} (ya existe)")
            continue
        
        try:
            print(f"⬇️  Descargando {filename}...", end=" ")
            response = requests.get(img_url, timeout=10)
            response.raise_for_status()
            
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            print(f"✅ ({len(response.content)} bytes)")
            downloaded += 1
        except Exception as e:
            print(f"❌ Error: {e}")
            failed += 1

    print(f"\n📊 Resultados: {downloaded} descargadas, {failed} errores")
    return downloaded > 0

def generate_manifest(images):
    """Genera el manifest.json"""
    manifest = []
    
    for unit_name, _ in sorted(images.items()):
        manifest.append({
            "id": re.sub(r'[<>:"/\\|?*]', '', unit_name).lower().replace(" ", "_").replace("(", "").replace(")", ""),
            "name": unit_name,
            "filename": re.sub(r'[<>:"/\\|?*]', '', unit_name) + ".png"
        })
    
    manifest_path = AVATAR_DIR / "manifest.json"
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    print(f"📋 Manifest generado: {len(manifest)} avatares en {manifest_path}")

# Main
if __name__ == "__main__":
    print("🎮 Extractor de Avatares de Wesnoth - Default Era\n")
    
    if not HTML_FILE.exists():
        print(f"❌ Error: {HTML_FILE} no encontrado")
        print("   Descarga el HTML desde el navegador y guarda en esa ubicación")
        exit(1)
    
    images = extract_images_from_html(HTML_FILE)
    
    if images:
        print(f"\n✅ Se encontraron {len(images)} imágenes de unidades")
        
        if download_images(images):
            generate_manifest(images)
            print("\n✅ ¡Completado!")
        else:
            print("\n⚠️  No se descargó ninguna imagen (¿ya existen todas?)")
    else:
        print("✗ No se encontraron imágenes en el HTML!")
