import React, { useEffect, useState } from 'react';
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
export default DashboardPub;
