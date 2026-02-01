import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// En el contenedor: los archivos i18n están en /app/locales
// En desarrollo: están en frontend/src/i18n/locales (../../../)
// Intentamos primero la ruta del contenedor, luego la ruta de desarrollo
const LOCALES_PATH = process.env.NODE_ENV === 'production' 
  ? path.resolve(__dirname, '../../locales')
  : path.resolve(__dirname, '../../../frontend/src/i18n/locales');
const DEFAULT_LANG = 'en';

const loadedLocales: Record<string, any> = {};

export function getEmailTexts(lang: string): any {
  const language = lang && typeof lang === 'string' ? lang.split('-')[0] : DEFAULT_LANG;
  if (loadedLocales[language]) return loadedLocales[language].email;
  try {
    const filePath = path.join(LOCALES_PATH, `${language}.json`);
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);
    loadedLocales[language] = json;
    return json.email;
  } catch (e) {
    // fallback to English
    if (language !== DEFAULT_LANG) {
      return getEmailTexts(DEFAULT_LANG);
    }
    throw new Error('Could not load email texts for language: ' + lang);
  }
}
