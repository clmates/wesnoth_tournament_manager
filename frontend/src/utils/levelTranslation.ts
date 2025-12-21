/**
 * Utility function to get the translation key for player levels
 * Maps the backend level strings to i18n keys
 */
export const getLevelTranslationKey = (level: string): string => {
  const levelMap: { [key: string]: string } = {
    'Novato': 'level_novato',
    'Iniciado': 'level_iniciado',
    'Veterano': 'level_veterano',
    'Experto': 'level_experto',
    'Maestro': 'level_maestro',
    'novato': 'level_novato',
    'iniciado': 'level_iniciado',
    'veterano': 'level_veterano',
    'experto': 'level_experto',
    'maestro': 'level_maestro',
  };

  return levelMap[level] || 'level_novato';
};