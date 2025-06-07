require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Project = require('./models/Project');

async function migrateTranslationsToCollection(projectId) {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const collectionName = `project_${projectId}_1`;
    console.log(`Migrating translations to collection ${collectionName}`);

    // Создаем модель для новой коллекции
    const TranslationCollection = mongoose.model(collectionName, mongoose.Schema({
      imdbid: String,
      original: { title: String, description: String },
      translated: [{
        language: String,
        title: String,
        description: String
      }]
    }));

    // Переносим данные
    for (const t of project.translations) {
      await TranslationCollection.create({
        imdbid: t.imdbid,
        original: t.original,
        translated: t.translated
      });
    }

    // Очищаем translations и добавляем новую коллекцию
    project.translations = [];
    project.translationCollections = [collectionName];
    await project.save();

    console.log(`Migrated ${project.translatedRows} translations for project ${projectId}`);
    mongoose.disconnect();
  } catch (error) {
    console.error('Migration error:', error.message);
    mongoose.disconnect();
  }
}

// Замени <project_id> на реальный ID проекта
migrateTranslationsToCollection('684142d16f1057564d74bbda');