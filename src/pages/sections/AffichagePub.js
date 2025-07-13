import React, { useEffect, useState } from 'react';
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
    alert("Interaction enregistrée !");
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
export default AffichagePub;
