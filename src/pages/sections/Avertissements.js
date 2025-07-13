import React, { useEffect, useState } from 'react';
const Avertissements = ({ token }) => {
  const [warnings, setWarnings] = useState(0);
  useEffect(() => {
    fetch('http://localhost:5050/api/warnings', { headers: { token } })
      .then(res => res.json())
      .then(data => setWarnings(data.warnings || 0));
  }, [token]);
  return <div>Avertissements : {warnings}</div>;
};
export default Avertissements;
