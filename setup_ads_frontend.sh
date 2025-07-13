#!/bin/bash

echo "🛠️ Création des composants publicitaires..."

mkdir -p src/pages/sections

# --- Créer Gallery.js ---
cat > src/pages/Gallery.js <<'EOF'
import React, { useState } from "react";
import Connexion from "./sections/Connexion";
import FormulairePub from "./sections/FormulairePub";
import AffichagePub from "./sections/AffichagePub";
import DashboardPub from "./sections/DashboardPub";
import FeedPub from "./sections/FeedPub";
import UtilisateurDashboard from "./sections/UtilisateurDashboard";
import Avertissements from "./sections/Avertissements";

const Gallery = () => {
  const [section, setSection] = useState("connexion");
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  const navigate = (s) => setSection(s);

  const sections = {
    connexion: <Connexion setToken={setToken} navigate={navigate} />,
    formulaire: <FormulairePub token={token} navigate={navigate} />,
    affichage: <AffichagePub token={token} navigate={navigate} />,
    dashboard: <DashboardPub token={token} navigate={navigate} />,
    feed: <FeedPub token={token} navigate={navigate} />,
    utilisateur: <UtilisateurDashboard token={token} />,
    avertissements: <Avertissements token={token} />
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <nav className="flex overflow-x-auto space-x-2 p-2 bg-white shadow">
        <button onClick={() => navigate("connexion")} className="px-4 py-2 bg-blue-500 text-white rounded">Connexion</button>
        <button onClick={() => navigate("formulaire")} className="px-4 py-2 bg-blue-500 text-white rounded">Créer Pub</button>
        <button onClick={() => navigate("affichage")} className="px-4 py-2 bg-blue-500 text-white rounded">Affichage</button>
        <button onClick={() => navigate("dashboard")} className="px-4 py-2 bg-blue-500 text-white rounded">Dashboard</button>
        <button onClick={() => navigate("feed")} className="px-4 py-2 bg-blue-500 text-white rounded">Feed</button>
        <button onClick={() => navigate("utilisateur")} className="px-4 py-2 bg-green-600 text-white rounded">Mes Gains</button>
        <button onClick={() => navigate("avertissements")} className="px-4 py-2 bg-red-500 text-white rounded">Avertissements</button>
      </nav>
      <main className="p-4">{sections[section]}</main>
    </div>
  );
};

export default Gallery;
EOF

# --- Créer chaque composant ---
declare -A components

components["Connexion.js"]="import React, { useState } from 'react';
const Connexion = ({ setToken, navigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = async () => {
    const res = await fetch('http://localhost:5050/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      navigate('dashboard');
    }
  };
  return (
    <div>
      <h2>Connexion</h2>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder='Email' />
      <input type='password' value={password} onChange={e => setPassword(e.target.value)} placeholder='Mot de passe' />
      <button onClick={login}>Se connecter</button>
    </div>
  );
};
export default Connexion;"

components["FormulairePub.js"]="import React, { useState } from 'react';
const FormulairePub = ({ token }) => {
  const [url, setUrl] = useState('');
  const [amountCFA, setAmountCFA] = useState('');
  const envoyer = async () => {
    await fetch('http://localhost:5050/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, url, amountCFA: parseInt(amountCFA) })
    });
    alert('Publicité créée !');
  };
  return (
    <div>
      <h2>Créer une publicité</h2>
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder='URL YouTube' />
      <input type='number' value={amountCFA} onChange={e => setAmountCFA(e.target.value)} placeholder='Montant CFA' />
      <button onClick={envoyer}>Envoyer</button>
    </div>
  );
};
export default FormulairePub;"

components["AffichagePub.js"]="import React, { useEffect, useState } from 'react';
const AffichagePub = ({ token }) => {
  const [pub, setPub] = useState(null);
  useEffect(() => {
    fetch('http://localhost:5050/api/feed').then(res => res.json()).then(data => setPub(data[0]));
  }, []);
  const interagir = async () => {
    await fetch('http://localhost:5050/api/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, adId: pub._id, type: 'view' })
    });
    alert(\"Interaction enregistrée !\");
  };
  if (!pub) return <p>Aucune publicité disponible</p>;
  return (
    <div>
      <h2>Publicité</h2>
      <iframe src={pub.url} title='vidéo' />
      <progress value={pub.amountCFA - pub.remainingBudget} max={pub.amountCFA}></progress>
      <button onClick={interagir}>J'ai regardé</button>
    </div>
  );
};
export default AffichagePub;"

components["DashboardPub.js"]="import React, { useEffect, useState } from 'react';
const DashboardPub = ({ token }) => {
  const [data, setData] = useState({ ads: [] });
  useEffect(() => {
    fetch('http://localhost:5050/api/dashboard', { headers: { token } })
      .then(res => res.json())
      .then(setData);
  }, [token]);
  return (
    <div>
      <h2>Dashboard</h2>
      {data.ads.map(ad => (
        <div key={ad._id}>{ad.url} - {ad.remainingBudget} CFA restants</div>
      ))}
    </div>
  );
};
export default DashboardPub;"

components["FeedPub.js"]="import React, { useEffect, useState } from 'react';
const FeedPub = ({ token }) => {
  const [ads, setAds] = useState([]);
  useEffect(() => {
    fetch('http://localhost:5050/api/feed').then(res => res.json()).then(setAds);
  }, []);
  return (
    <div>
      <h2>Feed</h2>
      {ads.map(ad => (
        <div key={ad._id}>
          {ad.url}
          <progress value={ad.amountCFA - ad.remainingBudget} max={ad.amountCFA}></progress>
        </div>
      ))}
    </div>
  );
};
export default FeedPub;"

components["UtilisateurDashboard.js"]="import React, { useEffect, useState } from 'react';
const UtilisateurDashboard = ({ token }) => {
  const [earnings, setEarnings] = useState(0);
  useEffect(() => {
    fetch('http://localhost:5050/api/dashboard', { headers: { token } })
      .then(res => res.json())
      .then(data => setEarnings(data.earnings || 0));
  }, [token]);
  return <div>Gains cumulés : {earnings} FCFA</div>;
};
export default UtilisateurDashboard;"

components["Avertissements.js"]="import React, { useEffect, useState } from 'react';
const Avertissements = ({ token }) => {
  const [warnings, setWarnings] = useState(0);
  useEffect(() => {
    fetch('http://localhost:5050/api/warnings', { headers: { token } })
      .then(res => res.json())
      .then(data => setWarnings(data.warnings || 0));
  }, [token]);
  return <div>Avertissements : {warnings}</div>;
};
export default Avertissements;"

# --- Écriture de tous les fichiers
for file in "${!components[@]}"; do
  echo "✅ Création : src/pages/sections/$file"
  echo "${components[$file]}" > "src/pages/sections/$file"
done

echo "✅ Terminé. Tu peux maintenant utiliser Gallery.js dans App.js 🚀"
