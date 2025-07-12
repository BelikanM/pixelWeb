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
const http = require('http');
const { Server } = require('socket.io');
const webPush = require('web-push');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'Uploads'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=3600');
  }
}));

// Configuration des clés VAPID
webPush.setVapidDetails(
  `mailto:${process.env.EMAIL_USER}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ Connecté à MongoDB'))
  .catch(err => console.error('❌ Erreur MongoDB :', err.message));

// Schéma utilisateur
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
  profilePicture: { type: String, default: '' },
});
const User = mongoose.model('User', userSchema);

// Schéma média
const mediaSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  uploadedAt: { type: Date, default: Date.now },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [
    {
      content: { type: String, required: false },
      media: { type: String, required: false },
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});
const Media = mongoose.model('Media', mediaSchema);

// Configuration Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
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

// Multer config pour médias
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'Uploads');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  },
});
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Limite de 100MB
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté'));
    }
  }
});

// Multer config pour photo de profil
const profileStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'Uploads', 'profiles');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  },
});
const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB pour la photo de profil
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images (jpeg, jpg, png) sont autorisées'));
    }
  }
});

// Générer un code de vérification
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// WebSocket : Gestion des connexions avec authentification
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentification requise'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch {
    next(new Error('Token invalide'));
  }
});

io.on('connection', (socket) => {
  console.log(`Utilisateur ${socket.userId} connecté via WebSocket`);
  socket.join(socket.userId);
  socket.on('disconnect', () => console.log(`Utilisateur ${socket.userId} déconnecté`));
});

// Route pour la page média avec métadonnées Open Graph
app.get('/media/:id', async (req, res) => {
  try {
    const media = await Media.findById(req.params.id)
      .populate('owner', 'username email whatsappNumber whatsappMessage profilePicture')
      .lean();
    if (!media) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Média non trouvé - Pixels Media</title>
          <meta property="og:title" content="Média non trouvé">
          <meta property="og:description" content="Le média demandé n'existe pas ou a été supprimé.">
          <meta property="og:type" content="website">
          <meta property="og:url" content="${req.protocol}://${req.get('host')}/media/${req.params.id}">
          <meta property="og:site_name" content="Pixels Media">
          <meta name="twitter:card" content="summary">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Média non trouvé</h1>
          <p>Le média demandé n'existe pas ou a été supprimé.</p>
          <a href="http://localhost:3000" style="color: #007bff; text-decoration: none;">Retour à l'accueil</a>
        </body>
        </html>
      `);
    }

    const mediaUrl = `${req.protocol}://${req.get('host')}/uploads/${media.filename}`;
    const pageUrl = `${req.protocol}://${req.get('host')}/media/${media._id}`;
    const title = media.originalname || 'Média sur Pixels Media';
    const description = media.owner?.whatsappMessage || 'Découvrez ce contenu sur Pixels Media !';
    const isImage = media.filename.match(/\.(jpg|jpeg|png|gif)$/i);
    const ogType = isImage ? 'image' : 'video';
    const twitterCard = isImage ? 'summary_large_image' : 'player';

    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
        <meta property="og:url" content="${pageUrl}">
        <meta property="og:type" content="${ogType}">
        <meta property="og:site_name" content="Pixels Media">
        ${isImage ? `<meta property="og:image" content="${mediaUrl}">` : `<meta property="og:video" content="${mediaUrl}">`}
        ${isImage ? `<meta property="og:image:alt" content="${title}">` : `<meta property="og:video:type" content="video/mp4">`}
        <meta name="twitter:card" content="${twitterCard}">
        <meta name="twitter:title" content="${title}">
        <meta name="twitter:description" content="${description}">
        ${isImage ? `<meta name="twitter:image" content="${mediaUrl}">` : `<meta name="twitter:player" content="${mediaUrl}">`}
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .media-container {
            max-width: 800px;
            width: 100%;
            padding: 20px;
            text-align: center;
          }
          .media-content {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          h1 {
            font-size: 24px;
            color: #333;
            margin-bottom: 10px;
          }
          p {
            color: #555;
            margin-bottom: 20px;
          }
          a {
            color: #007bff;
            text-decoration: none;
            font-weight: bold;
          }
          a:hover {
            text-decoration: underline;
          }
          video {
            width: 100%;
            max-height: 500px;
          }
        </style>
        <script>
          window.location.href = 'http://localhost:3000/media/${media._id}';
        </script>
      </head>
      <body>
        <div class="media-container">
          <h1>${title}</h1>
          <p>Par : ${media.owner?.username || media.owner?.email || 'Utilisateur inconnu'}</p>
          ${isImage 
            ? `<img src="${mediaUrl}" alt="${title}" class="media-content">`
            : `<video src="${mediaUrl}" controls autoplay muted class="media-content">
                 <source src="${mediaUrl}" type="video/mp4">
                 Votre navigateur ne prend pas en charge la lecture de vidéos.
               </video>`
          }
          <p>Redirection vers l'application Pixels Media...</p>
          <p><a href="http://localhost:3000">Retour à l'accueil</a></p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Erreur /media/:id:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Erreur serveur - Pixels Media</title>
        <meta property="og:title" content="Erreur serveur">
        <meta property="og:description" content="Une erreur est survenue. Veuillez réessayer plus tard.">
        <meta property="og:type" content="website">
        <meta property="og:url" content="${req.protocol}://${req.get('host')}/media/${req.params.id}">
        <meta property="og:site_name" content="Pixels Media">
        <meta name="twitter:card" content="summary">
      </head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>Erreur serveur</h1>
        <p>Une erreur est survenue. Veuillez réessayer plus tard.</p>
        <a href="http://localhost:3000" style="color: #007bff; text-decoration: none;">Retour à l'accueil</a>
      </body>
      </html>
    `);
  }
});

// Route pour enregistrer l'abonnement aux notifications push
app.post('/subscribe', verifyToken, async (req, res) => {
  try {
    const subscription = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    user.pushSubscription = subscription;
    await user.save();
    res.status(201).json({ message: 'Abonnement enregistré' });
  } catch (error) {
    console.error('Erreur /subscribe:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Inscription
app.post('/register', async (req, res) => {
  const { email, password, username, whatsappNumber, whatsappMessage } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email déjà utilisé' });

  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  if (username && !usernameRegex.test(username)) {
    return res.status(400).json({ message: 'Nom d’utilisateur invalide (3-20 caractères, lettres, chiffres, -, _)' });
  }

  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (whatsappNumber && !phoneRegex.test(whatsappNumber)) {
    return res.status(400).json({ message: 'Numéro WhatsApp invalide (format international requis, ex: +1234567890)' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const user = await User.create({
    email,
    password: hashed,
    username: username || email.split('@')[0],
    whatsappNumber: whatsappNumber || '',
    whatsappMessage: whatsappMessage || 'Découvrez ce contenu sur Pixels Media !',
    verificationToken,
    profilePicture: '',
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
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(201).json({ message: 'Utilisateur inscrit. Vérifiez votre email.' });
  } catch (error) {
    console.error('Erreur envoi email:', error);
    res.status(500).json({ message: 'Utilisateur inscrit, mais erreur email.' });
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
    user.verificationCodeExpires = Date.now() + 15 * 60 * 1000;
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
      `,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Code de vérification envoyé.' });
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
      return res.status(400).json({ message: 'Code expiré.' });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    user.verificationToken = undefined;
    await user.save();

    res.json({ message: 'Compte vérifié avec succès.' });
  } catch (error) {
    console.error('Erreur /verify-code:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Vérification email
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

    res.json({ message: 'Email vérifié avec succès.' });
  } catch (error) {
    console.error('Erreur /verify-email:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Connexion
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ message: 'Mot de passe incorrect' });

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ 
    token, 
    user: { 
      email: user.email, 
      username: user.username, 
      isVerified: user.isVerified,
      whatsappNumber: user.whatsappNumber,
      whatsappMessage: user.whatsappMessage,
      profilePicture: user.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${user.profilePicture}` : ''
    } 
  });
});

// Profil utilisateur
app.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('email username isVerified whatsappNumber whatsappMessage profilePicture')
      .lean();
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json({
      ...user,
      profilePicture: user.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${user.profilePicture}` : ''
    });
  } catch (error) {
    console.error('Erreur /profile:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Mettre à jour le profil
app.put('/profile', verifyToken, uploadProfile.single('profilePicture'), async (req, res) => {
  const { username, whatsappNumber, whatsappMessage } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ message: 'Le nom d’utilisateur ne peut pas être vide' });
  }

  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ message: 'Nom d’utilisateur invalide (3-20 caractères, lettres, chiffres, -, _)' });
  }

  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (whatsappNumber && !phoneRegex.test(whatsappNumber)) {
    return res.status(400).json({ message: 'Numéro WhatsApp invalide (format international requis, ex: +1234567890)' });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    // Supprimer l'ancienne photo de profil si une nouvelle est uploadée
    if (req.file && user.profilePicture) {
      try {
        const oldProfilePicturePath = path.join(__dirname, 'Uploads', 'profiles', user.profilePicture);
        await fs.access(oldProfilePicturePath); // Vérifie si le fichier existe
        await fs.unlink(oldProfilePicturePath);
      } catch (err) {
        console.error(`Erreur lors de la suppression de l'ancienne photo de profil ${user.profilePicture}:`, err);
      }
    }

    const updatedData = {
      username: username.trim(),
      whatsappNumber: whatsappNumber || '',
      whatsappMessage: whatsappMessage || 'Découvrez ce contenu sur Pixels Media !',
      profilePicture: req.file ? req.file.filename : user.profilePicture
    };

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      updatedData,
      { new: true, runValidators: true }
    ).select('email username isVerified whatsappNumber whatsappMessage profilePicture').lean();

    res.json({
      message: 'Profil mis à jour',
      user: {
        ...updatedUser,
        profilePicture: updatedUser.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${updatedUser.profilePicture}` : ''
      }
    });
  } catch (error) {
    console.error('Erreur /profile PUT:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Upload média
app.post('/upload', verifyToken, upload.single('media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier' });
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });

    const media = await Media.create({
      filename: req.file.filename,
      originalname: req.file.originalname,
      owner: req.user.userId,
      likes: [],
      dislikes: [],
      comments: [],
    });
    const populatedMedia = await Media.findById(media._id)
      .populate('owner', 'email username whatsappNumber whatsappMessage profilePicture')
      .lean();
    res.status(201).json({ message: 'Fichier uploadé', media: {
      ...populatedMedia,
      owner: {
        ...populatedMedia.owner,
        profilePicture: populatedMedia.owner.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${populatedMedia.owner.profilePicture}` : ''
      }
    } });
    io.to(user._id.toString()).emit('newMedia', { 
      media: {
        ...populatedMedia,
        owner: {
          ...populatedMedia.owner,
          profilePicture: populatedMedia.owner.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${populatedMedia.owner.profilePicture}` : ''
        }
      }, 
      owner: user 
    });
  } catch (error) {
    console.error('Erreur /upload:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Feed des médias des abonnés
app.get('/feed', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).lean();
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    const medias = await Media.find({ owner: { $in: user.following || [] } })
      .populate('owner', 'email username whatsappNumber whatsappMessage profilePicture')
      .populate('comments.author', 'username profilePicture')
      .sort({ uploadedAt: -1 })
      .lean();
    const mediasWithLikes = medias.map(media => ({
      ...media,
      likesCount: media.likes.length,
      dislikesCount: media.dislikes.length,
      isLiked: media.likes.some(id => id.toString() === req.user.userId),
      isDisliked: media.dislikes.some(id => id.toString() === req.user.userId),
      owner: {
        ...media.owner,
        profilePicture: media.owner.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${media.owner.profilePicture}` : ''
      },
      comments: media.comments.map(comment => ({
        ...comment,
        author: {
          ...comment.author,
          profilePicture: comment.author.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${comment.author.profilePicture}` : ''
        }
      }))
    }));
    res.json(mediasWithLikes || []);
  } catch (error) {
    console.error('Erreur /feed:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Liste des utilisateurs
app.get('/users', verifyToken, async (req, res) => {
  try {
    const q = req.query.q || '';
    const users = await User.find({
      $or: [
        { email: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
      ],
      _id: { $ne: req.user.userId },
    }).select('email username whatsappNumber whatsappMessage profilePicture').lean();
    res.json(users.map(user => ({
      ...user,
      profilePicture: user.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${user.profilePicture}` : ''
    })) || []);
  } catch (error) {
    console.error('Erreur /users:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Liste des followings
app.get('/follows', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('following', 'email username whatsappNumber whatsappMessage profilePicture')
      .lean();
    res.json(user.following.map(follow => ({
      ...follow,
      profilePicture: follow.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${follow.profilePicture}` : ''
    })) || []);
  } catch (error) {
    console.error('Erreur /follows:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Suivre un utilisateur
app.post('/follow', verifyToken, async (req, res) => {
  const { followingId } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });

    await User.findByIdAndUpdate(req.user.userId, { $addToSet: { following: followingId } });
    res.json({ message: 'Abonnement effectué' });
    io.to(req.user.userId).emit('followUpdate', { userId: req.user.userId, followingId });
  } catch (error) {
    console.error('Erreur /follow:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Ne plus suivre
app.delete('/follow', verifyToken, async (req, res) => {
  const { followingId } = req.body;
  try {
    await User.findByIdAndUpdate(req.user.userId, { $pull: { following: followingId } });
    res.json({ message: 'Désabonnement effectué' });
    io.to(req.user.userId).emit('unfollowUpdate', { userId: req.user.userId, unfollowedId: followingId });
  } catch (error) {
    console.error('Erreur /follow DELETE:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Récupérer ses propres médias
app.get('/my-medias', verifyToken, async (req, res) => {
  try {
    const list = await Media.find({ owner: req.user.userId })
      .sort({ uploadedAt: -1 })
      .select('-likes -dislikes -comments')
      .lean();
    res.json(list || []);
  } catch (error) {
    console.error('Erreur /my-medias:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Modifier le nom d’un fichier
app.put('/media/:id', verifyToken, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media || media.owner.toString() !== req.user.userId)
      return res.status(403).json({ message: 'Non autorisé' });
    media.originalname = req.body.originalname;
    await media.save();
    const populatedMedia = await Media.findById(req.params.id)
      .populate('owner', 'email username whatsappNumber whatsappMessage profilePicture')
      .lean();
    res.json({ message: 'Nom mis à jour', media: {
      ...populatedMedia,
      owner: {
        ...populatedMedia.owner,
        profilePicture: populatedMedia.owner.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${populatedMedia.owner.profilePicture}` : ''
      }
    } });
  } catch (error) {
    console.error('Erreur /media/:id PUT:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Supprimer un fichier
app.delete('/media/:id', verifyToken, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media || media.owner.toString() !== req.user.userId)
      return res.status(403).json({ message: 'Non autorisé' });
    await media.deleteOne();
    try {
      await fs.unlink(path.join(__dirname, 'Uploads', media.filename));
    } catch (err) {
      console.error(`Erreur lors de la suppression du fichier ${media.filename}:`, err);
    }
    res.json({ message: 'Fichier supprimé' });
    io.emit('mediaDeleted', { mediaId: req.params.id });
  } catch (error) {
    console.error('Erreur /media/:id DELETE:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Ajouter un like
app.post('/like/:mediaId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });

    const media = await Media.findById(req.params.mediaId);
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });

    if (media.likes.includes(req.user.userId)) {
      return res.status(400).json({ message: 'Média déjà aimé' });
    }

    media.likes.push(req.user.userId);
    media.dislikes = media.dislikes.filter(userId => userId.toString() !== req.user.userId);
    await media.save();
    res.json({ message: 'Média aimé', likesCount: media.likes.length, dislikesCount: media.dislikes.length });
    io.emit('likeUpdate', { 
      mediaId: req.params.mediaId, 
      likesCount: media.likes.length, 
      dislikesCount: media.dislikes.length, 
      userId: req.user.userId 
    });
  } catch (error) {
    console.error('Erreur /like/:mediaId POST:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Retirer un like
app.delete('/like/:mediaId', verifyToken, async (req, res) => {
  try {
    const media = await Media.findById(req.params.mediaId);
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });

    if (!media.likes.includes(req.user.userId)) {
      return res.status(400).json({ message: 'Média non aimé' });
    }

    media.likes = media.likes.filter(userId => userId.toString() !== req.user.userId);
    await media.save();
    res.json({ message: 'Like retiré', likesCount: media.likes.length, dislikesCount: media.dislikes.length });
    io.emit('unlikeUpdate', { 
      mediaId: req.params.mediaId, 
      likesCount: media.likes.length, 
      dislikesCount: media.dislikes.length, 
      userId: req.user.userId 
    });
  } catch (error) {
    console.error('Erreur /like/:mediaId DELETE:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Ajouter un dislike
app.post('/dislike/:mediaId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });

    const media = await Media.findById(req.params.mediaId);
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });

    if (media.dislikes.includes(req.user.userId)) {
      return res.status(400).json({ message: 'Média déjà marqué comme non apprécié' });
    }

    media.dislikes.push(req.user.userId);
    media.likes = media.likes.filter(userId => userId.toString() !== req.user.userId);
    await media.save();
    res.json({ message: 'Média marqué comme non apprécié', likesCount: media.likes.length, dislikesCount: media.dislikes.length });
    io.emit('dislikeUpdate', { 
      mediaId: req.params.mediaId, 
      likesCount: media.likes.length, 
      dislikesCount: media.dislikes.length, 
      userId: req.user.userId 
    });
  } catch (error) {
    console.error('Erreur /dislike/:mediaId POST:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Retirer un dislike
app.delete('/dislike/:mediaId', verifyToken, async (req, res) => {
  try {
    const media = await Media.findById(req.params.mediaId);
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });

    if (!media.dislikes.includes(req.user.userId)) {
      return res.status(400).json({ message: 'Média non marqué comme non apprécié' });
    }

    media.dislikes = media.dislikes.filter(userId => userId.toString() !== req.user.userId);
    await media.save();
    res.json({ message: 'Dislike retiré', likesCount: media.likes.length, dislikesCount: media.dislikes.length });
    io.emit('undislikeUpdate', { 
      mediaId: req.params.mediaId, 
      likesCount: media.likes.length, 
      dislikesCount: media.dislikes.length, 
      userId: req.user.userId 
    });
  } catch (error) {
    console.error('Erreur /dislike/:mediaId DELETE:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Ajouter un commentaire
app.post('/comment/:mediaId', verifyToken, upload.single('media'), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });

    const media = await Media.findById(req.params.mediaId)
      .populate('owner', 'email username whatsappNumber whatsappMessage pushSubscription profilePicture');
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });

    const { content } = req.body;
    if (!content && !req.file) {
      return res.status(400).json({ message: 'Le commentaire ou le média ne peut pas être vide' });
    }

    const existingComment = media.comments.find(
      (comment) =>
        (content && comment.content === content.trim() && comment.author.toString() === req.user.userId) ||
        (req.file && comment.media === req.file.filename && comment.author.toString() === req.user.userId)
    );
    if (existingComment) {
      return res.status(400).json({ message: 'Commentaire ou média identique déjà soumis' });
    }

    const newComment = {
      content: content ? content.trim() : '',
      media: req.file ? req.file.filename : null,
      author: req.user.userId,
      createdAt: new Date(),
    };
    media.comments.push(newComment);
    await media.save();

    if (media.owner._id.toString() !== req.user.userId) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: media.owner.email,
        subject: 'Nouveau commentaire sur votre média - Pixels Media',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9f9f9;">
            <h2 style="color: #333;">Nouveau commentaire sur votre média</h2>
            <p style="color: #555;">${user.username || user.email} a commenté votre média "${media.originalname}":</p>
            <p style="color: #555;">${content || 'Média ajouté'}</p>
            <p style="color: #555;">Visitez votre fil pour voir le commentaire.</p>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (error) {
        console.error('Erreur envoi email de notification:', error);
      }
    }

    if (media.owner._id.toString() !== req.user.userId && media.owner.pushSubscription) {
      const payload = JSON.stringify({
        title: 'Nouveau commentaire sur votre média',
        body: `${user.username || user.email} a commenté votre média "${media.originalname}": ${content || 'Média ajouté'}`,
        icon: '/logo192.png',
        data: { url: 'http://localhost:3000' },
      });

      try {
        await webPush.sendNotification(media.owner.pushSubscription, payload);
      } catch (error) {
        console.error('Erreur envoi notification push:', error);
      }
    }

    const updatedMedia = await Media.findById(req.params.mediaId)
      .populate('comments.author', 'username profilePicture')
      .lean();
    res.json({ message: 'Commentaire ajouté', comments: updatedMedia.comments.map(comment => ({
      ...comment,
      author: {
        ...comment.author,
        profilePicture: comment.author.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${comment.author.profilePicture}` : ''
      }
    })) });
    io.emit('commentUpdate', {
      mediaId: req.params.mediaId,
      comment: {
        ...newComment,
        author: { _id: req.user.userId, username: user.username, profilePicture: user.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${user.profilePicture}` : '' },
      },
    });
  } catch (error) {
    console.error('Erreur /comment/:mediaId POST:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Modifier un commentaire
app.put('/comment/:mediaId/:commentId', verifyToken, upload.single('media'), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });

    const media = await Media.findById(req.params.mediaId)
      .populate('owner', 'email username whatsappNumber whatsappMessage pushSubscription profilePicture');
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });

    const comment = media.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Commentaire non trouvé' });
    if (comment.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Non autorisé à modifier ce commentaire' });
    }

    const { content } = req.body;
    if (!content && !req.file) {
      return res.status(400).json({ message: 'Le commentaire ou le média ne peut pas être vide' });
    }

    // Supprimer l'ancienne média du commentaire si une nouvelle est uploadée
    if (req.file && comment.media) {
      try {
        await fs.unlink(path.join(__dirname, 'Uploads', comment.media));
      } catch (err) {
        console.error(`Erreur lors de la suppression de l'ancienne média du commentaire ${comment.media}:`, err);
      }
    }

    comment.content = content ? content.trim() : '';
    comment.media = req.file ? req.file.filename : comment.media;
    comment.createdAt = new Date();
    await media.save();

    if (media.owner._id.toString() !== req.user.userId) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: media.owner.email,
        subject: 'Commentaire modifié sur votre média - Pixels Media',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9f9f9;">
            <h2 style="color: #333;">Commentaire modifié sur votre média</h2>
            <p style="color: #555;">${user.username || user.email} a modifié un commentaire sur votre média "${media.originalname}":</p>
            <p style="color: #555;">${content || 'Média modifié'}</p>
            <p style="color: #555;">Visitez votre fil pour voir le commentaire.</p>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (error) {
        console.error('Erreur envoi email de notification:', error);
      }
    }

    if (media.owner._id.toString() !== req.user.userId && media.owner.pushSubscription) {
      const payload = JSON.stringify({
        title: 'Commentaire modifié sur votre média',
        body: `${user.username || user.email} a modifié un commentaire sur votre média "${media.originalname}": ${content || 'Média modifié'}`,
        icon: '/logo192.png',
        data: { url: 'http://localhost:3000' },
      });

      try {
        await webPush.sendNotification(media.owner.pushSubscription, payload);
      } catch (error) {
        console.error('Erreur envoi notification push:', error);
      }
    }

    const updatedMedia = await Media.findById(req.params.mediaId)
      .populate('comments.author', 'username profilePicture')
      .lean();
    res.json({ message: 'Commentaire modifié', comments: updatedMedia.comments.map(comment => ({
      ...comment,
      author: {
        ...comment.author,
        profilePicture: comment.author.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${comment.author.profilePicture}` : ''
      }
    })) });
    io.emit('commentUpdate', {
      mediaId: req.params.mediaId,
      comment: {
        _id: req.params.commentId,
        content: content ? content.trim() : '',
        media: req.file ? req.file.filename : comment.media,
        author: { _id: req.user.userId, username: user.username, profilePicture: user.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${user.profilePicture}` : '' },
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Erreur /comment/:mediaId/:commentId PUT:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Supprimer un commentaire
app.delete('/comment/:mediaId/:commentId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });

    const media = await Media.findById(req.params.mediaId)
      .populate('owner', 'email username whatsappNumber whatsappMessage pushSubscription profilePicture');
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });

    const comment = media.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Commentaire non trouvé' });
    if (comment.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Non autorisé à supprimer ce commentaire' });
    }

    if (comment.media) {
      try {
        await fs.unlink(path.join(__dirname, 'Uploads', comment.media));
      } catch (err) {
        console.error(`Erreur lors de la suppression du média du commentaire ${comment.media}:`, err);
      }
    }

    media.comments.pull(req.params.commentId);
    await media.save();

    if (media.owner._id.toString() !== req.user.userId) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: media.owner.email,
        subject: 'Commentaire supprimé sur votre média - Pixels Media',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9f9f9;">
            <h2 style="color: #333;">Commentaire supprimé sur votre média</h2>
            <p style="color: #555;">${user.username || user.email} a supprimé un commentaire sur votre média "${media.originalname}".</p>
            <p style="color: #555;">Visitez votre fil pour voir les commentaires restants.</p>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (error) {
        console.error('Erreur envoi email de notification:', error);
      }
    }

    if (media.owner._id.toString() !== req.user.userId && media.owner.pushSubscription) {
      const payload = JSON.stringify({
        title: 'Commentaire supprimé sur votre média',
        body: `${user.username || user.email} a supprimé un commentaire sur votre média "${media.originalname}".`,
        icon: '/logo192.png',
        data: { url: 'http://localhost:3000' },
      });

      try {
        await webPush.sendNotification(media.owner.pushSubscription, payload);
      } catch (error) {
        console.error('Erreur envoi notification push:', error);
      }
    }

    res.json({ message: 'Commentaire supprimé', comments: media.comments });
    io.emit('commentDeleted', { mediaId: req.params.mediaId, commentId: req.params.commentId });
  } catch (error) {
    console.error('Erreur /comment/:mediaId/:commentId DELETE:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour récupérer l'utilisation de l'espace disque
app.get('/disk-usage', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });

    const medias = await Media.find({ owner: req.user.userId }).lean();
    let totalSize = 0;

    for (const media of medias) {
      try {
        const filePath = path.join(__dirname, 'Uploads', media.filename);
        await fs.access(filePath); // Vérifie si le fichier existe
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      } catch (err) {
        console.error(`Erreur lors de la lecture du fichier ${media.filename}:`, err);
      }
    }

    if (user.profilePicture) {
      try {
        const profilePicturePath = path.join(__dirname, 'Uploads', 'profiles', user.profilePicture);
        await fs.access(profilePicturePath); // Vérifie si le fichier existe
        const stats = await fs.stat(profilePicturePath);
        totalSize += stats.size;
      } catch (err) {
        console.error(`Erreur lors de la lecture de la photo de profil ${user.profilePicture}:`, err);
      }
    }

    res.json({ used: totalSize });
  } catch (error) {
    console.error('Erreur /disk-usage:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Lancement serveur
const PORT = process.env.SERVER_PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Serveur actif sur http://localhost:${PORT}`));
