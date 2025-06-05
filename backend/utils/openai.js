const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const promptTemplates = {
  title: (text, lang) => `You are a multilingual media localization assistant. Your task is to return only the translated title of the movie or TV series "${text}" in the language specified by the variable ${lang}. If there is an official localized title in the target language, return it exactly as it is. If no official translation exists, return the original title unchanged if it is commonly used as-is in the target market. Only if there is no official title and no established use of the original title, provide a direct and natural-sounding translation in the target language. Do not include any quotes, parentheses, punctuation, or explanatory notes. Do not add any extra text before or after the title. The output must consist only of the title — no formatting, no prefixes, no suffixes. Your output should match how the title would appear on a localized streaming platform or official release in the ${lang}-language market. Return only the final title.`,
  description: (text, lang) => `You are a professional media localization assistant. Your task is to translate the movie or series description "${text}" into the language specified by the variable ${lang}. Preserve the original tone, context, style, and emotional impact. Adapt idioms, cultural references, and expressions naturally to suit the target language's audience. Do not include any quotes, quotation marks, brackets, metadata, formatting, or explanatory comments. Do not add any introductory or concluding text. Return only the translated description as it would appear on an official streaming platform or promotional material in the ${lang} language. The output must consist solely of the localized description — nothing more.`
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.translateText = async (text, language, type, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: promptTemplates[type](text, language)
        }],
        max_tokens: 500
      });
      // Убираем кавычки из результата
      let result = response.choices[0].message.content.trim();
      if (result.startsWith('"') && result.endsWith('"')) {
        result = result.slice(1, -1);
      }
      return result;
    } catch (error) {
      if (error.response?.status === 429 || error.message.includes('insufficient_quota')) {
        console.error('OpenAI quota exceeded:', error.message);
        throw new Error('OpenAI quota exceeded');
      }
      console.error(`Translation attempt ${attempt} failed:`, error.message);
      if (attempt === retries) {
        console.log('Retrying after 1 minute...');
        await delay(60000);
        attempt = 0;
      }
    }
  }
};