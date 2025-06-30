import React from 'react';
import { NavLink } from 'react-router-dom';
import { AiFillHome, AiFillPicture, AiOutlineUser } from 'react-icons/ai';

const navStyle = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: '60px',
  backgroundColor: '#222',
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  color: 'white',
};

const activeStyle = {
  color: '#61dafb',
};

export default function BottomNav() {
  return (
    <nav style={navStyle}>
      <NavLink to="/" style={({ isActive }) => (isActive ? activeStyle : { color: 'white' })} end>
        <AiFillHome size={28} />
      </NavLink>
      <NavLink to="/gallery" style={({ isActive }) => (isActive ? activeStyle : { color: 'white' })}>
        <AiFillPicture size={28} />
      </NavLink>
      <NavLink to="/profile" style={({ isActive }) => (isActive ? activeStyle : { color: 'white' })}>
        <AiOutlineUser size={28} />
      </NavLink>
    </nav>
  );
}
