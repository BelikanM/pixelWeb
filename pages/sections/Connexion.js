import React, { useState } from 'react';
const Connexion = ({ setToken, navigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = async () => {
    const res = await fetch('http://localhost:5050/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      navigate('dashboard');
    }
  };
  return (
    <div className='space-y-4'>
      <h2 className='text-xl font-bold'>Connexion</h2>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder='Email' className='border p-2 w-full' />
      <input type='password' value={password} onChange={e => setPassword(e.target.value)} placeholder='Mot de passe' className='border p-2 w-full' />
      <button onClick={login} className='bg-blue-600 text-white px-4 py-2 rounded'>Se connecter</button>
    </div>
  );
};
export default Connexion;
