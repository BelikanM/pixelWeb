require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const cors = require("cors");
const app = express();

// Config
const PORT = 5050;
const {
  MONGODB_URI,
  JWT_SECRET,
  EMAIL_USER,
  EMAIL_PASS
} = process.env;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// DB connection
mongoose.connect(MONGODB_URI).then(() => console.log("✅ MongoDB connected"));

// Models
const UserSchema = new mongoose.Schema({
  email: String,
  password: String,
  role: { type: String, enum: ["admin", "user"], default: "user" },
  phoneNumber: String,
  airtelQRCode: String,
  earnings: { type: Number, default: 0 },
  warnings: { type: Number, default: 0 }
});
const User = mongoose.model("User", UserSchema);

const AdSchema = new mongoose.Schema({
  url: String,
  amountCFA: Number,
  ownerId: mongoose.Types.ObjectId,
  views: { type: Number, default: 0 },
  interactions: { type: Number, default: 0 },
  remainingBudget: Number
});
const Ad = mongoose.model("Ad", AdSchema);

const InteractionSchema = new mongoose.Schema({
  userId: mongoose.Types.ObjectId,
  adId: mongoose.Types.ObjectId,
  type: String,
  reward: Number,
  timestamp: { type: Date, default: Date.now }
});
const Interaction = mongoose.model("Interaction", InteractionSchema);

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Routes
app.post("/api/register", async function (req, res) {
  const { email, password, phoneNumber, airtelQRCode } = req.body;
  try {
    const user = await User.create({ email, password, phoneNumber, airtelQRCode });
    res.json({ message: "User registered" });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/login", async function (req, res) {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/ads", async function (req, res) {
  const { token, url, amountCFA } = req.body;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const ad = await Ad.create({
      url,
      amountCFA,
      remainingBudget: amountCFA,
      ownerId: payload.id
    });
    res.json({ ad });
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
});

app.get("/api/feed", async function (req, res) {
  const ads = await Ad.find({ remainingBudget: { $gt: 0 } });
  res.json(ads);
});

app.post("/api/interact", async function (req, res) {
  const { token, adId, type } = req.body;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const reward = type === "view" ? 10 : 5;
    const ad = await Ad.findById(adId);
    if (!ad || ad.remainingBudget < reward) {
      return res.status(400).json({ error: "Budget épuisé" });
    }
    ad.remainingBudget -= reward;
    ad.interactions += 1;
    await ad.save();
    await Interaction.create({ userId: payload.id, adId, type, reward });
    await User.findByIdAndUpdate(payload.id, { $inc: { earnings: reward } });
    res.json({ message: "Interaction enregistrée", reward });
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
});

app.get("/api/dashboard", async function (req, res) {
  const token = req.headers.token;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const ads = await Ad.find({ ownerId: payload.id });
    const interactions = await Interaction.find({ userId: payload.id });
    const user = await User.findById(payload.id);
    res.json({
      ads,
      interactions,
      earnings: user.earnings,
      warnings: user.warnings
    });
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
});

app.get("/api/warnings", async function (req, res) {
  const token = req.headers.token;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id);
    res.json({ warnings: user.warnings });
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
});

// Start server
app.listen(PORT, function () {
  console.log("🚀 Server running on port " + PORT);
});
