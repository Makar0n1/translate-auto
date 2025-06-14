const OpenAI = require('openai');

const openaiStandard = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const openaiCSV = new OpenAI({
  apiKey: process.env.OPENAI_CSV_API_KEY
});

const promptTemplates = {
  title: (text, lang) => `You are a multilingual media localization assistant. Your task is to return only the localized title of the movie or TV series "${text}" in the language specified by the variable ${lang}. Use official localized titles as listed on regional IMDb sites (e.g. imdb.com/es/, imdb.com/de/ etc.) or major streaming platforms in that market. If no official localized title exists but the original title is commonly used as-is, return the original title. Only if neither applies, provide a natural and fluent translation into the target language. Do not include any quotes, parentheses, punctuation, explanations, or formatting — return only the final localized title exactly as it would appear on a streaming platform or IMDb in the ${lang} market.`,
  description: (text, lang) => `You are a professional media localization assistant. Your task is to translate the movie or series description "${text}" into the language specified by the variable ${lang} and expand it to 350-400 words. Preserve the original tone, context, style, and emotional impact. Adapt idioms, cultural references, and expressions naturally to suit the target language's audience. Add relevant plot details, character development, themes, and context to create an engaging, detailed description suitable for a streaming platform. Do not include any quotes, quotation marks, brackets, metadata, formatting, or explanatory comments. Do not add any introductory or concluding text. Return only the translated and expanded description as it would appear on an official streaming platform in the ${lang} language.`,
  generateDescription: (title, lang) => `You are a creative writer for a streaming platform. Generate a detailed movie or series description (350-400 words) in ${lang} based solely on the title "${title}". Create an engaging narrative with a clear plot, well-developed characters, themes, and context suitable for a streaming platform. Ensure the tone is natural and captivating, appealing to the ${lang}-language audience. Do not include any quotes, quotation marks, brackets, metadata, formatting, or explanatory comments. Do not add any introductory or concluding text. Return only the generated description as it would appear on an official streaming platform in the ${lang} language.`
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.translateText = async (text, language, type, isCSV = false) => {
  const openai = isCSV ? openaiCSV : openaiStandard;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: promptTemplates[type](text, language)
        }],
        max_tokens: type === 'description' || type === 'generateDescription' ? 1500 : 500
      });
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
      if (attempt === 3) {
        console.log('Retrying after 1 minute...');
        await delay(60000);
        attempt = 0;
      }
    }
  }
};