#!/usr/bin/env python3
"""
Generate countries data with translations in multiple languages.
Uses a built-in list of countries with manual translations.
Generates both SQL insert statements and JSON for frontend use.
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Built-in countries list with translations
COUNTRIES_DATA = {
    "ES": {"en": "Spain", "es": "España", "de": "Spanien", "ru": "Испания", "zh": "西班牙", "flag": "🇪🇸", "region": "Europe"},
    "US": {"en": "United States", "es": "Estados Unidos", "de": "Vereinigte Staaten", "ru": "США", "zh": "美国", "flag": "🇺🇸", "region": "North America"},
    "GB": {"en": "United Kingdom", "es": "Reino Unido", "de": "Vereinigtes Königreich", "ru": "Великобритания", "zh": "英国", "flag": "🇬🇧", "region": "Europe"},
    "FR": {"en": "France", "es": "Francia", "de": "Frankreich", "ru": "Франция", "zh": "法国", "flag": "🇫🇷", "region": "Europe"},
    "DE": {"en": "Germany", "es": "Alemania", "de": "Deutschland", "ru": "Германия", "zh": "德国", "flag": "🇩🇪", "region": "Europe"},
    "IT": {"en": "Italy", "es": "Italia", "de": "Italien", "ru": "Италия", "zh": "意大利", "flag": "🇮🇹", "region": "Europe"},
    "MX": {"en": "Mexico", "es": "México", "de": "Mexiko", "ru": "Мексика", "zh": "墨西哥", "flag": "🇲🇽", "region": "North America"},
    "BR": {"en": "Brazil", "es": "Brasil", "de": "Brasilien", "ru": "Бразилия", "zh": "巴西", "flag": "🇧🇷", "region": "South America"},
    "AR": {"en": "Argentina", "es": "Argentina", "de": "Argentinien", "ru": "Аргентина", "zh": "阿根廷", "flag": "🇦🇷", "region": "South America"},
    "CA": {"en": "Canada", "es": "Canadá", "de": "Kanada", "ru": "Канада", "zh": "加拿大", "flag": "🇨🇦", "region": "North America"},
    "AU": {"en": "Australia", "es": "Australia", "de": "Australien", "ru": "Австралия", "zh": "澳大利亚", "flag": "🇦🇺", "region": "Oceania"},
    "JP": {"en": "Japan", "es": "Japón", "de": "Japan", "ru": "Япония", "zh": "日本", "flag": "🇯🇵", "region": "Asia"},
    "CN": {"en": "China", "es": "China", "de": "China", "ru": "Китай", "zh": "中国", "flag": "🇨🇳", "region": "Asia"},
    "IN": {"en": "India", "es": "India", "de": "Indien", "ru": "Индия", "zh": "印度", "flag": "🇮🇳", "region": "Asia"},
    "RU": {"en": "Russia", "es": "Rusia", "de": "Russland", "ru": "Россия", "zh": "俄罗斯", "flag": "🇷🇺", "region": "Europe"},
    "ZA": {"en": "South Africa", "es": "Sudáfrica", "de": "Südafrika", "ru": "Южная Африка", "zh": "南非", "flag": "🇿🇦", "region": "Africa"},
    "KR": {"en": "South Korea", "es": "Corea del Sur", "de": "Südkorea", "ru": "Южная Корея", "zh": "韩国", "flag": "🇰🇷", "region": "Asia"},
    "NZ": {"en": "New Zealand", "es": "Nueva Zelanda", "de": "Neuseeland", "ru": "Новая Зеландия", "zh": "新西兰", "flag": "🇳🇿", "region": "Oceania"},
    "SG": {"en": "Singapore", "es": "Singapur", "de": "Singapur", "ru": "Сингапур", "zh": "新加坡", "flag": "🇸🇬", "region": "Asia"},
    "TH": {"en": "Thailand", "es": "Tailandia", "de": "Thailand", "ru": "Таиланд", "zh": "泰国", "flag": "🇹🇭", "region": "Asia"},
    "PL": {"en": "Poland", "es": "Polonia", "de": "Polen", "ru": "Польша", "zh": "波兰", "flag": "🇵🇱", "region": "Europe"},
    "NL": {"en": "Netherlands", "es": "Países Bajos", "de": "Niederlande", "ru": "Нидерланды", "zh": "荷兰", "flag": "🇳🇱", "region": "Europe"},
    "SE": {"en": "Sweden", "es": "Suecia", "de": "Schweden", "ru": "Швеция", "zh": "瑞典", "flag": "🇸🇪", "region": "Europe"},
    "CH": {"en": "Switzerland", "es": "Suiza", "de": "Schweiz", "ru": "Швейцария", "zh": "瑞士", "flag": "🇨🇭", "region": "Europe"},
    "AT": {"en": "Austria", "es": "Austria", "de": "Österreich", "ru": "Австрия", "zh": "奥地利", "flag": "🇦🇹", "region": "Europe"},
    "BE": {"en": "Belgium", "es": "Bélgica", "de": "Belgien", "ru": "Бельгия", "zh": "比利时", "flag": "🇧🇪", "region": "Europe"},
    "GR": {"en": "Greece", "es": "Grecia", "de": "Griechenland", "ru": "Греция", "zh": "希腊", "flag": "🇬🇷", "region": "Europe"},
    "CZ": {"en": "Czech Republic", "es": "República Checa", "de": "Tschechien", "ru": "Чехия", "zh": "捷克", "flag": "🇨🇿", "region": "Europe"},
    "HU": {"en": "Hungary", "es": "Hungría", "de": "Ungarn", "ru": "Венгрия", "zh": "匈牙利", "flag": "🇭🇺", "region": "Europe"},
    "RO": {"en": "Romania", "es": "Rumania", "de": "Rumänien", "ru": "Румыния", "zh": "罗马尼亚", "flag": "🇷🇴", "region": "Europe"},
    "PT": {"en": "Portugal", "es": "Portugal", "de": "Portugal", "ru": "Португалия", "zh": "葡萄牙", "flag": "🇵🇹", "region": "Europe"},
    "TR": {"en": "Turkey", "es": "Turquía", "de": "Türkei", "ru": "Турция", "zh": "土耳其", "flag": "🇹🇷", "region": "Europe"},
    "CL": {"en": "Chile", "es": "Chile", "de": "Chile", "ru": "Чили", "zh": "智利", "flag": "🇨🇱", "region": "South America"},
    "CO": {"en": "Colombia", "es": "Colombia", "de": "Kolumbien", "ru": "Колумбия", "zh": "哥伦比亚", "flag": "🇨🇴", "region": "South America"},
    "PE": {"en": "Peru", "es": "Perú", "de": "Peru", "ru": "Перу", "zh": "秘鲁", "flag": "🇵🇪", "region": "South America"},
    "VE": {"en": "Venezuela", "es": "Venezuela", "de": "Venezuela", "ru": "Венесуэла", "zh": "委内瑞拉", "flag": "🇻🇪", "region": "South America"},
    "NG": {"en": "Nigeria", "es": "Nigeria", "de": "Nigeria", "ru": "Нигерия", "zh": "尼日利亚", "flag": "🇳🇬", "region": "Africa"},
    "EG": {"en": "Egypt", "es": "Egipto", "de": "Ägypten", "ru": "Египет", "zh": "埃及", "flag": "🇪🇬", "region": "Africa"},
    "MA": {"en": "Morocco", "es": "Marruecos", "de": "Marokko", "ru": "Марокко", "zh": "摩洛哥", "flag": "🇲🇦", "region": "Africa"},
    "KE": {"en": "Kenya", "es": "Kenia", "de": "Kenia", "ru": "Кения", "zh": "肯尼亚", "flag": "🇰🇪", "region": "Africa"},
    "IR": {"en": "Iran", "es": "Irán", "de": "Iran", "ru": "Иран", "zh": "伊朗", "flag": "🇮🇷", "region": "Asia"},
    "IQ": {"en": "Iraq", "es": "Irak", "de": "Irak", "ru": "Ирак", "zh": "伊拉克", "flag": "🇮🇶", "region": "Asia"},
    "SA": {"en": "Saudi Arabia", "es": "Arabia Saudita", "de": "Saudi-Arabien", "ru": "Саудовская Аравия", "zh": "沙特阿拉伯", "flag": "🇸🇦", "region": "Asia"},
    "AE": {"en": "United Arab Emirates", "es": "Emiratos Árabes Unidos", "de": "Vereinigte Arabische Emirate", "ru": "ОАЭ", "zh": "阿联酋", "flag": "🇦🇪", "region": "Asia"},
    "IL": {"en": "Israel", "es": "Israel", "de": "Israel", "ru": "Израиль", "zh": "以色列", "flag": "🇮🇱", "region": "Asia"},
    "PK": {"en": "Pakistan", "es": "Pakistán", "de": "Pakistan", "ru": "Пакистан", "zh": "巴基斯坦", "flag": "🇵🇰", "region": "Asia"},
    "BD": {"en": "Bangladesh", "es": "Bangladesh", "de": "Bangladesch", "ru": "Бангладеш", "zh": "孟加拉国", "flag": "🇧🇩", "region": "Asia"},
    "VN": {"en": "Vietnam", "es": "Vietnam", "de": "Vietnam", "ru": "Вьетнам", "zh": "越南", "flag": "🇻🇳", "region": "Asia"},
    "PH": {"en": "Philippines", "es": "Filipinas", "de": "Philippinen", "ru": "Филиппины", "zh": "菲律宾", "flag": "🇵🇭", "region": "Asia"},
    "ID": {"en": "Indonesia", "es": "Indonesia", "de": "Indonesien", "ru": "Индонезия", "zh": "印度尼西亚", "flag": "🇮🇩", "region": "Asia"},
    "MY": {"en": "Malaysia", "es": "Malasia", "de": "Malaysia", "ru": "Малайзия", "zh": "马来西亚", "flag": "🇲🇾", "region": "Asia"},
    "HK": {"en": "Hong Kong", "es": "Hong Kong", "de": "Hongkong", "ru": "Гонконг", "zh": "香港", "flag": "🇭🇰", "region": "Asia"},
    "TW": {"en": "Taiwan", "es": "Taiwán", "de": "Taiwan", "ru": "Тайвань", "zh": "台湾", "flag": "🇹🇼", "region": "Asia"},
    "XX": {"en": "Other", "es": "Otro", "de": "Andere", "ru": "Другое", "zh": "其他", "flag": "🌍", "region": "Other"},
}

def generate_sql_insert(countries_json: dict) -> str:
    """Generate SQL INSERT statements for countries table with translations."""
    sql_lines = [
        "-- Insert countries with translated names",
        "-- Schema: code, names_json, flag_emoji, region, is_active, created_at",
        ""
    ]
    
    for code, data in sorted(countries_json.items()):
        flag = data['flag'].replace("'", "''")
        region = data.get('region', 'Other').replace("'", "''")
        names_json = json.dumps({k: v for k, v in data.items() if k in ['en', 'es', 'de', 'ru', 'zh']}).replace("'", "''")
        
        sql_lines.append(
            f"INSERT INTO countries (code, names_json, flag_emoji, region, is_active) "
            f"VALUES ('{code}', '{names_json}', '{flag}', '{region}', true) "
            f"ON CONFLICT (code) DO UPDATE SET names_json = EXCLUDED.names_json, flag_emoji = EXCLUDED.flag_emoji, region = EXCLUDED.region;"
        )
    
    return "\n".join(sql_lines)

def generate_frontend_json(countries_json: dict) -> dict:
    """Generate JSON file for frontend with country data."""
    countries_list = []
    for code, data in sorted(countries_json.items(), key=lambda x: x[1]['en']):
        countries_list.append({
            'code': code,
            'flag': data['flag'],
            'names': {k: v for k, v in data.items() if k in ['en', 'es', 'de', 'ru', 'zh']},
            'region': data.get('region', 'Other')
        })
    
    return {
        'version': '1.0',
        'lastUpdated': datetime.utcnow().isoformat(),
        'total': len(countries_json),
        'languages': ['en', 'es', 'de', 'ru', 'zh'],
        'countries': countries_list
    }

def save_files(countries_json: dict):
    """Save generated SQL and JSON files."""
    backend_dir = Path(__file__).parent
    frontend_dir = Path(__file__).parent.parent.parent / "frontend" / "src" / "data"
    
    # Ensure directories exist
    frontend_dir.mkdir(parents=True, exist_ok=True)
    
    # Save SQL file
    sql_content = generate_sql_insert(countries_json)
    sql_path = backend_dir / "countries_insert.sql"
    with open(sql_path, 'w', encoding='utf-8') as f:
        f.write(sql_content)
    print(f"✓ SQL file saved: {sql_path}")
    
    # Save frontend JSON
    frontend_json = generate_frontend_json(countries_json)
    json_path = frontend_dir / "countries.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(frontend_json, f, indent=2, ensure_ascii=False)
    print(f"✓ Frontend JSON saved: {json_path}")
    
    # Also save a country code lookup file
    code_lookup = {}
    for code, data in countries_json.items():
        code_lookup[code] = {
            'flag': data['flag'],
            'en': data['en']
        }
    
    lookup_path = frontend_dir / "countries_lookup.json"
    with open(lookup_path, 'w', encoding='utf-8') as f:
        json.dump(code_lookup, f, indent=2, ensure_ascii=False)
    print(f"✓ Country lookup saved: {lookup_path}")
    
    print(f"\nTotal countries: {len(countries_json)}")

def main():
    print("=" * 70)
    print("Wesnoth Tournament Manager - Countries Generator")
    print("=" * 70)
    print("Using built-in countries list with multilingual translations")
    print("Supported languages: en, es, de, ru, zh\n")
    
    # Save files
    save_files(COUNTRIES_DATA)
    
    print("\n" + "=" * 70)
    print("✓ Generation complete!")
    print("=" * 70)
    print("\nNext steps:")
    print("1. Review scripts/countries_insert.sql")
    print("2. Execute the SQL file against your database:")
    print("   psql -d your_database < scripts/countries_insert.sql")
    print("3. Backend route will automatically use names_json column")
    print("4. Frontend will fetch from /users/data/countries")

if __name__ == '__main__':
    main()
