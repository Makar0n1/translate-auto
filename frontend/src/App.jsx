import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import ProjectCard from './components/ProjectCard';
import ProjectModal from './components/ProjectModal';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const WS_URL = import.meta.env.VITE_NODE_ENV === 'production' ? 'wss://api.repsdeltsgear.store' : 'ws://localhost:3000';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      try {
        await axios.get(`${BACKEND_URL}/api/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('token');
        console.error('Failed to check token:', error);
        setIsAuthenticated(false);
      }
    };
    checkToken();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
      const ws = new WebSocket(WS_URL);
      ws.onmessage = (event) => {
        const { data } = event;
        try {
          const { type, project, id } = JSON.parse(data);
          if (type === 'PROJECT_CREATED') {
            setProjects((prev) => [...prev, project]);
          } else if (type === 'PROJECT_UPDATED') {
            setProjects((prev) => prev.map(p => p._id === project._id ? project : p));
          } else if (type === 'PROJECT_DELETED') {
            setProjects((prev) => prev.filter(p => p._id !== id));
          }
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };
      ws.onerror = (error) => console.error('WebSocket error:', error);
      return () => ws.close();
    }
  }, [isAuthenticated]);

  const fetchProjects = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${BACKEND_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error.message);
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  if (isAuthenticated === null) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" /> : <LoginForm onLogin={handleLogin} />
        } />
        <Route path="/dashboard" element={
          !isAuthenticated ? <Navigate to="/login" /> : (
            <div className="flex flex-col min-h-screen bg-gray-50">
              <header className="bg-green-600 text-white p-4 shadow-md">
                <div className="container mx-auto flex justify-between items-center">
                  <h1 className="text-2xl font-semibold">RepsDeltsGear Dashboard</h1>
                  <button onClick={handleLogout} className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-md transition-colors duration-200">Logout</button>
                </div>
              </header>
              <main className="container mx-auto px-4 py-4 flex-grow flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-green-500 text-white px-6 py-2 rounded-full hover:bg-green-600 transition-colors duration-200"
                  >
                    + Add Project
                  </button>
                </div>
                {projects.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center text-gray-700 text-lg">
                    Your translation projects will appear here
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project, index) => (
                      <ProjectCard key={project._id} project={project} index={index} />
                    ))}
                  </div>
                )}
              </main>
              <footer className="bg-green-800 text-white py-6">
                <div className="container mx-auto text-center">
                  <p className="text-sm">RepsDeltsGear Dashboard © 2025</p>
                </div>
              </footer>
              {isModalOpen && (
                <ProjectModal
                  onClose={() => setIsModalOpen(false)}
                  onAdd={fetchProjects}
                />
              )}
            </div>
          )
        } />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;