const uploadService = require('../services/uploadService');

exports.uploadFile = async (req, res) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    if (!files.length) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Additional validation
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { // 10 MB
        return res.status(400).json({ message: `File ${file.originalname} exceeds 10MB limit` });
      }
    }

    const uploaded = await uploadService.saveFiles(files);
    res.status(201).json({ message: 'File upload successful', uploaded });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
