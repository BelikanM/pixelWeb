import React, { useEffect, useState } from 'react';
const DashboardPub = ({ token }) => {
  const [data, setData] = useState({ ads: [], interactions: [] });
  useEffect(() => {
    fetch('http://localhost:5050/api/dashboard', { headers: { token } })
      .then(res => res.json()).then(setData);
  }, [token]);
  return (
    <div>
      <h2 className='text-xl font-bold mb-4'>Tableau de bord</h2>
      <h3>Mes publicités</h3>
      <ul className='space-y-2'>
        {data.ads.map(ad => (
          <li key={ad._id} className='border p-2'>🎥 {ad.url} | Reste : {ad.remainingBudget} CFA</li>
        ))}
      </ul>
    </div>
  );
};
export default DashboardPub;
