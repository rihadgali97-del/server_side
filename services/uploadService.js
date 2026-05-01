const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const ensureUploadDirectory = () => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
};

const buildFileMetadata = (file) => ({
  originalName: file.originalname,
  filename: file.filename,
  mimeType: file.mimetype,
  size: file.size,
  path: file.path,
  url: `/uploads/${file.filename}`
});

const saveFile = async (file) => {
  if (!file) {
    throw new Error('No file provided to save');
  }

  ensureUploadDirectory();

  return buildFileMetadata(file);
};

const saveFiles = async (files) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('No files provided to save');
  }

  ensureUploadDirectory();
  return files.map(buildFileMetadata);
};

module.exports = {
  saveFile,
  saveFiles,
  UPLOAD_DIR
};
