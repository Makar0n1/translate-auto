const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('file'), projectController.createProject);
router.post('/:id/start', projectController.startTranslation);
router.post('/:id/cancel', projectController.cancelTranslation);
router.post('/:id/resume', projectController.resumeTranslation);
router.delete('/:id', projectController.deleteProject);
router.get('/:id/download', projectController.downloadXLSX);

module.exports = router;