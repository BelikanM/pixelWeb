// src/pages/sections/Connexion.js
import React, { useState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import toast from "react-hot-toast";

const Connexion = ({ setToken, navigate }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [chargement, setChargement] = useState(false);

  const seConnecter = async () => {
    if (!email || !password) {
      return toast.error("Tous les champs sont obligatoires.");
    }

    setChargement(true);
    try {
      const res = await fetch("http://localhost:5050/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (data.token) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
        toast.success("Connexion réussie ✅");
        navigate("dashboard");
      } else {
        toast.error("Identifiants incorrects ❌");
      }
    } catch (err) {
      console.error("Erreur serveur :", err);
      toast.error("Erreur lors de la connexion.");
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">🔐 Connexion à la plateforme</h2>

      <div className="relative mb-4">
        <Mail className="absolute top-3 left-3 text-gray-400" size={20} />
        <input
          type="email"
          placeholder="Email"
          value={email}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="relative mb-6">
        <Lock className="absolute top-3 left-3 text-gray-400" size={20} />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button
        onClick={seConnecter}
        disabled={chargement}
        className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-white transition-all ${
          chargement ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        <LogIn size={20} />
        {chargement ? "Connexion en cours..." : "Se connecter"}
      </button>
    </div>
  );
};

export default Connexion;
