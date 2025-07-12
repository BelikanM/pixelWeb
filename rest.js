import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import axios from 'axios';
import bcrypt from 'bcryptjs'; // ✅ remplacé ici

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// === MODELS ===
const userSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  email: String,
  picture: String,
  totalGains: { type: Number, default: 0 },
});

const User = mongoose.model('User', userSchema);

// === MONGODB CONNECT ===
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connecté');
}).catch((err) => {
  console.error('❌ Erreur MongoDB :', err);
});

// === AUTH YOUTUBE ===
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.get('/auth/google', (req, res) => {
  const scope = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/youtube.readonly'
  ].join(' ');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
  res.json({ url: authUrl });
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;

  try {
    const { data } = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });

    let user = await User.findOne({ googleId: userInfo.data.id });
    if (!user) {
      user = await User.create({
        googleId: userInfo.data.id,
        name: userInfo.data.name,
        email: userInfo.data.email,
        picture: userInfo.data.picture,
        totalGains: 0,
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token });
  } catch (err) {
    console.error('❌ OAuth error:', err);
    res.status(500).json({ error: 'OAuth2 error' });
  }
});

// === MIDDLEWARE JWT ===
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) return res.status(401).json({ error: 'Utilisateur inconnu' });
    next();
  } catch {
    return res.status(403).json({ error: 'Token invalide' });
  }
};

// === ROUTES UTILISATEUR ===
app.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

app.post('/reward', authMiddleware, async (req, res) => {
  const { action } = req.body;
  let reward = 0;

  switch (action) {
    case 'watch':
      reward = 5;
      break;
    case 'like':
      reward = 10;
      break;
    case 'subscribe':
      reward = 25;
      break;
    default:
      return res.status(400).json({ error: 'Action invalide' });
  }

  req.user.totalGains += reward;
  await req.user.save();

  res.json({ message: 'Récompense ajoutée', total: req.user.totalGains });
});

// === DEMARRAGE SERVEUR ===
const PORT = 5050;
app.listen(PORT, () => {
  console.log(`🚀 API de rémunération YouTube active sur http://localhost:${PORT}`);
});
