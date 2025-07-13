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
