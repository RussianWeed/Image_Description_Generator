const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Multer setup for file uploads with file filter for images
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
  },
});

// Route to handle image upload and captioning
app.post('/describe', upload.single('image'), async (req, res) => {
  const filePath = req.file?.path;

  if (!filePath) {
    return res.status(400).json({ error: 'No image uploaded or unsupported file type' });
  }

  try {
    const image = await fs.readFile(filePath);

    const response = await axios.post(
      'https://api-inference.huggingface.co/models/nlpconnect/vit-gpt2-image-captioning',
      image,
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/octet-stream',
        },
      }
    );

    if (response.data && response.data[0] && response.data[0].generated_text) {
      const caption = response.data[0].generated_text;
      res.json({ caption });
    } else {
      throw new Error('Failed to generate a caption from the model response.');
    }
  } catch (error) {
    console.error('Error during image processing:', error);
    res.status(500).json({
      error: 'Error generating caption',
      details: error.message,
    });
  } finally {
    // Clean up the temporary file asynchronously
    try {
      await fs.unlink(filePath);
    } catch (cleanupError) {
      console.error('Error deleting temporary file:', cleanupError);
    }
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
