const express = require('express');
const router = express.Router();
const domainController = require('../controllers/domainController');

router.post('/', domainController.createDomain);
router.get('/', domainController.getDomains);
router.delete('/:id', domainController.deleteDomain);

module.exports = router;