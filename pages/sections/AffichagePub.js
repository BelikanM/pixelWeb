import React, { useEffect, useState } from 'react';
const AffichagePub = ({ token }) => {
  const [pub, setPub] = useState(null);
  useEffect(() => {
    fetch('http://localhost:5050/api/feed')
      .then(res => res.json())
      .then(data => setPub(data[0]));
  }, []);
  const interagir = async () => {
    await fetch('http://localhost:5050/api/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, adId: pub._id, type: 'view' })
    });
    alert('Interaction enregistrée !');
  };
  if (!pub) return <p>Aucune publicité disponible</p>;
  return (
    <div className='space-y-4'>
      <h2 className='text-xl font-bold'>Publicité</h2>
      <iframe src={pub.url} title='video' className='w-full h-56 border' />
      <progress value={pub.amountCFA - pub.remainingBudget} max={pub.amountCFA} className='w-full'></progress>
      <button onClick={interagir} className='bg-purple-600 text-white px-4 py-2 rounded'>J&apos;ai regardé</button>
    </div>
  );
};
export default AffichagePub;
