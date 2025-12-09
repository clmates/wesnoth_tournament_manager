import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const translateText = async (
  text: string,
  targetLanguage: string
): Promise<string> => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a translator. Translate the following text to ${targetLanguage}. Return only the translated text, nothing else.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        max_tokens: 500,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
};

export const translateToAllLanguages = async (text: string): Promise<Record<string, string>> => {
  const languages = ['English', 'Spanish', 'Chinese', 'German', 'Russian'];
  const languageCodes = ['en', 'es', 'zh', 'de', 'ru'];
  const translations: Record<string, string> = { original: text };

  for (let i = 0; i < languages.length; i++) {
    try {
      translations[languageCodes[i]] = await translateText(text, languages[i]);
    } catch (error) {
      translations[languageCodes[i]] = text;
    }
  }

  return translations;
};
