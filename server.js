// server.js
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connecté à MongoDB'))
  .catch(err => console.error('❌ Erreur MongoDB :', err.message));

// Schéma utilisateur
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Schéma média
const mediaSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename: String,
  originalname: String,
  uploadedAt: { type: Date, default: Date.now }
});
const Media = mongoose.model('Media', mediaSchema);

// Schéma follow (relation utilisateur -> utilisateur suivi)
const followSchema = new mongoose.Schema({
  follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  following: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});
followSchema.index({ follower: 1, following: 1 }, { unique: true });
const Follow = mongoose.model('Follow', followSchema);

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware vérification JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'Token requis' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId: ... }
    next();
  } catch {
    res.status(403).json({ message: 'Token invalide' });
  }
};

// Multer stockage
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// === AUTH ROUTES ===

// Inscription
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });
  try {
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email déjà utilisé' });
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashed });
    await user.save();
    res.status(201).json({ message: 'Utilisateur inscrit avec succès' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Connexion
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (!await bcrypt.compare(password, user.password))
      return res.status(401).json({ message: 'Mot de passe incorrect' });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === USER ROUTES ===

// Liste utilisateurs avec recherche (query ?q=)
app.get('/users', verifyToken, async (req, res) => {
  const q = req.query.q || '';
  try {
    // Recherche sur email (case insensitive)
    const users = await User.find({ email: { $regex: q, $options: 'i' } }).select('_id email');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Récupérer liste suivis (following) d’un utilisateur
app.get('/follows', verifyToken, async (req, res) => {
  try {
    const follows = await Follow.find({ follower: req.user.userId }).populate('following', '_id email');
    res.json(follows.map(f => f.following));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Suivre un utilisateur (body { followingId })
app.post('/follow', verifyToken, async (req, res) => {
  const followerId = req.user.userId;
  const { followingId } = req.body;
  if (!followingId) return res.status(400).json({ message: 'followingId requis' });
  if (followerId === followingId) return res.status(400).json({ message: 'Impossible de se suivre soi-même' });
  try {
    const exists = await Follow.findOne({ follower: followerId, following: followingId });
    if (exists) return res.status(400).json({ message: 'Déjà suivi' });
    const follow = new Follow({ follower: followerId, following: followingId });
    await follow.save();
    res.json({ message: 'Utilisateur suivi' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Ne plus suivre un utilisateur (body { followingId })
app.delete('/follow', verifyToken, async (req, res) => {
  const followerId = req.user.userId;
  const { followingId } = req.body;
  if (!followingId) return res.status(400).json({ message: 'followingId requis' });
  try {
    await Follow.deleteOne({ follower: followerId, following: followingId });
    res.json({ message: 'Utilisateur non suivi' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === MEDIA ROUTES ===

// Upload média
app.post('/upload', verifyToken, upload.single('media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu' });
  try {
    const media = new Media({
      owner: req.user.userId,
      filename: req.file.filename,
      originalname: req.file.originalname
    });
    await media.save();
    res.status(201).json({ message: 'Fichier uploadé', media });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Liste des médias de l’utilisateur connecté
app.get('/medias', verifyToken, async (req, res) => {
  try {
    const medias = await Media.find({ owner: req.user.userId }).sort({ uploadedAt: -1 });
    res.json(medias);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Liste médias des utilisateurs suivis (filtrage)
app.get('/feed', verifyToken, async (req, res) => {
  try {
    const follows = await Follow.find({ follower: req.user.userId }).select('following');
    const followingIds = follows.map(f => f.following);
    const medias = await Media.find({ owner: { $in: followingIds } }).populate('owner', 'email').sort({ uploadedAt: -1 });
    res.json(medias);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Supprimer un média (seulement propriétaire)
app.delete('/media/:id', verifyToken, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });
    if (media.owner.toString() !== req.user.userId) return res.status(403).json({ message: 'Interdit' });
    await media.remove();
    res.json({ message: 'Média supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Serveur actif : http://localhost:${PORT}`));
