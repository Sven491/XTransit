import React, { useState, useEffect } from 'react'
import Login from './components/Login'
import StopsManager from './components/StopsManager'
import LinkStop from './components/LinkStop'
import BusLinesManager from './components/BusLinesManager'
import FleetManager from './components/FleetManager'
import ScheduleMaker from './components/ScheduleMaker'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'))

  useEffect(() => {
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
  }, [token])

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user))
    else localStorage.removeItem('user')
  }, [user])

  if (!token) return <Login onLogin={(t,u) => { setToken(t); setUser(u); }} />

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Transit operations</p>
          <h1>Admin control center</h1>
        </div>
        <div className="userbox">
          <strong>{user?.userCode ? `User ${user.userCode}` : 'User'}</strong>
          <button onClick={() => { setToken(null); setUser(null); }}>Logout</button>
        </div>
      </header>
      <div className="hero">
        <div>
          <h2>Fleet, lijnen en stops</h2>
          <p>Beheer haltes, buslijnen, gekoppelde stops en voertuigen vanuit één overzicht.</p>
        </div>
      </div>
      <main>
        <StopsManager token={token} user={user} />
        <BusLinesManager token={token} user={user} />
        <FleetManager token={token} user={user} />
        <LinkStop token={token} user={user} />
        <ScheduleMaker token={token} user={user} />
      </main>
    </div>
  )
}
