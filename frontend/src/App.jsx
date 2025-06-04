import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import ProjectCard from './components/ProjectCard';
import ProjectModal from './components/ProjectModal';
import axios from 'axios';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
      const ws = new WebSocket('ws://localhost:3000');
      ws.onmessage = (event) => {
        const { type, project, id } = JSON.parse(event.data);
        if (type === 'PROJECT_CREATED') {
          setProjects((prev) => [...prev, project]);
        } else if (type === 'PROJECT_UPDATED') {
          setProjects((prev) => prev.map(p => p._id === project._id ? project : p));
        } else if (type === 'PROJECT_DELETED') {
          setProjects((prev) => prev.filter(p => p._id !== id));
        }
      };
      return () => ws.close();
    }
  }, [isAuthenticated]);

  const fetchProjects = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/projects', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects');
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" /> : <LoginForm onLogin={handleLogin} />
        } />
        <Route path="/" element={
          !isAuthenticated ? <Navigate to="/login" /> : (
            <div className="min-h-screen bg-gray-100">
              <header className="bg-blue-600 text-white p-4">
                <div className="container mx-auto flex justify-between">
                  <h1 className="text-2xl">Translation Dashboard</h1>
                  <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded">Logout</button>
                </div>
              </header>
              <main className="container mx-auto p-4">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-green-500 text-white px-4 py-2 rounded mb-4"
                >
                  + Add Project
                </button>
                <div className="grid gap-4">
                  {projects.map(project => (
                    <ProjectCard key={project._id} project={project} />
                  ))}
                </div>
              </main>
              <footer className="bg-gray-800 text-white p-4 text-center">
                <p>Translation Dashboard © 2025</p>
              </footer>
              {isModalOpen && (
                <ProjectModal
                  onClose={() => setIsModalOpen(false)}
                  onAdd={() => fetchProjects()}
                />
              )}
            </div>
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;