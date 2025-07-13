import React, { useState } from 'react';
const FormulairePub = ({ token }) => {
  const [url, setUrl] = useState('');
  const [amountCFA, setAmountCFA] = useState('');
  const envoyer = async () => {
    await fetch('http://localhost:5050/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, url, amountCFA: parseInt(amountCFA) })
    });
    alert('Publicité créée !');
  };
  return (
    <div className='space-y-4'>
      <h2 className='text-xl font-bold'>Créer une publicité</h2>
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder='URL YouTube' className='border p-2 w-full' />
      <input type='number' value={amountCFA} onChange={e => setAmountCFA(e.target.value)} placeholder='Montant CFA' className='border p-2 w-full' />
      <button onClick={envoyer} className='bg-green-600 text-white px-4 py-2 rounded'>Envoyer</button>
    </div>
  );
};
export default FormulairePub;
