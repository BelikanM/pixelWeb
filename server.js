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

// Initialisation de l'application Express et du serveur HTTP
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

// Middleware
app.use(cors({ origin: 'http://localhost:3000', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'Uploads'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=3600');
  }
}));
app.use('/uploads/profiles', express.static(path.join(__dirname, 'Uploads', 'profiles')));

// Middleware pour récupérer l'IP du client
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
};

// Configuration des clés VAPID pour les notifications push
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.error('❌ Clés VAPID non configurées');
}
webPush.setVapidDetails(
  `mailto:${process.env.EMAIL_USER}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Connexion à MongoDB
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
  points: { type: Number, default: 100 },
  dailyActions: {
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    follows: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now },
  },
  blockedUntil: { type: Date, default: null },
  ipHistory: [{ ip: String, lastAction: Date }],
});
const User = mongoose.model('User', userSchema);

// Schéma média
const mediaSchema = new mongoose.Schema({
  filename: { type: String, required: false },
  youtubeUrl: { type: String, required: false },
  tiktokUrl: { type: String, required: false },
  facebookUrl: { type: String, required: false },
  originalname: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  views: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [
    {
      content: { type: String, required: false },
      media: { type: String, required: false },
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  points: { type: Number, default: 0 },
});
const Media = mongoose.model('Media', mediaSchema);

// Schéma pour les actions
const actionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  media: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: true },
  actionType: { type: String, enum: ['like', 'view', 'follow'], required: true },
  platform: { type: String, enum: ['youtube', 'tiktok', 'facebook'], required: true },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '1h' },
  validated: { type: Boolean, default: false },
  ip: { type: String, required: true },
});
const Action = mongoose.model('Action', actionSchema);

// Schéma pour les transactions de points
const pointsTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  media: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: false },
  points: { type: Number, required: true },
  type: { type: String, enum: ['credit', 'debit', 'reset'], required: true },
  actionType: { type: String, enum: ['like', 'view', 'follow', 'add', 'update', 'reset'], required: true },
  platform: { type: String, enum: ['youtube', 'tiktok', 'facebook', 'local'], required: false },
  ip: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const PointsTransaction = mongoose.model('PointsTransaction', pointsTransactionSchema);

// Configuration Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// Configuration JWT
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

// Configuration Multer pour les médias locaux
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
  limits: { fileSize: 100 * 1024 * 1024 },
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

// Configuration Multer pour les photos de profil
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
  limits: { fileSize: 5 * 1024 * 1024 },
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

// Fonction pour générer un code de vérification
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Réinitialisation des limites quotidiennes
const resetDailyActions = async (user) => {
  const now = new Date();
  const lastReset = new Date(user.dailyActions.lastReset);
  if (now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    user.dailyActions = { likes: 0, views: 0, follows: 0, lastReset: now };
    await user.save();
  }
};

// Vérification anti-fraude
const checkFraud = async (userId, ip, actionType, mediaId) => {
  const user = await User.findById(userId);
  if (user.blockedUntil && user.blockedUntil > new Date()) {
    return { isBlocked: true, message: `Compte bloqué jusqu'au ${user.blockedUntil.toLocaleString()}` };
  }

  await resetDailyActions(user);
  const dailyLimits = { likes: 10, views: 10, follows: 5 };
  if (user.dailyActions[actionType + 's'] >= dailyLimits[actionType + 's']) {
    user.blockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    return { isBlocked: true, message: `Limite quotidienne de ${actionType}s atteinte. Compte bloqué pour 24h.` };
  }

  const recentActions = await Action.countDocuments({
    user: userId,
    ip,
    actionType,
    media: mediaId,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
  });
  if (recentActions > 5) {
    user.blockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    return { isBlocked: true, message: 'Activité suspecte détectée. Compte bloqué pour 24h.' };
  }

  user.ipHistory = user.ipHistory || [];
  user.ipHistory.push({ ip, lastAction: new Date() });
  user.ipHistory = user.ipHistory.filter(entry => new Date(entry.lastAction) > new Date(Date.now() - 24 * 60 * 60 * 1000));
  await user.save();

  return { isBlocked: false };
};

// WebSocket : Gestion des connexions
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

    const isYouTube = !!media.youtubeUrl;
    const isTikTok = !!media.tiktokUrl;
    const isFacebook = !!media.facebookUrl;
    const mediaUrl = isYouTube
      ? media.youtubeUrl
      : isTikTok
      ? media.tiktokUrl
      : isFacebook
      ? media.facebookUrl
      : `${req.protocol}://${req.get('host')}/uploads/${media.filename}`;
    const pageUrl = `${req.protocol}://${req.get('host')}/media/${media._id}`;
    const title = media.originalname || 'Média sur Pixels Media';
    const description = `${media.owner?.whatsappMessage || 'Découvrez ce contenu sur Pixels Media !'} (${media.points} FCFA)`;
    const isImage = !isYouTube && !isTikTok && !isFacebook && media.filename?.match(/\.(jpg|jpeg|png|gif)$/i);
    const ogType = isYouTube || isTikTok || isFacebook ? 'video' : isImage ? 'image' : 'video';
    const twitterCard = isYouTube || isTikTok || isFacebook ? 'player' : isImage ? 'summary_large_image' : 'player';

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
        ${isYouTube ? `
          <meta property="og:video" content="${mediaUrl}">
          <meta property="og:video:type" content="text/html">
          <meta name="twitter:player" content="${mediaUrl}">
          <meta name="twitter:player:width" content="1280">
          <meta name="twitter:player:height" content="720">
          <meta property="og:image" content="https://img.youtube.com/vi/${media.youtubeUrl.split('v=')[1]?.split('&')[0]}/hqdefault.jpg">
        ` : isTikTok ? `
          <meta property="og:video" content="${mediaUrl}">
          <meta property="og:video:type" content="text/html">
          <meta name="twitter:player" content="${mediaUrl}">
        ` : isFacebook ? `
          <meta property="og:video" content="${mediaUrl}">
          <meta property="og:video:type" content="text/html">
          <meta name="twitter:player" content="${mediaUrl}">
        ` : isImage ? `
          <meta property="og:image" content="${mediaUrl}">
          <meta property="og:image:alt" content="${title}">
          <meta name="twitter:image" content="${mediaUrl}">
        ` : `
          <meta property="og:video" content="${mediaUrl}">
          <meta property="og:video:type" content="video/mp4">
          <meta name="twitter:player" content="${mediaUrl}">
        `}
        <meta name="twitter:card" content="${twitterCard}">
        <meta name="twitter:title" content="${title}">
        <meta name="twitter:description" content="${description}">
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
          .external-video {
            width: 100%;
            aspect-ratio: 16/9;
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
          window.location.href = 'http://localhost:3000';
        </script>
      </head>
      <body>
        <div class="media-container">
          <h1>${title}</h1>
          <p>Par : ${media.owner?.username || media.owner?.email || 'Utilisateur inconnu'} (${media.points} FCFA)</p>
          ${isYouTube ? `
            <a href="${mediaUrl}" target="_blank" class="external-video media-content">Voir sur YouTube</a>
          ` : isTikTok ? `
            <a href="${mediaUrl}" target="_blank" class="external-video media-content">Voir sur TikTok</a>
          ` : isFacebook ? `
            <a href="${mediaUrl}" target="_blank" class="external-video media-content">Voir sur Facebook</a>
          ` : isImage ? `
            <img src="${mediaUrl}" alt="${title}" class="media-content">
          ` : `
            <video src="${mediaUrl}" controls autoplay muted class="media-content">
              <source src="${mediaUrl}" type="video/mp4">
              Votre navigateur ne prend pas en charge la lecture de vidéos.
            </video>
          `}
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

// Route pour l'inscription
app.post('/register', async (req, res) => {
  const { email, password, username, whatsappNumber, whatsappMessage } = req.body;
  try {
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
      points: 100,
      ipHistory: [{ ip: getClientIp(req), lastAction: new Date() }],
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

    await transporter.sendMail(mailOptions);
    res.status(201).json({ message: 'Utilisateur inscrit. Vérifiez votre email.' });
  } catch (error) {
    console.error('Erreur /register:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour demander un nouveau code de vérification
app.post('/request-verification', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (user.isVerified) return res.status(400).json({ message: 'Compte déjà vérifié' });

    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 15 * 60 * 1000;
    user.ipHistory = user.ipHistory || [];
    user.ipHistory.push({ ip: getClientIp(req), lastAction: new Date() });
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

// Route pour vérifier le code de vérification
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
    user.ipHistory = user.ipHistory || [];
    user.ipHistory.push({ ip: getClientIp(req), lastAction: new Date() });
    await user.save();

    res.json({ message: 'Compte vérifié avec succès.' });
  } catch (error) {
    console.error('Erreur /verify-code:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour vérifier l'email via lien
app.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) return res.status(400).json({ message: 'Lien de vérification invalide ou expiré' });

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    user.ipHistory = user.ipHistory || [];
    user.ipHistory.push({ ip: getClientIp(req), lastAction: new Date() });
    await user.save();

    res.json({ message: 'Email vérifié avec succès.' });
  } catch (error) {
    console.error('Erreur /verify-email:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour la connexion
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });
    if (user.blockedUntil && user.blockedUntil > new Date()) {
      return res.status(403).json({ message: `Compte bloqué jusqu'au ${user.blockedUntil.toLocaleString()}` });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: 'Mot de passe incorrect' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '2h' });
    user.ipHistory = user.ipHistory || [];
    user.ipHistory.push({ ip: getClientIp(req), lastAction: new Date() });
    await user.save();

    res.json({
      token,
      user: {
        email: user.email,
        username: user.username,
        isVerified: user.isVerified,
        whatsappNumber: user.whatsappNumber,
        whatsappMessage: user.whatsappMessage,
        profilePicture: user.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${user.profilePicture}` : '',
        points: user.points
      }
    });
  } catch (error) {
    console.error('Erreur /login:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour récupérer le profil utilisateur
app.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('email username isVerified whatsappNumber whatsappMessage profilePicture points')
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

// Route pour mettre à jour le profil
app.put('/profile', verifyToken, uploadProfile.single('profilePicture'), async (req, res) => {
  const { username, whatsappNumber, whatsappMessage } = req.body;
  try {
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

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    if (req.file && user.profilePicture) {
      try {
        const oldProfilePicturePath = path.join(__dirname, 'Uploads', 'profiles', user.profilePicture);
        await fs.access(oldProfilePicturePath);
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
    ).select('email username isVerified whatsappNumber whatsappMessage profilePicture points').lean();

    io.emit('profilePictureUpdate', {
      userId: req.user.userId,
      profilePicture: updatedUser.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${updatedUser.profilePicture}` : ''
    });

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

// Route pour uploader un média
app.post('/upload', verifyToken, upload.single('media'), async (req, res) => {
  const { originalname, youtubeUrl, tiktokUrl, facebookUrl, points } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });
    if (!originalname || !originalname.trim()) {
      return res.status(400).json({ message: 'Le nom du média est requis' });
    }
    if (!req.file && !youtubeUrl && !tiktokUrl && !facebookUrl) {
      return res.status(400).json({ message: 'Fichier ou URL requis' });
    }
    if (points && isNaN(points) || points < 0) {
      return res.status(400).json({ message: 'Points invalides' });
    }

    if (youtubeUrl) {
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|.+\?v=)?([^&=%\?]{11})/;
      if (!youtubeRegex.test(youtubeUrl)) {
        return res.status(400).json({ message: 'URL YouTube invalide' });
      }
    }

    if (tiktokUrl) {
      const tiktokRegex = /^(https?:\/\/)?(www\.)?(tiktok\.com)\/.+$/;
      if (!tiktokRegex.test(tiktokUrl)) {
        return res.status(400).json({ message: 'URL TikTok invalide' });
      }
    }

    if (facebookUrl) {
      const facebookRegex = /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.com)\/.+$/;
      if (!facebookRegex.test(facebookUrl)) {
        return res.status(400).json({ message: 'URL Facebook invalide' });
      }
    }

    const media = await Media.create({
      filename: req.file ? `/uploads/${req.file.filename}` : undefined,
      youtubeUrl,
      tiktokUrl,
      facebookUrl,
      originalname,
      owner: req.user.userId,
      points: Number(points) || 0
    });

    await PointsTransaction.create({
      user: req.user.userId,
      media: media._id,
      points: Number(points) || 0,
      type: 'credit',
      actionType: 'add',
      platform: req.file ? 'local' : youtubeUrl ? 'youtube' : tiktokUrl ? 'tiktok' : 'facebook',
      ip: getClientIp(req)
    });

    io.emit('newMedia', { media: { ...media._doc, owner: { username: user.username, email: user.email, profilePicture: user.profilePicture } } });
    res.json({ message: 'Média uploadé avec succès', media });
  } catch (error) {
    console.error('Erreur /upload:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour mettre à jour un média
app.put('/media/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { originalname, youtubeUrl, tiktokUrl, facebookUrl, points } = req.body;
  try {
    const media = await Media.findById(id);
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });
    if (media.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    if (!originalname || !originalname.trim()) {
      return res.status(400).json({ message: 'Le nom du média est requis' });
    }
    if (points && isNaN(points) || points < 0) {
      return res.status(400).json({ message: 'Points invalides' });
    }

    if (youtubeUrl) {
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|.+\?v=)?([^&=%\?]{11})/;
      if (!youtubeRegex.test(youtubeUrl)) {
        return res.status(400).json({ message: 'URL YouTube invalide' });
      }
    }

    if (tiktokUrl) {
      const tiktokRegex = /^(https?:\/\/)?(www\.)?(tiktok\.com)\/.+$/;
      if (!tiktokRegex.test(tiktokUrl)) {
        return res.status(400).json({ message: 'URL TikTok invalide' });
      }
    }

    if (facebookUrl) {
      const facebookRegex = /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.com)\/.+$/;
      if (!facebookRegex.test(facebookUrl)) {
        return res.status(400).json({ message: 'URL Facebook invalide' });
      }
    }

    media.originalname = originalname;
    media.youtubeUrl = youtubeUrl || undefined;
    media.tiktokUrl = tiktokUrl || undefined;
    media.facebookUrl = facebookUrl || undefined;
    media.points = Number(points) || media.points;
    await media.save();

    await PointsTransaction.create({
      user: req.user.userId,
      media: media._id,
      points: Number(points) || media.points,
      type: 'update',
      actionType: 'update',
      platform: media.filename ? 'local' : media.youtubeUrl ? 'youtube' : media.tiktokUrl ? 'tiktok' : 'facebook',
      ip: getClientIp(req)
    });

    io.to(req.user.userId).emit('mediaPointsUpdate', { mediaId: media._id, points: media.points });
    res.json({ message: 'Média mis à jour', media });
  } catch (error) {
    console.error('Erreur /media/:id:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour réinitialiser les points d'un média
app.put('/media/:id/points', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { points } = req.body;
  try {
    const media = await Media.findById(id);
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });
    if (media.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    if (points !== 0) {
      return res.status(400).json({ message: 'Réinitialisation à 0 uniquement' });
    }

    media.points = 0;
    await media.save();

    await PointsTransaction.create({
      user: req.user.userId,
      media: media._id,
      points: 0,
      type: 'reset',
      actionType: 'reset',
      platform: media.filename ? 'local' : media.youtubeUrl ? 'youtube' : media.tiktokUrl ? 'tiktok' : 'facebook',
      ip: getClientIp(req)
    });

    io.to(req.user.userId).emit('mediaPointsUpdate', { mediaId: media._id, points: 0 });
    res.json({ message: 'Points réinitialisés', media });
  } catch (error) {
    console.error('Erreur /media/:id/points:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour supprimer un média
app.delete('/media/:id', verifyToken, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });
    if (media.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Non autorisé' });
    }

    if (media.filename) {
      try {
        await fs.unlink(path.join(__dirname, media.filename));
      } catch (err) {
        console.error('Erreur lors de la suppression du fichier:', err);
      }
    }

    await media.deleteOne();
    io.emit('mediaDeleted', { mediaId: req.params.id });
    res.json({ message: 'Média supprimé' });
  } catch (error) {
    console.error('Erreur /media/:id:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour récupérer les utilisateurs
app.get('/users', verifyToken, async (req, res) => {
  const { q } = req.query;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const query = q
      ? {
          $and: [
            { _id: { $ne: req.user.userId } },
            { $or: [{ email: new RegExp(q, 'i') }, { username: new RegExp(q, 'i') }] },
          ],
        }
      : { _id: { $ne: req.user.userId } };

    const users = await User.find(query)
      .select('email username profilePicture')
      .lean()
      .limit(50);
    res.json(users.map(u => ({
      ...u,
      profilePicture: u.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${u.profilePicture}` : ''
    })));
  } catch (error) {
    console.error('Erreur /users:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour suivre un utilisateur
app.post('/follow', verifyToken, async (req, res) => {
  const { followingId } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (user.blockedUntil && user.blockedUntil > new Date()) {
      return res.status(403).json({ message: `Compte bloqué jusqu'au ${user.blockedUntil.toLocaleString()}` });
    }

    const fraudCheck = await checkFraud(req.user.userId, getClientIp(req), 'follow', null);
    if (fraudCheck.isBlocked) return res.status(403).json({ message: fraudCheck.message });

    const toFollow = await User.findById(followingId);
    if (!toFollow) return res.status(404).json({ message: 'Utilisateur à suivre non trouvé' });
    if (user.following.includes(followingId)) {
      return res.status(400).json({ message: 'Déjà suivi' });
    }

    user.following.push(followingId);
    user.dailyActions.follows += 1;
    user.points += 100;
    await user.save();

    await PointsTransaction.create({
      user: req.user.userId,
      points: 100,
      type: 'credit',
      actionType: 'follow',
      ip: getClientIp(req)
    });

    io.to(req.user.userId).emit('pointsUpdate', { points: user.points });
    res.json({ message: 'Utilisateur suivi', points: user.points });
  } catch (error) {
    console.error('Erreur /follow:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour se désabonner
app.delete('/follow', verifyToken, async (req, res) => {
  const { followingId } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (!user.following.includes(followingId)) {
      return res.status(400).json({ message: 'Non suivi' });
    }

    user.following = user.following.filter(id => id.toString() !== followingId);
    await user.save();
    res.json({ message: 'Désabonnement réussi' });
  } catch (error) {
    console.error('Erreur /follow:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour récupérer les abonnements
app.get('/follows', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate('following', 'email username profilePicture').lean();
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json(user.following.map(f => ({
      ...f,
      profilePicture: f.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${f.profilePicture}` : ''
    })));
  } catch (error) {
    console.error('Erreur /follows:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour récupérer le fil
app.get('/feed', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const medias = await Media.find({ owner: { $in: user.following } })
      .populate('owner', 'username email profilePicture')
      .sort({ uploadedAt: -1 })
      .lean()
      .limit(50);
    res.json(medias.map(m => ({
      ...m,
      filename: m.filename ? `${req.protocol}://${req.get('host')}${m.filename}` : undefined,
      owner: {
        ...m.owner,
        profilePicture: m.owner.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${m.owner.profilePicture}` : ''
      }
    })));
  } catch (error) {
    console.error('Erreur /feed:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour récupérer mes médias
app.get('/my-medias', verifyToken, async (req, res) => {
  try {
    const medias = await Media.find({ owner: req.user.userId })
      .populate('owner', 'username email profilePicture')
      .sort({ uploadedAt: -1 })
      .lean();
    res.json(medias.map(m => ({
      ...m,
      filename: m.filename ? `${req.protocol}://${req.get('host')}${m.filename}` : undefined,
      owner: {
        ...m.owner,
        profilePicture: m.owner.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${m.owner.profilePicture}` : ''
      }
    })));
  } catch (error) {
    console.error('Erreur /my-medias:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour effectuer une action (like, view, follow)
app.post('/action/:mediaId/:actionType/:platform', verifyToken, async (req, res) => {
  const { mediaId, actionType, platform } = req.params;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (user.blockedUntil && user.blockedUntil > new Date()) {
      return res.status(403).json({ message: `Compte bloqué jusqu'au ${user.blockedUntil.toLocaleString()}` });
    }

    const media = await Media.findById(mediaId);
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });
    if (media.owner.toString() === req.user.userId) {
      return res.status(400).json({ message: 'Vous ne pouvez pas interagir avec votre propre média' });
    }
    if (!['youtube', 'tiktok', 'facebook'].includes(platform)) {
      return res.status(400).json({ message: 'Plateforme invalide' });
    }
    if (!['like', 'view', 'follow'].includes(actionType)) {
      return res.status(400).json({ message: 'Type d’action invalide' });
    }
    if (!media[`${platform}Url`]) {
      return res.status(400).json({ message: `URL ${platform} non disponible pour ce média` });
    }
    if (media.points < (actionType === 'follow' ? 100 : 50)) {
      return res.status(400).json({ message: 'Points insuffisants pour cette action' });
    }

    const fraudCheck = await checkFraud(req.user.userId, getClientIp(req), actionType, mediaId);
    if (fraudCheck.isBlocked) return res.status(403).json({ message: fraudCheck.message });

    const pointsToDeduct = actionType === 'follow' ? 100 : 50;
    const actionToken = crypto.randomBytes(16).toString('hex');
    const action = await Action.create({
      user: req.user.userId,
      media: mediaId,
      actionType,
      platform,
      token: actionToken,
      ip: getClientIp(req)
    });

    user.dailyActions[actionType + 's'] += 1;
    user.points += pointsToDeduct;
    media.points -= pointsToDeduct;
    await user.save();
    await media.save();

    await PointsTransaction.create({
      user: req.user.userId,
      media: mediaId,
      points: pointsToDeduct,
      type: 'credit',
      actionType,
      platform,
      ip: getClientIp(req)
    });

    await PointsTransaction.create({
      user: media.owner,
      media: mediaId,
      points: -pointsToDeduct,
      type: 'debit',
      actionType,
      platform,
      ip: getClientIp(req)
    });

    io.to(req.user.userId).emit('pointsUpdate', { points: user.points });
    io.to(media.owner.toString()).emit('pointsUpdate', { points: (await User.findById(media.owner)).points });
    io.emit('mediaPointsUpdate', { mediaId, points: media.points });

    res.json({ message: 'Action enregistrée', actionUrl: `${media[`${platform}Url`]}?actionToken=${actionToken}` });
  } catch (error) {
    console.error('Erreur /action:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour valider une action
app.post('/validate-action/:actionToken', verifyToken, async (req, res) => {
  const { actionToken } = req.params;
  try {
    const action = await Action.findOne({ token: actionToken }).populate('media');
    if (!action) return res.status(404).json({ message: 'Action non trouvée' });
    if (action.user.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    if (action.validated) return res.status(400).json({ message: 'Action déjà validée' });

    action.validated = true;
    await action.save();

    const user = await User.findById(req.user.userId);
    res.json({ message: 'Action validée', points: user.points, mediaPoints: action.media.points });
  } catch (error) {
    console.error('Erreur /validate-action:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour calculer l'espace disque utilisé
app.get('/disk-usage', verifyToken, async (req, res) => {
  try {
    const medias = await Media.find({ owner: req.user.userId });
    let totalSize = 0;
    for (const media of medias) {
      if (media.filename) {
        try {
          const stats = await fs.stat(path.join(__dirname, media.filename));
          totalSize += stats.size;
        } catch (err) {
          console.error(`Erreur stat fichier ${media.filename}:`, err);
        }
      }
    }
    res.json({ used: totalSize });
  } catch (error) {
    console.error('Erreur /disk-usage:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour ajouter un like
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
    io.to(media.owner.toString()).emit('likeUpdate', {
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

// Route pour retirer un like
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
    io.to(media.owner.toString()).emit('unlikeUpdate', {
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

// Route pour ajouter un dislike
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
    io.to(media.owner.toString()).emit('dislikeUpdate', {
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

// Route pour retirer un dislike
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
    io.to(media.owner.toString()).emit('undislikeUpdate', {
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

// Route pour ajouter un commentaire
app.post('/comment/:mediaId', verifyToken, upload.single('media'), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });

    const media = await Media.findById(req.params.mediaId)
      .populate('owner', 'email username whatsappNumber whatsappMessage pushSubscription profilePicture');
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });

    const { content } = req.body;
    if (!content?.trim() && !req.file) {
      return res.status(400).json({ message: 'Le commentaire doit contenir du texte ou un média' });
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
            ${req.file ? `<img src="${req.protocol}://${req.get('host')}/uploads/${req.file.filename}" alt="Commentaire média" style="max-width: 100%; height: auto;" />` : ''}
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
        data: { url: `http://localhost:3000/media/${media._id}` },
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
    res.json({
      message: 'Commentaire ajouté',
      points: user.points,
      comments: updatedMedia.comments.map(comment => ({
        ...comment,
        media: comment.media ? `${req.protocol}://${req.get('host')}/uploads/${comment.media}` : null,
        author: {
          ...comment.author,
          profilePicture: comment.author.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${comment.author.profilePicture}` : ''
        }
      }))
    });

    io.to(media.owner._id.toString()).emit('commentUpdate', {
      mediaId: req.params.mediaId,
      comment: {
        ...newComment,
        media: newComment.media ? `${req.protocol}://${req.get('host')}/uploads/${newComment.media}` : null,
        author: {
          _id: req.user.userId,
          username: user.username,
          profilePicture: user.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${user.profilePicture}` : ''
        },
      },
    });
  } catch (error) {
    console.error('Erreur /comment/:mediaId POST:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour modifier un commentaire
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
    if (!content?.trim() && !req.file) {
      return res.status(400).json({ message: 'Le commentaire doit contenir du texte ou un média' });
    }

    if (req.file && comment.media) {
      try {
        const oldMediaPath = path.join(__dirname, 'Uploads', comment.media);
        await fs.access(oldMediaPath);
        await fs.unlink(oldMediaPath);
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
            ${req.file ? `<img src="${req.protocol}://${req.get('host')}/uploads/${req.file.filename}" alt="Commentaire média" style="max-width: 100%; height: auto;" />` : ''}
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
        data: { url: `http://localhost:3000/media/${media._id}` },
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
    res.json({
      message: 'Commentaire modifié',
      comments: updatedMedia.comments.map(comment => ({
        ...comment,
        media: comment.media ? `${req.protocol}://${req.get('host')}/uploads/${comment.media}` : null,
        author: {
          ...comment.author,
          profilePicture: comment.author.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${comment.author.profilePicture}` : ''
        }
      }))
    });

    io.to(media.owner._id.toString()).emit('commentUpdate', {
      mediaId: req.params.mediaId,
      comment: {
        _id: req.params.commentId,
        content: content ? content.trim() : '',
        media: req.file ? req.file.filename : comment.media,
        author: {
          _id: req.user.userId,
          username: user.username,
          profilePicture: user.profilePicture ? `${req.protocol}://${req.get('host')}/uploads/profiles/${user.profilePicture}` : ''
        },
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Erreur /comment/:mediaId/:commentId PUT:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour supprimer un commentaire
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
        const mediaPath = path.join(__dirname, 'Uploads', comment.media);
        await fs.access(mediaPath);
        await fs.unlink(mediaPath);
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
        data: { url: `http://localhost:3000/media/${media._id}` },
      });

      try {
        await webPush.sendNotification(media.owner.pushSubscription, payload);
      } catch (error) {
        console.error('Erreur envoi notification push:', error);
      }
    }

    res.json({ message: 'Commentaire supprimé', comments: media.comments });
    io.to(media.owner._id.toString()).emit('commentDeleted', { mediaId: req.params.mediaId, commentId: req.params.commentId });
  } catch (error) {
    console.error('Erreur /comment/:mediaId/:commentId DELETE:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour enregistrer une vue
app.post('/view/:mediaId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });

    const media = await Media.findById(req.params.mediaId);
    if (!media) return res.status(404).json({ message: 'Média non trouvé' });

    if (media.views.includes(req.user.userId)) {
      return res.status(400).json({ message: 'Vue déjà enregistrée pour ce média' });
    }

    media.views.push(req.user.userId);
    await media.save();

    res.json({ message: 'Vue enregistrée', points: user.points });
    io.to(req.user.userId).emit('viewUpdate', {
      mediaId: req.params.mediaId,
      points: user.points
    });
  } catch (error) {
    console.error('Erreur /view/:mediaId POST:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Lancement du serveur
const PORT = process.env.SERVER_PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Serveur actif sur http://localhost:${PORT}`));
