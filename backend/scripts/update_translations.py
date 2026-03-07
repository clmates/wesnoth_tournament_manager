#!/usr/bin/env python3
"""
Update translation files with country and avatar keys.
Adds common section and profile updates for all supported languages.
"""

import json
from pathlib import Path

LOCALES_DIR = Path("frontend/src/i18n/locales")

# Common section translations for each language
COMMON_TRANSLATIONS = {
    "en": {
        "select": "Select...",
        "search": "Search...",
        "loading": "Loading...",
        "noResults": "No results found",
        "updateFailed": "Update failed"
    },
    "es": {
        "select": "Seleccionar...",
        "search": "Buscar...",
        "loading": "Cargando...",
        "noResults": "No se encontraron resultados",
        "updateFailed": "Error al actualizar"
    },
    "de": {
        "select": "Auswählen...",
        "search": "Suchen...",
        "loading": "Wird geladen...",
        "noResults": "Keine Ergebnisse gefunden",
        "updateFailed": "Aktualisierung fehlgeschlagen"
    },
    "ru": {
        "select": "Выбрать...",
        "search": "Поиск...",
        "loading": "Загрузка...",
        "noResults": "Результаты не найдены",
        "updateFailed": "Ошибка обновления"
    },
    "zh": {
        "select": "选择...",
        "search": "搜索...",
        "loading": "加载中...",
        "noResults": "未找到结果",
        "updateFailed": "更新失败"
    }
}

# Profile section updates
PROFILE_UPDATES = {
    "en": {
        "country": "Country",
        "avatar": "Avatar",
        "updated": "Profile updated successfully"
    },
    "es": {
        "country": "País",
        "avatar": "Avatar",
        "updated": "Perfil actualizado exitosamente"
    },
    "de": {
        "country": "Land",
        "avatar": "Avatar",
        "updated": "Profil erfolgreich aktualisiert"
    },
    "ru": {
        "country": "Страна",
        "avatar": "Аватар",
        "updated": "Профиль успешно обновлен"
    },
    "zh": {
        "country": "国家",
        "avatar": "头像",
        "updated": "个人资料已成功更新"
    }
}

def update_locale_file(locale_code: str, file_path: Path):
    """Update a single locale file with country/avatar translations."""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Add or update common section
    if "common" not in data:
        data["common"] = {}
    data["common"].update(COMMON_TRANSLATIONS.get(locale_code, {}))
    
    # Update profile section
    if "profile" not in data:
        data["profile"] = {}
    data["profile"].update(PROFILE_UPDATES.get(locale_code, {}))
    
    # Write back with proper formatting
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ Updated {locale_code}.json")

def main():
    print("=" * 60)
    print("Translation Files Updater")
    print("=" * 60)
    
    locale_files = {
        "en": "en.json",
        "es": "es.json",
        "de": "de.json",
        "ru": "ru.json",
        "zh": "zh.json"
    }
    
    for locale_code, filename in locale_files.items():
        file_path = LOCALES_DIR / filename
        if file_path.exists():
            update_locale_file(locale_code, file_path)
        else:
            print(f"✗ File not found: {file_path}")
    
    print("\n" + "=" * 60)
    print("✓ All translation files updated!")
    print("=" * 60)

if __name__ == '__main__':
    main()
