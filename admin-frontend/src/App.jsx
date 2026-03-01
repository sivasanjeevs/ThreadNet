import { useState } from 'react';
import AdminDashboard from './AdminDashboard';
import './index.css';

function App() {
  const [page, setPage] = useState('home');

  if (page === 'home') {
    return (
      <div className="admin-home">
        <button className="admin-btn" onClick={() => setPage('dashboard')}>
          Admin
        </button>
      </div>
    );
  }

  return <AdminDashboard onBack={() => setPage('home')} />;
}

export default App;
