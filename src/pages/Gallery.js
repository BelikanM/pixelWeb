import React, { useState } from "react";
import {
  UserCheck,
  FilePlus,
  Eye,
  BarChart2,
  List,
  Wallet,
  AlertOctagon
} from "lucide-react";

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
      <nav className="flex overflow-x-auto justify-around p-3 bg-white shadow gap-2">
        <button
          onClick={() => navigate("connexion")}
          className="p-3 bg-white rounded-full hover:bg-blue-100 shadow transition"
          title="Connexion"
        >
          <UserCheck size={24} color="#3B82F6" />
        </button>
        <button
          onClick={() => navigate("formulaire")}
          className="p-3 bg-white rounded-full hover:bg-green-100 shadow transition"
          title="Créer Pub"
        >
          <FilePlus size={24} color="#10B981" />
        </button>
        <button
          onClick={() => navigate("affichage")}
          className="p-3 bg-white rounded-full hover:bg-purple-100 shadow transition"
          title="Voir Pub"
        >
          <Eye size={24} color="#8B5CF6" />
        </button>
        <button
          onClick={() => navigate("dashboard")}
          className="p-3 bg-white rounded-full hover:bg-yellow-100 shadow transition"
          title="Dashboard"
        >
          <BarChart2 size={24} color="#F59E0B" />
        </button>
        <button
          onClick={() => navigate("feed")}
          className="p-3 bg-white rounded-full hover:bg-indigo-100 shadow transition"
          title="Feed"
        >
          <List size={24} color="#6366F1" />
        </button>
        <button
          onClick={() => navigate("utilisateur")}
          className="p-3 bg-white rounded-full hover:bg-emerald-100 shadow transition"
          title="Mes Gains"
        >
          <Wallet size={24} color="#059669" />
        </button>
        <button
          onClick={() => navigate("avertissements")}
          className="p-3 bg-white rounded-full hover:bg-rose-100 shadow transition"
          title="Avertissements"
        >
          <AlertOctagon size={24} color="#EF4444" />
        </button>
      </nav>

      <main className="p-4">{sections[section]}</main>
    </div>
  );
};

export default Gallery;
