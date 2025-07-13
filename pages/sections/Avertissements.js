import React, { useEffect, useState } from 'react';
const Avertissements = ({ token }) => {
  const [warnings, setWarnings] = useState(0);
  useEffect(() => {
    fetch('http://localhost:5050/api/warnings', { headers: { token } })
      .then(res => res.json())
      .then(data => setWarnings(data.warnings));
  }, [token]);
  return (
    <div className='space-y-4'>
      <h2 className='text-xl font-bold text-red-600'>Avertissements</h2>
      <p className='text-lg'>Nombre de sanctions : <strong>{warnings}</strong></p>
      <p className='text-sm text-gray-600'>En cas de triche, le solde est remboursé à l&apos;annonceur et le compte suspendu.</p>
    </div>
  );
};
export default Avertissements;
