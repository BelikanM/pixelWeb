import React, { useState } from "react";
import axios from "axios";

export default function Connexion({ setToken, navigate }) {
  const [mode, setMode] = useState("login"); // "login" ou "register"
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    phoneNumber: ""
  });
  const [qrFile, setQrFile] = useState(null);
  const [msg, setMsg] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("http://localhost:5050/api/login", loginForm);
      localStorage.setItem("token", res.data.token);
      setToken(res.data.token);
      setMsg("✅ Connexion réussie !");
      navigate("dashboard");
    } catch (err) {
      setMsg("❌ Connexion échouée: " + (err.response?.data?.error || err.message));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const data = new FormData();
    Object.keys(registerForm).forEach((key) => data.append(key, registerForm[key]));
    if (qrFile) data.append("airtelQRCode", qrFile);
    try {
      await axios.post("http://localhost:5050/api/register", data);
      setMsg("✅ Inscription réussie ! Vous pouvez vous connecter.");
      setMode("login");
    } catch (err) {
      const error = err.response?.data?.error || "Erreur lors de l'inscription.";
      setMsg("❌ " + (typeof error === "string" ? error : JSON.stringify(error)));
    }
  };

  return (
    <section className="max-w-md mx-auto p-4">
      <div className="flex justify-between mb-4">
        <button
          onClick={() => setMode("login")}
          className={`px-4 py-2 rounded ${mode === "login" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
        >
          Connexion
        </button>
        <button
          onClick={() => setMode("register")}
          className={`px-4 py-2 rounded ${mode === "register" ? "bg-green-600 text-white" : "bg-gray-200"}`}
        >
          Inscription
        </button>
      </div>

      {mode === "login" ? (
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            className="border p-2 w-full"
            required
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            className="border p-2 w-full"
            required
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded w-full">
            Se connecter
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            className="border p-2 w-full"
            required
            onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            className="border p-2 w-full"
            required
            onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
          />
          <input
            type="text"
            placeholder="Numéro de téléphone"
            className="border p-2 w-full"
            required
            onChange={(e) => setRegisterForm({ ...registerForm, phoneNumber: e.target.value })}
          />
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            className="border p-2 w-full"
            required
            onChange={(e) => setQrFile(e.target.files[0])}
          />
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded w-full">
            S’inscrire
          </button>
        </form>
      )}

      {msg && <p className="mt-4 text-sm text-center text-red-600">{msg}</p>}
    </section>
  );
}
