#!/usr/bin/env python3
"""
Download Wesnoth Default Era unit avatars from direct image URLs.
Uses known Wesnoth unit image URLs from units.wesnoth.org documentation.
Stores in frontend/public/wesnoth-units/ and generates manifest.json
"""

import os
import sys
import json
import requests
from pathlib import Path
from urllib.parse import urlparse

# Output directory for avatars
FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend" / "public" / "wesnoth-units"
FRONTEND_DIR.mkdir(parents=True, exist_ok=True)

# Known Wesnoth unit image URLs from the documentation
# Format: name -> URL to PNG image
UNIT_IMAGES = {
    "Archer": "https://units.wesnoth.org/1.18/pics/units/human-loyalists/archer.png",
    "Knight": "https://units.wesnoth.org/1.18/pics/units/human-loyalists/knight.png",
    "Cavalryman": "https://units.wesnoth.org/1.18/pics/units/human-loyalists/cavalryman.png",
    "Pikeman": "https://units.wesnoth.org/1.18/pics/units/human-loyalists/pikeman.png",
    "Spearman": "https://units.wesnoth.org/1.18/pics/units/human-loyalists/spearman.png",
    "Swordsman": "https://units.wesnoth.org/1.18/pics/units/human-loyalists/swordsman.png",
    "Ranger": "https://units.wesnoth.org/1.18/pics/units/human-loyalists/ranger.png",
    "Rogue": "https://units.wesnoth.org/1.18/pics/units/human-loyalists/thief.png",
    
    "Mage": "https://units.wesnoth.org/1.18/pics/units/human-mages/mage.png",
    "Wizard": "https://units.wesnoth.org/1.18/pics/units/human-mages/wizard.png",
    "White Mage": "https://units.wesnoth.org/1.18/pics/units/human-mages/white-mage.png",
    "Shaman": "https://units.wesnoth.org/1.18/pics/units/human-mages/shaman.png",
    "Lich": "https://units.wesnoth.org/1.18/pics/units/human-mages/lich.png",
    
    "Thug": "https://units.wesnoth.org/1.18/pics/units/human-outlaws/thug.png",
    "Assassin": "https://units.wesnoth.org/1.18/pics/units/human-outlaws/assassin.png",
    "Outlaw": "https://units.wesnoth.org/1.18/pics/units/human-outlaws/outlaw.png",
    
    "Zombie": "https://units.wesnoth.org/1.18/pics/units/undead/zombie.png",
    "Skeleton": "https://units.wesnoth.org/1.18/pics/units/undead/skeleton.png",
    "Skeleton Archer": "https://units.wesnoth.org/1.18/pics/units/undead/skeleton-archer.png",
    "Ghost": "https://units.wesnoth.org/1.18/pics/units/undead/ghost.png",
    "Necromancer": "https://units.wesnoth.org/1.18/pics/units/undead/necromancer.png",
    
    "Elf Fighter": "https://units.wesnoth.org/1.18/pics/units/elves-wood/fighter.png",
    "Elf Archer": "https://units.wesnoth.org/1.18/pics/units/elves-wood/archer.png",
    "Elf Druid": "https://units.wesnoth.org/1.18/pics/units/elves-wood/druid.png",
    "Elf Ranger": "https://units.wesnoth.org/1.18/pics/units/elves-wood/ranger.png",
    "Elf Warden": "https://units.wesnoth.org/1.18/pics/units/elves-wood/warden.png",
    
    "Dwarf Fighter": "https://units.wesnoth.org/1.18/pics/units/dwarves/fighter.png",
    "Dwarf Axeman": "https://units.wesnoth.org/1.18/pics/units/dwarves/axeman.png",
    "Dwarf Thunderer": "https://units.wesnoth.org/1.18/pics/units/dwarves/thunderer.png",
    "Dwarf Berserker": "https://units.wesnoth.org/1.18/pics/units/dwarves/berserker.png",
    "Dwarvish Lord": "https://units.wesnoth.org/1.18/pics/units/dwarves/dwarvish-lord.png",
    
    "Orc Warrior": "https://units.wesnoth.org/1.18/pics/units/orcs/warrior.png",
    "Orc Archer": "https://units.wesnoth.org/1.18/pics/units/orcs/archer.png",
    "Orc Shaman": "https://units.wesnoth.org/1.18/pics/units/orcs/shaman.png",
    "Warlord": "https://units.wesnoth.org/1.18/pics/units/orcs/warlord.png",
    
    "Direwolf Rider": "https://units.wesnoth.org/1.18/pics/units/trolls/whelp.png",
    "Young Ogre": "https://units.wesnoth.org/1.18/pics/units/ogres/young-ogre.png",
    "Drake Glider": "https://units.wesnoth.org/1.18/pics/units/drakes/glider.png",
    "Drake Fighter": "https://units.wesnoth.org/1.18/pics/units/drakes/fighter.png",
}


def download_avatar(unit_name: str, url: str) -> tuple:
    """Download a single avatar image."""
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        
        # Generate safe filename
        safe_name = "".join(c if c.isalnum() or c in '-_' else '_' for c in unit_name)
        filename = f"{safe_name}.png"
        filepath = FRONTEND_DIR / filename
        
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        file_size = filepath.stat().st_size / 1024  # KB
        print(f"  ✓ Downloaded: {unit_name} ({file_size:.1f} KB)")
        return filename, unit_name
    except requests.RequestException as e:
        print(f"  ✗ Failed: {unit_name} - {e}")
        return None, unit_name


def generate_manifest(downloaded_avatars: list):
    """Generate manifest.json with downloaded avatars."""
    # Sort by name for consistent output
    downloaded_avatars = sorted(set(downloaded_avatars), key=lambda x: x[1].lower())
    
    manifest = {
        "version": "1.0",
        "total": len(downloaded_avatars),
        "avatars": []
    }
    
    for filename, unit_name in downloaded_avatars:
        if filename:  # Only include successfully downloaded avatars
            manifest["avatars"].append({
                "id": "".join(c if c.isalnum() or c in '-_' else '_' for c in unit_name).lower(),
                "name": unit_name,
                "path": f"/wesnoth-units/{filename}",
                "filename": filename
            })
    
    manifest_path = FRONTEND_DIR / "manifest.json"
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Manifest created: {manifest_path}")
    print(f"  Total avatars: {len(manifest['avatars'])}")
    
    return manifest


def main():
    print("=" * 70)
    print("Wesnoth Default Era Avatar Downloader")
    print("=" * 70)
    print(f"Source: units.wesnoth.org/1.18/\n")
    
    print("Downloading avatars...\n")
    
    downloaded = []
    for unit_name, url in sorted(UNIT_IMAGES.items()):
        filename, name = download_avatar(unit_name, url)
        if filename:
            downloaded.append((filename, unit_name))
    
    if not downloaded:
        print("\n✗ No avatars were successfully downloaded!")
        sys.exit(1)
    
    # Generate manifest
    manifest = generate_manifest(downloaded)
    
    print("\n" + "=" * 70)
    print("✓ Download complete!")
    print("=" * 70)
    print(f"Location: {FRONTEND_DIR}")
    print(f"Avatars downloaded: {len(manifest['avatars'])}")


if __name__ == '__main__':
    main()

