const mongoose = require('mongoose');
   const Project = require('./models/Project');
   const Translation = require('./models/Translation');

   async function migrateTranslations() {
     try {
       await mongoose.connect(process.env.MONGO_URI);
       console.log('Connected to MongoDB');

       const projects = await Project.find({ translations: { $exists: true, $ne: [] } });
       for (const project of projects) {
         console.log(`Migrating translations for project ${project._id}`);
         for (const t of project.translations) {
           await Translation.create({
             projectId: project._id,
             imdbid: t.imdbid,
             original: t.original,
             translated: t.translated
           });
         }
         project.translations = [];
         await project.save();
         console.log(`Migrated ${project.translatedRows} translations for project ${project._id}`);
       }
       console.log('Migration completed');
       mongoose.disconnect();
     } catch (error) {
       console.error('Migration error:', error.message);
       mongoose.disconnect();
     }
   }

   migrateTranslations();