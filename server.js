require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connecté à MongoDB'))
  .catch(err => console.error('❌ Erreur MongoDB :', err.message));

// Schéma utilisateur
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, default: '' },
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationCode: { type: String }, // Nouveau champ pour le code
  verificationCodeExpires: { type: Date } // Expiration du code
});
const User = mongoose.model('User', userSchema);

// Schéma média
const mediaSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  uploadedAt: { type: Date, default: Date.now },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const Media = mongoose.model('Media', mediaSchema);

// Configuration Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// JWT
const JWT_SECRET = process.env.JWT_SECRET;
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'Token requis' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ message: 'Token invalide' });
  }
};

// Multer config
const storage = multer.diskStorage({
  destination: 'Uploads/',
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Générer un code de vérification à 6 chiffres
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Inscription
app.post('/register', async (req, res) => {
  const { email, password, username } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email déjà utilisé' });

  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  if (username && !usernameRegex.test(username)) {
    return res.status(400).json({ message: 'Nom d’utilisateur invalide (3-20 caractères, lettres, chiffres, -, _)' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const user = await User.create({
    email,
    password: hashed,
    username: username || email.split('@')[0],
    verificationToken
  });

  const verificationLink = `http://localhost:5000/verify-email?token=${verificationToken}`;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Vérifiez votre adresse email - Pixels Media',
    html: `
      <h2>Bienvenue sur Pixels Media !</h2>
      <p>Veuillez vérifier votre adresse email en cliquant sur le lien suivant :</p>
      <a href="${verificationLink}">Vérifier mon email</a>
      <p>Ce lien expire dans 24 heures.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(201).json({ message: 'Utilisateur inscrit. Vérifiez votre email pour activer votre compte.' });
  } catch (error) {
    console.error('Erreur envoi email:', error);
    res.status(500).json({ message: 'Utilisateur inscrit, mais erreur lors de l’envoi de l’email de vérification.' });
  }
});

// Demander un nouveau code de vérification
app.post('/request-verification', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (user.isVerified) return res.status(400).json({ message: 'Compte déjà vérifié' });

    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 15 * 60 * 1000; // Expire dans 15 minutes
    await user.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Votre code de vérification - Pixels Media',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9f9f9;">
          <h2 style="color: #333;">Vérification de votre compte Pixels Media</h2>
          <p style="color: #555;">Voici votre code de vérification :</p>
          <div style="text-align: center; padding: 15px; background-color: #007bff; color: white; font-size: 24px; font-weight: bold; border-radius: 5px; margin: 20px 0;">
            ${verificationCode}
          </div>
          <p style="color: #555;">Entrez ce code dans l'application pour vérifier votre compte. Ce code expire dans 15 minutes.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Code de vérification envoyé à votre email.' });
  } catch (error) {
    console.error('Erreur /request-verification:', error);
    res.status(500).json({ message: 'Erreur lors de l’envoi du code', error: error.message });
  }
});

// Vérifier le code
app.post('/verify-code', verifyToken, async (req, res) => {
  const { code } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (user.isVerified) return res.status(400).json({ message: 'Compte déjà vérifié' });
    if (!user.verificationCode || user.verificationCode !== code) {
      return res.status(400).json({ message: 'Code invalide' });
    }
    if (user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({ message: 'Code expiré. Demandez un nouveau code.' });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    user.verificationToken = undefined; // Supprimer aussi le token de lien si existant
    await user.save();

    res.json({ message: 'Compte vérifié avec succès.' });
  } catch (error) {
    console.error('Erreur /verify-code:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Vérification email (inchangé)
app.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) return res.status(400).json({ message: 'Lien de vérification invalide ou expiré' });

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    res.json({ message: 'Email vérifié avec succès. Vous pouvez maintenant vous connecter.' });
  } catch (error) {
    console.error('Erreur /verify-email:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Connexion (inchangé)
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email avant de vous connecter' });

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ message: 'Mot de passe incorrect' });

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, user: { email: user.email, username: user.username, isVerified: user.isVerified } });
});

// Profil utilisateur (modifié pour inclure isVerified)
app.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('email username isVerified');
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json({ email: user.email, username: user.username, isVerified: user.isVerified });
  } catch (error) {
    console.error('Erreur /profile:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Mettre à jour le profil (inchangé)
app.put('/profile', verifyToken, async (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ message: 'Le nom d’utilisateur ne peut pas être vide' });
  }

  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ message: 'Nom d’utilisateur invalide (3-20 caractères, lettres, chiffres, -, _)' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { username: username.trim() },
      { new: true, runValidators: true }
    ).select('email username isVerified');
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json({ message: 'Profil mis à jour', user: { email: user.email, username: user.username, isVerified: user.isVerified } });
  } catch (error) {
    console.error('Erreur /profile PUT:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Upload média (inchangé)
app.post('/upload', verifyToken, upload.single('media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier' });
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email avant d’uploader des fichiers' });

    const media = await Media.create({
      filename: req.file.filename,
      originalname: req.file.originalname,
      owner: req.user.userId
    });
    res.status(201).json({ message: 'Fichier uploadé', media });
  } catch (error) {
    console.error('Erreur /upload:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Feed des médias des abonnés (inchangé)
app.get('/feed', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    const medias = await Media.find({ owner: { $in: user.following || [] } })
      .populate('owner', 'email username')
      .sort({ uploadedAt: -1 });
    res.json(medias || []);
  } catch (error) {
    console.error('Erreur /feed:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Liste des utilisateurs (inchangé)
app.get('/users', verifyToken, async (req, res) => {
  try {
    const q = req.query.q || '';
    const users = await User.find({
      $or: [
        { email: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } }
      ],
      _id: { $ne: req.user.userId }
    }).select('email username');
    res.json(users || []);
  } catch (error) {
    console.error('Erreur /users:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Liste des followings (inchangé)
app.get('/follows', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate('following', 'email username');
    res.json(user.following || []);
  } catch (error) {
    console.error('Erreur /follows:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Suivre un utilisateur (inchangé)
app.post('/follow', verifyToken, async (req, res) => {
  const { followingId } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email avant de suivre des utilisateurs' });

    await User.findByIdAndUpdate(req.user.userId, { $addToSet: { following: followingId } });
    res.json({ message: 'Abonnement effectué' });
  } catch (error) {
    console.error('Erreur /follow:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Ne plus suivre (inchangé)
app.delete('/follow', verifyToken, async (req, res) => {
  const { followingId } = req.body;
  try {
    await User.findByIdAndUpdate(req.user.userId, { $pull: { following: followingId } });
    res.json({ message: 'Désabonnement effectué' });
  } catch (error) {
    console.error('Erreur /follow DELETE:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Récupérer ses propres médias (inchangé)
app.get('/my-medias', verifyToken, async (req, res) => {
  try {
    const list = await Media.find({ owner: req.user.userId }).sort({ uploadedAt: -1 });
    res.json(list || []);
  } catch (error) {
    console.error('Erreur /my-medias:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Modifier le nom d’un fichier (inchangé)
app.put('/media/:id', verifyToken, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media || media.owner.toString() !== req.user.userId)
      return res.status(403).json({ message: 'Non autorisé' });
    media.originalname = req.body.originalname;
    await media.save();
    res.json({ message: 'Nom mis à jour', media });
  } catch (error) {
    console.error('Erreur /media/:id PUT:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Supprimer un fichier (inchangé)
app.delete('/media/:id', verifyToken, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media || media.owner.toString() !== req.user.userId)
      return res.status(403).json({ message: 'Non autorisé' });
    await media.deleteOne();
    res.json({ message: 'Fichier supprimé' });
  } catch (error) {
    console.error('Erreur /media/:id DELETE:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Lancement serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Serveur actif sur http://localhost:${PORT}`));
