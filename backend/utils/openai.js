const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const promptTemplates = {
  title: (text, lang) => `Translate the movie/series title "${text}" to ${lang}, adapting it to be culturally appropriate and natural for that region, as is common in professional localizations.`,
  description: (text, lang) => `Translate the movie/series description "${text}" to ${lang}, maintaining tone and context accurately.`
};

exports.translateText = async (text, language, type) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: promptTemplates[type](text, language)
      }],
      max_tokens: 500
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    throw new Error('Translation failed');
  }
};