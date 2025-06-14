const Domain = require('../models/Domain');

exports.createDomain = async (req, res) => {
  const { url, login, apiPassword, isWordPress } = req.body;
  try {
    if (!url || !login || !apiPassword || !isWordPress) {
      return res.status(400).json({ error: 'All fields are required, including WordPress confirmation' });
    }
    const domain = new Domain({ url, login, apiPassword, isWordPress });
    await domain.save();
    res.status(201).json(domain);
  } catch (error) {
    console.error('Error creating domain:', error.message);
    res.status(500).json({ error: 'Failed to create domain' });
  }
};

exports.getDomains = async (req, res) => {
  try {
    const domains = await Domain.find().lean();
    res.json(domains);
  } catch (error) {
    console.error('Error fetching domains:', error.message);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
};

exports.deleteDomain = async (req, res) => {
  const { id } = req.params;
  try {
    await Domain.deleteOne({ _id: id });
    res.json({ message: 'Domain deleted' });
  } catch (error) {
    console.error('Error deleting domain:', error.message);
    res.status(500).json({ error: 'Failed to delete domain' });
  }
};