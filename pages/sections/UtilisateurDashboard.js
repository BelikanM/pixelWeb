import React, { useEffect, useState } from 'react';
const UtilisateurDashboard = ({ token }) => {
  const [earnings, setEarnings] = useState(0);
  useEffect(() => {
    fetch('http://localhost:5050/api/dashboard', { headers: { token } })
      .then(res => res.json())
      .then(data => setEarnings(data.earnings));
  }, [token]);
  return (
    <div className='text-center space-y-4'>
      <h2 className='text-xl font-bold'>Mes gains</h2>
      <p className='text-2xl text-green-600 font-bold'>{earnings} FCFA</p>
    </div>
  );
};
export default UtilisateurDashboard;
