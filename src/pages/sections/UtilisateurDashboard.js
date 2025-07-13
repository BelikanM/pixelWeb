import React, { useEffect, useState } from 'react';
const UtilisateurDashboard = ({ token }) => {
  const [earnings, setEarnings] = useState(0);
  useEffect(() => {
    fetch('http://localhost:5050/api/dashboard', { headers: { token } })
      .then(res => res.json())
      .then(data => setEarnings(data.earnings || 0));
  }, [token]);
  return <div>Gains cumulés : {earnings} FCFA</div>;
};
export default UtilisateurDashboard;
