const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, default: '' },
  whatsappNumber: { type: String, default: '' },
  whatsappMessage: { type: String, default: 'Découvrez ce contenu sur Pixels Media !' },
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationCode: { type: String },
  verificationCodeExpires: { type: Date },
  pushSubscription: { type: Object },
});

module.exports = mongoose.model('User', userSchema);
