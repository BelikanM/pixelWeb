require('dotenv').config(); // Charge les variables .env

const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // bcryptjs fonctionne dans Termux
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
}).then(() => {
  console.log('✅ Connecté à MongoDB');
}).catch(err => {
  console.error('❌ Erreur de connexion MongoDB :', err.message);
});

// Schéma utilisateur
const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Schéma média
const mediaSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  uploadedAt: { type: Date, default: Date.now }
});
const Media = mongoose.model('Media', mediaSchema);

// Clé secrète JWT
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware vérification JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'Token requis' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Token invalide' });
  }
};

// Storage fichier (Multer)
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ✅ Inscription
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email déjà utilisé' });

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ email, password: hashed });
  await user.save();

  res.status(201).json({ message: 'Utilisateur inscrit avec succès' });
});

// ✅ Connexion
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ message: 'Mot de passe incorrect' });

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token });
});

// ✅ Upload fichier (protégé par JWT)
app.post('/upload', verifyToken, upload.single('media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu' });

  const media = await Media.create({
    filename: req.file.filename,
    originalname: req.file.originalname
  });

  res.status(201).json({ message: 'Fichier uploadé', media });
});

// ✅ Liste des fichiers uploadés (protégé)
app.get('/medias', verifyToken, async (req, res) => {
  const list = await Media.find().sort({ uploadedAt: -1 });
  res.json(list);
});

// 🚀 Lancement serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur actif : http://localhost:${PORT}`);
});
