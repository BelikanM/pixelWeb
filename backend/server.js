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
const cloudinary = require('cloudinary').v2;

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

// Configuration de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
});
const User = mongoose.model('User', userSchema);

// Schéma média
const mediaSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  cloudinaryUrl: String,
  cloudinaryPublicId: String,
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
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token requis', error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Erreur verifyToken:', error.message);
    res.status(403).json({ message: 'Token invalide', error: error.message });
  }
};

// Multer config (stockage temporaire avant upload Cloudinary)
const storage = multer.memoryStorage();
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
  },
});

// Générer un code de vérification
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// WebSocket : Gestion des connexions avec authentification
io.use((socket, next) => {
  const token = socket.handshake.auth.token?.split(' ')[1];
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
      .populate('owner', 'username email whatsappNumber whatsappMessage')
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

    const mediaUrl = media.cloudinaryUrl;
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
    });

    const verificationLink = `http://localhost:${process.env.SERVER_PORT}/verify-email?token=${verificationToken}`;
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
  try {
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
      },
    });
  } catch (error) {
    console.error('Erreur /login:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Profil utilisateur
app.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('email username isVerified whatsappNumber whatsappMessage')
      .lean();
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json(user);
  } catch (error) {
    console.error('Erreur /profile:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Mettre à jour le profil
app.put('/profile', verifyToken, async (req, res) => {
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
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        username: username.trim(),
        whatsappNumber: whatsappNumber || '',
        whatsappMessage: whatsappMessage || 'Découvrez ce contenu sur Pixels Media !',
      },
      { new: true, runValidators: true }
    ).select('email username isVerified whatsappNumber whatsappMessage').lean();
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json({ message: 'Profil mis à jour', user });
  } catch (error) {
    console.error('Erreur /profile PUT:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Upload média vers Cloudinary
app.post('/upload', verifyToken, upload.single('media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier fourni' });
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isVerified) return res.status(403).json({ message: 'Veuillez vérifier votre email.' });

    // Upload vers Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', public_id: `media_${Date.now()}_${req.file.originalname}` },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const media = await Media.create({
      filename: req.file.originalname,
      originalname: req.file.originalname,
      cloudinaryUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      owner: req.user.userId,
      likes: [],
      dislikes: [],
      comments: [],
    });

    const populatedMedia = await Media.findById(media._id)
      .populate('owner', 'email username whatsappNumber whatsappMessage')
      .lean();
    res.status(201).json({ message: 'Fichier uploadé', media: populatedMedia });

    // Envoyer une notification push
    if (user.pushSubscription) {
      const payload = JSON.stringify({
        title: 'Nouveau média uploadé !',
        body: `${user.username || user.email} a uploadé : ${media.originalname}`,
        icon: '/icon.png',
        data: { url: `http://localhost:3000/media/${media._id}` },
      });
      webPush.sendNotification(user.pushSubscription, payload).catch((error) => {
        console.error('Erreur envoi notification push:', error);
      });
    }

    io.to(user._id.toString()).emit('newMedia', { media: populatedMedia, owner: user });
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
      .populate('owner', 'email username whatsappNumber whatsappMessage')
      .populate('comments.author', 'username')
      .sort({ uploadedAt: -1 })
      .lean();
    const mediasWithLikes = medias.map(media => ({
      ...media,
      likesCount: media.likes.length,
      dislikesCount: media.dislikes.length,
      isLiked: media.likes.some(id => id.toString() === req.user.userId),
      isDisliked: media.dislikes.some(id => id.toString() === req.user.userId),
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
    }).select('email username whatsappNumber whatsappMessage').lean();
    res.json(users || []);
  } catch (error) {
    console.error('Erreur /users:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Liste des followings
app.get('/follows', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('following', 'email username whatsappNumber whatsappMessage')
      .lean();
    res.json(user.following || []);
  } catch (error) {
    console.error('Erreur /follows:', error);
    res.status(500).json({ message: 'Erreur serveur', error:
