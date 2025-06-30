// ✅ server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// ✅ Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connecté à MongoDB'))
  .catch(err => console.error('❌ Erreur MongoDB :', err.message));

// ✅ Schéma utilisateur
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, default: '' }, // Ajout du champ username
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});
const User = mongoose.model('User', userSchema);

// ✅ Schéma média
const mediaSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  uploadedAt: { type: Date, default: Date.now },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const Media = mongoose.model('Media', mediaSchema);

// ✅ JWT
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

// ✅ Multer config
const storage = multer.diskStorage({
  destination: 'Uploads/',
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ✅ Inscription
app.post('/register', async (req, res) => {
  const { email, password, username } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email déjà utilisé' });
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    email,
    password: hashed,
    username: username || email.split('@')[0] // Default username to email prefix
  });
  res.status(201).json({ message: 'Utilisateur inscrit', user: { email: user.email, username: user.username } });
});

// ✅ Connexion
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ message: 'Mot de passe incorrect' });
  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, user: { email: user.email, username: user.username } });
});

// ✅ Profil utilisateur
app.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('email username');
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json({ email: user.email, username: user.username });
  } catch (error) {
    console.error('Erreur /profile:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ✅ Mettre à jour le profil
app.put('/profile', verifyToken, async (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ message: 'Le nom d’utilisateur ne peut pas être vide' });
  }
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { username: username.trim() },
      { new: true, runValidators: true }
    ).select('email username');
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json({ message: 'Profil mis à jour', user: { email: user.email, username: user.username } });
  } catch (error) {
    console.error('Erreur /profile PUT:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ✅ Upload média
app.post('/upload', verifyToken, upload.single('media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier' });
  try {
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

// ✅ Feed des médias des abonnés
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

// ✅ Liste des utilisateurs
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

// ✅ Liste des followings
app.get('/follows', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate('following', 'email username');
    res.json(user.following || []);
  } catch (error) {
    console.error('Erreur /follows:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ✅ Suivre un utilisateur
app.post('/follow', verifyToken, async (req, res) => {
  const { followingId } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $addToSet: { following: followingId } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json({ message: 'Abonnement effectué' });
  } catch (error) {
    console.error('Erreur /follow:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ✅ Ne plus suivre
app.delete('/follow', verifyToken, async (req, res) => {
  const { followingId } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $pull: { following: followingId } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json({ message: 'Désabonnement effectué' });
  } catch (error) {
    console.error('Erreur /follow DELETE:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ✅ Récupérer ses propres médias
app.get('/my-medias', verifyToken, async (req, res) => {
  try {
    const list = await Media.find({ owner: req.user.userId }).sort({ uploadedAt: -1 });
    res.json(list || []);
  } catch (error) {
    console.error('Erreur /my-medias:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ✅ Modifier le nom d’un fichier
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

// ✅ Supprimer un fichier
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

// ✅ Lancement serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Serveur actif sur http://localhost:${PORT}`));
