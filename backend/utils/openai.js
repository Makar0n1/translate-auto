const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const promptTemplates = {
  title: (text, lang) => `Provide the official title of the movie or series "${text}" as it is used in ${lang}-speaking regions (e.g., the localized title in France for fr, Spain for es, Germany for de). If no official translation exists, provide a culturally appropriate and natural translation.`,
  description: (text, lang) => `Translate the movie or series description "${text}" to ${lang}, maintaining the tone, context, and cultural nuances accurately.`
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.translateText = async (text, language, type, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
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