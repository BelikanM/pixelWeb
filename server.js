const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html'); // Ajout pour sécuriser HTML
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// Configuration environnement
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pixels';
const PORT = process.env.PORT || 5000;

// Connexion MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connecté'))
  .catch(err => console.error('MongoDB erreur:', err));

// Schéma Utilisateur
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String },
  role: { type: String, default: 'user' },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
});
const User = mongoose.model('User', userSchema);

// Schéma Média
const mediaSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalname: { type: String, required: true },
  description: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});
const Media = mongoose.model('Media', mediaSchema);

// Schéma Follow
const followSchema = new mongoose.Schema({
  follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  following: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});
const Follow = mongoose.model('Follow', followSchema);

// Configuration Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'Uploads');
    require('fs').mkdirSync(dir, { recursive: true }); // Créer le dossier s'il n'existe pas
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|mp4|mov|mp3|wav/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Fichiers images, vidéos ou audios uniquement'));
  },
});

// Middleware Authentification
const auth = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    console.error('Erreur auth: Token manquant');
    return res.status(401).json({ message: 'Token requis' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error('Erreur auth:', err.message);
    res.status(401).json({ message: 'Token invalide' });
  }
};

// Middleware Vérification
const requireVerified = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      console.error('Erreur vérification: Utilisateur non trouvé');
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (!user.isVerified) {
      console.error('Erreur vérification: Email non vérifié');
      return res.status(403).json({ message: 'Veuillez vérifier votre email' });
    }
    next();
  } catch (err) {
    console.error('Erreur vérification:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Inscription
app.post('/register', async (req, res) => {
  const { email, password, username } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.error('Erreur inscription: Email déjà utilisé', email);
      return res.status(400).json({ message: 'Email déjà utilisé' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.random().toString(36).slice(-6).toUpperCase();
    
    const user = new User({
      email,
      password: hashedPassword,
      username: username || email.split('@')[0],
      verificationCode,
    });
    await user.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Vérifiez votre compte Pixels Media',
      text: `Votre code de vérification est : ${verificationCode}`,
    };
    await transporter.sendMail(mailOptions);
    console.log('Inscription réussie pour', email);
    res.status(201).json({ message: 'Inscription réussie. Vérifiez votre email.' });
  } catch (err) {
    console.error('Erreur inscription:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Connexion
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.error('Erreur connexion: Utilisateur non trouvé', email);
      return res.status(400).json({ message: 'Utilisateur non trouvé' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.error('Erreur connexion: Mot de passe incorrect', email);
      return res.status(400).json({ message: 'Mot de passe incorrect' });
    }
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    console.log('Connexion réussie pour', email);
    res.json({
      token,
      user: { email: user.email, username: user.username, isVerified: user.isVerified, role: user.role },
    });
  } catch (err) {
    console.error('Erreur connexion:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Demander un nouveau code de vérification
app.post('/request-verification', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      console.error('Erreur demande code: Utilisateur non trouvé', req.userId);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.isVerified) {
      console.error('Erreur demande code: Compte déjà vérifié', req.userId);
      return res.status(400).json({ message: 'Compte déjà vérifié' });
    }

    const verificationCode = Math.random().toString(36).slice(-6).toUpperCase();
    user.verificationCode = verificationCode;
    await user.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Nouveau code de vérification Pixels Media',
      text: `Votre nouveau code de vérification est : ${verificationCode}`,
    };
    await transporter.sendMail(mailOptions);
    console.log('Nouveau code envoyé pour', user.email);
    res.json({ message: 'Nouveau code envoyé à votre email' });
  } catch (err) {
    console.error('Erreur demande code:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Vérifier le code
app.post('/verify-code', auth, async (req, res) => {
  const { code } = req.body;
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      console.error('Erreur vérification code: Utilisateur non trouvé', req.userId);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.isVerified) {
      console.error('Erreur vérification code: Compte déjà vérifié', req.userId);
      return res.status(400).json({ message: 'Compte déjà vérifié' });
    }
    if (user.verificationCode !== code) {
      console.error('Erreur vérification code: Code invalide', req.userId);
      return res.status(400).json({ message: 'Code invalide' });
    }

    user.isVerified = true;
    user.verificationCode = null;
    await user.save();
    console.log('Compte vérifié pour', user.email);
    res.json({ message: 'Compte vérifié avec succès', user: { email: user.email, username: user.username, isVerified: user.isVerified, role: user.role } });
  } catch (err) {
    console.error('Erreur vérification code:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Profil
app.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -verificationCode');
    if (!user) {
      console.error('Erreur profil: Utilisateur non trouvé', req.userId);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json(user);
  } catch (err) {
    console.error('Erreur profil:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Mettre à jour le profil
app.put('/profile', auth, requireVerified, async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      console.error('Erreur mise à jour profil: Utilisateur non trouvé', req.userId);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (username) {
      const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
      if (!usernameRegex.test(username)) {
        console.error('Erreur mise à jour profil: Nom d’utilisateur invalide', username);
        return res.status(400).json({ message: 'Nom d’utilisateur invalide (3-20 caractères, lettres, chiffres, -, _)' });
      }
      user.username = username;
    }
    await user.save();
    console.log('Profil mis à jour pour', user.email);
    res.json({ message: 'Profil mis à jour', user: { email: user.email, username: user.username, isVerified: user.isVerified, role: user.role } });
  } catch (err) {
    console.error('Erreur mise à jour profil:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer un média spécifique
app.get('/media/:id', auth, requireVerified, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id).populate('owner', 'email username isVerified role');
    if (!media) {
      console.error('Erreur récupération média: Média non trouvé', req.params.id);
      return res.status(404).json({ message: 'Média non trouvé' });
    }
    res.json(media);
  } catch (err) {
    console.error('Erreur récupération média:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Uploader un média
app.post('/upload', auth, requireVerified, upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('Erreur upload: Aucun fichier fourni');
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }
    const cleanDescription = sanitizeHtml(req.body.description || '', {
      allowedTags: ['b', 'i', 'a', 'p', 'strong', 'em'],
      allowedAttributes: { 'a': ['href'] },
    });
    const media = new Media({
      filename: req.file.filename,
      originalname: req.file.originalname,
      description: cleanDescription,
      owner: req.userId,
    });
    await media.save();
    console.log('Média uploadé par', req.userId);
    res.json({ message: 'Média uploadé avec succès' });
  } catch (err) {
    console.error('Erreur upload:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Supprimer un média
app.delete('/media/:id', auth, requireVerified, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) {
      console.error('Erreur suppression média: Média non trouvé', req.params.id);
      return res.status(404).json({ message: 'Média non trouvé' });
    }
    if (media.owner.toString() !== req.userId) {
      console.error('Erreur suppression média: Non autorisé', req.userId);
      return res.status(403).json({ message: 'Non autorisé' });
    }
    await media.remove();
    console.log('Média supprimé', req.params.id);
    res.json({ message: 'Média supprimé' });
  } catch (err) {
    console.error('Erreur suppression média:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Mettre à jour un média
app.put('/media/:id', auth, requireVerified, async (req, res) => {
  const { originalname, description } = req.body;
  try {
    const media = await Media.findById(req.params.id);
    if (!media) {
      console.error('Erreur mise à jour média: Média non trouvé', req.params.id);
      return res.status(404).json({ message: 'Média non trouvé' });
    }
    if (media.owner.toString() !== req.userId) {
      console.error('Erreur mise à jour média: Non autorisé', req.userId);
      return res.status(403).json({ message: 'Non autorisé' });
    }
    if (originalname) media.originalname = originalname;
    if (description) {
      media.description = sanitizeHtml(description, {
        allowedTags: ['b', 'i', 'a', 'p', 'strong', 'em'],
        allowedAttributes: { 'a': ['href'] },
      });
    }
    await media.save();
    console.log('Média mis à jour', req.params.id);
    res.json({ message: 'Média mis à jour' });
  } catch (err) {
    console.error('Erreur mise à jour média:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Liker/Dé-liker un média
app.post('/media/:id/like', auth, requireVerified, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) {
      console.error('Erreur like média: Média non trouvé', req.params.id);
      return res.status(404).json({ message: 'Média non trouvé' });
    }
    const userId = req.userId;
    const index = media.likedBy.indexOf(userId);
    if (index === -1) {
      media.likedBy.push(userId);
      await media.save();
      console.log('Média liké', req.params.id, 'par', userId);
      res.json({ message: 'Média liké' });
    } else {
      media.likedBy.splice(index, 1);
      await media.save();
      console.log('Like retiré pour média', req.params.id, 'par', userId);
      res.json({ message: 'Like retiré' });
    }
  } catch (err) {
    console.error('Erreur like média:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer les médias personnels
app.get('/my-medias', auth, requireVerified, async (req, res) => {
  try {
    const medias = await Media.find({ owner: req.userId })
      .populate('owner', 'email username isVerified role')
      .sort({ uploadedAt: -1 });
    res.json(medias);
  } catch (err) {
    console.error('Erreur récupération médias personnels:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer le fil d'actualité
app.get('/feed', auth, requireVerified, async (req, res) => {
  try {
    const follows = await Follow.find({ follower: req.userId }).select('following');
    const followingIds = follows.map(f => f.following);
    const medias = await Media.find({
      owner: { $in: followingIds },
    })
      .populate('owner', 'email username isVerified role')
      .sort({ uploadedAt: -1 });
    res.json(medias);
  } catch (err) {
    console.error('Erreur récupération feed:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Suivre un utilisateur
app.post('/follow', auth, requireVerified, async (req, res) => {
  const { followingId } = req.body;
  if (!followingId) {
    console.error('Erreur follow: ID utilisateur manquant');
    return res.status(400).json({ message: 'ID utilisateur requis' });
  }
  if (followingId === req.userId) {
    console.error('Erreur follow: Auto-follow interdit', req.userId);
    return res.status(400).json({ message: 'Vous ne pouvez pas vous suivre' });
  }
  try {
    const existingFollow = await Follow.findOne({ follower: req.userId, following: followingId });
    if (existingFollow) {
      console.error('Erreur follow: Déjà suivi', followingId);
      return res.status(400).json({ message: 'Vous suivez déjà cet utilisateur' });
    }
    const follow = new Follow({ follower: req.userId, following: followingId });
    await follow.save();
    console.log('Utilisateur suivi', followingId, 'par', req.userId);
    res.json({ message: 'Utilisateur suivi' });
  } catch (err) {
    console.error('Erreur follow:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Ne plus suivre
app.delete('/follow', auth, requireVerified, async (req, res) => {
  const { followingId } = req.body;
  if (!followingId) {
    console.error('Erreur unfollow: ID utilisateur manquant');
    return res.status(400).json({ message: 'ID utilisateur requis' });
  }
  try {
    await Follow.deleteOne({ follower: req.userId, following: followingId });
    console.log('Utilisateur non suivi', followingId, 'par', req.userId);
    res.json({ message: 'Utilisateur non suivi' });
  } catch (err) {
    console.error('Erreur unfollow:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer les suivis
app.get('/follows', auth, requireVerified, async (req, res) => {
  try {
    const follows = await Follow.find({ follower: req.userId }).populate('following', 'email username isVerified role');
    const users = follows.map(f => f.following);
    res.json(users);
  } catch (err) {
    console.error('Erreur récupération suivis:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Rechercher utilisateurs
app.get('/users', auth, requireVerified, async (req, res) => {
  const query = req.query.q || '';
  try {
    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
      ],
    }).select('email username isVerified role');
    res.json(users);
  } catch (err) {
    console.error('Erreur recherche utilisateurs:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Supprimer un utilisateur (admin uniquement)
app.delete('/users/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      console.error('Erreur suppression utilisateur: Non autorisé', req.userId);
      return res.status(403).json({ message: 'Non autorisé' });
    }
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) {
      console.error('Erreur suppression utilisateur: Utilisateur non trouvé', req.params.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (userToDelete.role === 'admin') {
      console.error('Erreur suppression utilisateur: Admin non supprimable', req.params.id);
      return res.status(403).json({ message: 'Impossible de supprimer un admin' });
    }
    await Media.deleteMany({ owner: req.params.id });
    await Follow.deleteMany({ $or: [{ follower: req.params.id }, { following: req.params.id }] });
    await User.deleteOne({ _id: req.params.id });
    console.log('Utilisateur supprimé', req.params.id);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    console.error('Erreur suppression utilisateur:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Modifier statut vérification (admin uniquement)
app.put('/users/:id/verify', auth, async (req, res) => {
  const { isVerified } = req.body;
  try {
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      console.error('Erreur modification vérification: Non autorisé', req.userId);
      return res.status(403).json({ message: 'Non autorisé' });
    }
    const userToUpdate = await User.findById(req.params.id);
    if (!userToUpdate) {
      console.error('Erreur modification vérification: Utilisateur non trouvé', req.params.id);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (userToUpdate.role === 'admin') {
      console.error('Erreur modification vérification: Admin non modifiable', req.params.id);
      return res.status(403).json({ message: 'Impossible de modifier un admin' });
    }
    userToUpdate.isVerified = isVerified;
    await userToUpdate.save();
    console.log(`Statut vérification mis à jour pour ${req.params.id} à ${isVerified}`);
    res.json({ message: `Statut de vérification mis à jour à ${isVerified ? 'vérifié' : 'non vérifié'}` });
  } catch (err) {
    console.error('Erreur modification vérification:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
