const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  filename: { type: String, required: true }, // URL Cloudinary
  originalname: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  cloudinary_public_id: { type: String, required: true }, // ID Cloudinary pour suppression
  comments: [
    {
      content: { type: String, required: false },
      media: { type: String, required: false }, // URL Cloudinary pour les médias des commentaires
      cloudinary_public_id: { type: String, required: false }, // ID Cloudinary pour les médias des commentaires
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model('Media', mediaSchema);
