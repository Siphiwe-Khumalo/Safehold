import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import EmergencyScreen from './screens/EmergencyScreen.jsx'
import ContactsScreen from './screens/ContactsScreen.jsx'
import TrackScreen from './screens/TrackScreen.jsx'
import JourneyScreen from './screens/JourneyScreen.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EmergencyScreen />} />
        <Route path="/map" element={<JourneyScreen />} />
        <Route path="/contacts" element={<ContactsScreen />} />
        <Route path="/track/:token" element={<TrackScreen />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
