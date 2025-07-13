// ads.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const cors = require("cors");
const bcryptjs = require("bcryptjs");
const z = require("zod");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const app = express();

// Configuration
const PORT = process.env.PORT || 5050;
const {
  MONGODB_URI,
  JWT_SECRET,
  EMAIL_USER,
  EMAIL_PASS,
} = process.env;

// Middleware
app.use(helmet()); // En-têtes de sécurité
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "10mb" }));

// Limitation de taux pour les endpoints sensibles
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes maximum par fenêtre
  message: "Trop de requêtes, veuillez réessayer plus tard.",
});

// Schémas de validation des entrées
const RegisterSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Mot de passe trop court"),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Numéro de téléphone invalide"),
  airtelQRCode: z.string().min(1, "Code QR Airtel requis"),
});

const LoginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Mot de passe trop court"),
});

const AdSchemaInput = z.object({
  url: z.string().url().includes("youtube.com", { message: "URL YouTube invalide" }),
  amountCFA: z.number().positive("Montant doit être positif"),
});

const InteractSchema = z.object({
  adId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID de l'annonce invalide"),
  type: z.enum(["view", "like"], "Type d'interaction invalide"),
});

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erreur interne du serveur" });
});

// Connexion à la base de données
mongoose
  .connect(MONGODB_URI, { autoIndex: true })
  .then(() => console.log("✅ MongoDB connecté"))
  .catch((err) => console.error("❌ Échec de la connexion MongoDB :", err));

// Modèles
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "user"], default: "user" },
  phoneNumber: { type: String, required: true },
  airtelQRCode: { type: String, required: true },
  earnings: { type: Number, default: 0 },
  warnings: { type: Number, default: 0 },
});
const User = mongoose.model("User", UserSchema);

const AdSchema = new mongoose.Schema({
  url: { type: String, required: true },
  amountCFA: { type: Number, required: true },
  ownerId: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
  views: { type: Number, default: 0 },
  interactions: { type: Number, default: 0 },
  remainingBudget: { type: Number, required: true },
});
const Ad = mongoose.model("Ad", AdSchema);

const InteractionSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
  adId: { type: mongoose.Types.ObjectId, required: true, ref: "Ad" },
  type: { type: String, enum: ["view", "like"], required: true },
  reward: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});
const Interaction = mongoose.model("Interaction", InteractionSchema);

// Configuration de l'envoi d'emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// Middleware de vérification du token JWT
const verifyToken = (req, res, next) => {
  const token = req.body.token || req.headers.token;
  if (!token) return res.status(401).json({ error: "Token requis" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
};

// Routes
app.post("/api/register", authLimiter, async (req, res) => {
  try {
    const { email, password, phoneNumber, airtelQRCode } = RegisterSchema.parse(req.body);
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email déjà utilisé" });

    const hashedPassword = await bcryptjs.hash(password, 10);
    const user = await User.create({
      email,
      password: hashedPassword,
      phoneNumber,
      airtelQRCode,
    });

    // Envoi d'un email de bienvenue
    await transporter.sendMail({
      from: EMAIL_USER,
      to: email,
      subject: "Bienvenue sur la plateforme d'annonces !",
      text: `Bonjour, ${email} ! Votre compte a été créé avec succès.`,
    });

    res.status(201).json({ message: "Utilisateur enregistré avec succès" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    res.status(500).json({ error: "Échec de l'inscription" });
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const user = await User.findOne({ email });
    if (!user || !(await bcryptjs.compare(password, user.password))) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({ token, role: user.role });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    res.status(500).json({ error: "Échec de la connexion" });
  }
});

app.post("/api/ads", verifyToken, async (req, res) => {
  try {
    const { url, amountCFA } = AdSchemaInput.parse(req.body);
    const ad = await Ad.create({
      url,
      amountCFA,
      remainingBudget: amountCFA,
      ownerId: req.user.id,
    });
    res.status(201).json({ ad });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    res.status(500).json({ error: "Échec de la création de l'annonce" });
  }
});

app.get("/api/feed", async (req, res) => {
  try {
    const ads = await Ad.find({ remainingBudget: { $gt: 0 } }).populate(
      "ownerId",
      "email"
    );
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: "Échec de la récupération des annonces" });
  }
});

app.post("/api/interact", verifyToken, async (req, res) => {
  try {
    const { adId, type } = InteractSchema.parse(req.body);
    const reward = type === "view" ? 10 : 5;
    const ad = await Ad.findById(adId);
    if (!ad) return res.status(404).json({ error: "Annonce non trouvée" });
    if (ad.remainingBudget < reward) {
      return res.status(400).json({ error: "Budget épuisé" });
    }

    // Vérification des interactions en double
    const existingInteraction = await Interaction.findOne({
      userId: req.user.id,
      adId,
      type,
    });
    if (existingInteraction) {
      return res.status(400).json({ error: "Interaction déjà enregistrée" });
    }

    // Mise à jour de l'annonce
    ad.remainingBudget -= reward;
    ad.interactions += 1;
    if (type === "view") ad.views += 1;
    await ad.save();

    // Enregistrement de l'interaction
    await Interaction.create({ userId: req.user.id, adId, type, reward });

    // Mise à jour des gains de l'utilisateur
    await User.findByIdAndUpdate(req.user.id, { $inc: { earnings: reward } });

    res.json({ message: "Interaction enregistrée", reward });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    res.status(500).json({ error: "Échec de l'interaction" });
  }
});

app.get("/api/dashboard", verifyToken, async (req, res) => {
  try {
    const [ads, interactions, user] = await Promise.all([
      Ad.find({ ownerId: req.user.id }),
      Interaction.find({ userId: req.user.id }).populate("adId", "url"),
      User.findById(req.user.id),
    ]);
    res.json({
      ads,
      interactions,
      earnings: user.earnings,
      warnings: user.warnings,
    });
  } catch (err) {
    res.status(500).json({ error: "Échec de la récupération des données du tableau de bord" });
  }
});

app.get("/api/warnings", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ warnings: user.warnings });
  } catch (err) {
    res.status(500).json({ error: "Échec de la récupération des avertissements" });
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
