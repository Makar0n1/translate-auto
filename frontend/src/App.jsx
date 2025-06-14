import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipLoader } from 'react-spinners';
import LoginForm from './components/LoginForm';
import ProjectCard from './components/ProjectCard';
import ProjectModal from './components/ProjectModal';
import axios from 'axios';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3200';
const WS_URL = import.meta.env.VITE_NODE_ENV === 'production' ? 'wss://api.repsdeltsgear.store' : 'ws://localhost:3200';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [standardProjects, setStandardProjects] = useState([]);
  const [csvProjects, setCsvProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('standard');
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState({});
  const [isAnimating, setIsAnimating] = useState(true);
  const wsRef = useRef(null);
  const navigate = useRef(null);

  const connectWebSocket = () => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => console.log('WebSocket connected');

    ws.onmessage = (event) => {
      try {
        const { type, project, id } = JSON.parse(event.data);
        console.log('WebSocket message received:', { type, project, id });
        if (type === 'PROJECT_CREATED') {
          console.log(`Project created: ${project._id}, type: ${project.type}`);
          if (project.type === 'csv') {
            setCsvProjects((prev) => {
              const exists = prev.find(p => p._id === project._id);
              if (!exists) return [...prev, project];
              return prev;
            });
          } else {
            setStandardProjects((prev) => {
              const exists = prev.find(p => p._id === project._id);
              if (!exists) return [...prev, project];
              return prev;
            });
          }
        } else if (type === 'PROJECT_UPDATED') {
          console.log(`Project updated: ${project._id}, status: ${project.status}`);
          if (project.type === 'csv') {
            setCsvProjects((prev) => prev.map(p => p._id === project._id ? project : p));
          } else {
            setStandardProjects((prev) => prev.map(p => p._id === project._id ? project : p));
          }
          setIsActionLoading((prev) => ({ ...prev, [project._id]: false }));
          console.log(`Action loading reset for project ${project._id} via WebSocket`);
        } else if (type === 'PROJECT_DELETED') {
          console.log(`Project deleted: ${id}`);
          setStandardProjects((prev) => prev.filter(p => p._id !== id));
          setCsvProjects((prev) => prev.filter(p => p._id !== id));
          setIsActionLoading((prev) => ({ ...prev, [id]: false }));
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    ws.onerror = (error) => console.error('WebSocket error:', error);
    ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting in 5s...');
      setTimeout(connectWebSocket, 5000);
    };
  };

  const checkToken = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsAuthenticated(false);
      setIsLoading(false);
      navigate.current?.('/login');
      return;
    }
    try {
      await axios.get(`${BACKEND_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to check token:', error.message);
      localStorage.removeItem('token');
      setIsAuthenticated(false);
      navigate.current?.('/login');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkToken();
    const tokenCheckInterval = setInterval(checkToken, 5 * 60 * 1000);
    return () => clearInterval(tokenCheckInterval);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
      connectWebSocket();
      return () => {
        if (wsRef.current) wsRef.current.close();
        setIsLoading(false);
      };
    }
  }, [isAuthenticated]);

  useEffect(() => {
    document.body.style.overflowY = isAnimating ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflowY = 'auto';
    };
  }, [isAnimating]);

  const fetchProjects = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const projects = response.data;
      const uniqueStandard = projects.filter(p => p.type === 'standard').reduce((acc, curr) => {
        if (!acc.find(p => p._id === curr._id)) acc.push(curr);
        return acc;
      }, []);
      const uniqueCsv = projects.filter(p => p.type === 'csv').reduce((acc, curr) => {
        if (!acc.find(p => p._id === curr._id)) acc.push(curr);
        return acc;
      }, []);
      console.log('Fetched unique projects:', { standard: uniqueStandard.length, csv: uniqueCsv.length });
      setStandardProjects(uniqueStandard);
      setCsvProjects(uniqueCsv);
    } catch (error) {
      console.error('Failed to fetch projects:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => setIsAuthenticated(true);
  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    navigate.current?.('/login');
  };

  const handleAnimationComplete = () => {
    setIsAnimating(false);
  };

  if (isAuthenticated === null || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-futuristic">
        <ClipLoader color="#2A9D8F" size={50} cssOverride={{ borderWidth: '4px' }} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-futuristic">
        <NavigateRef navigateRef={navigate} />
        {isAuthenticated && (
          <motion.header
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            onAnimationComplete={handleAnimationComplete}
            className="bg-holo text-white p-4 shadow-neon"
          >
            <div className="container mx-auto flex justify-between items-center">
              <motion.h1
                className="text-3xl font-extrabold text-emerald cursor-pointer"
                whileHover={{ scale: 1.05 }}
                onClick={() => window.location.href = '/'}
              >
                AI-Translation
              </motion.h1>
              <nav className="flex gap-4">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
                  data-tooltip-id="tooltip" data-tooltip-content="View Standard Projects"
                >
                  Standard
                </NavLink>
                <NavLink
                  to="/csv-translation"
                  className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
                  data-tooltip-id="tooltip" data-tooltip-content="View CSV Projects"
                >
                  CSV
                </NavLink>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="nav-tab bg-emerald-500 hover:bg-emerald-600"
                  data-tooltip-id="tooltip" data-tooltip-content="Sign out"
                >
                  Logout
                </motion.button>
              </nav>
            </div>
          </motion.header>
        )}
        <Routes>
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <LoginForm onLogin={handleLogin} />
          } />
          <Route path="/dashboard" element={
            !isAuthenticated ? <Navigate to="/login" /> : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7 }}
                className="container mx-auto px-4 py-8 flex-grow"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-bold text-emerald">Standard Projects</h2>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setModalType('standard'); setIsModalOpen(true); }}
                    className="bg-emerald-500 text-white px-6 py-2 rounded-lg hover:bg-emerald-600 shadow-neon transition-all duration-300"
                    data-tooltip-id="tooltip" data-tooltip-content="Create new standard project"
                  >
                    + New Project
                  </motion.button>
                </div>
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <ClipLoader color="#2A9D8F" size={50} cssOverride={{ borderWidth: '4px' }} />
                  </div>
                ) : standardProjects.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-center text-silver text-lg">
                    No standard projects yet. Create one to get started!
                  </div>
                ) : (
                  <motion.div
                    className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 0 },
                      visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
                    }}
                  >
                    {standardProjects.map((project, index) => (
                      <ProjectCard
                        key={`standard-${project._id}`}
                        project={project}
                        index={index}
                        isActionLoading={isActionLoading[project._id] || false}
                      />
                    ))}
                  </motion.div>
                )}
                {isModalOpen && (
                  <ProjectModal
                    type={modalType}
                    onClose={() => setIsModalOpen(false)}
                    onAdd={fetchProjects}
                  />
                )}
              </motion.div>
            )
          } />
          <Route path="/csv-translation" element={
            !isAuthenticated ? <Navigate to="/login" /> : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7 }}
                className="container mx-auto px-4 py-8 flex-grow"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-bold text-emerald">CSV Translation Projects</h2>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setModalType('csv'); setIsModalOpen(true); }}
                    className="bg-emerald-500 text-white px-6 py-2 rounded-lg hover:bg-emerald-600 shadow-neon transition-all duration-300"
                    data-tooltip-id="tooltip" data-tooltip-content="Create new CSV project"
                  >
                    + New CSV Project
                  </motion.button>
                </div>
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <ClipLoader color="#2A9D8F" size={50} cssOverride={{ borderWidth: '4px' }} />
                  </div>
                ) : csvProjects.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-center text-silver text-lg">
                    No CSV projects yet. Create one to get started!
                  </div>
                ) : (
                  <motion.div
                    className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 0 },
                      visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
                    }}
                  >
                    {csvProjects.map((project, index) => (
                      <ProjectCard
                        key={`csv-${project._id}`}
                        project={project}
                        index={index}
                        isActionLoading={isActionLoading[project._id] || false}
                      />
                    ))}
                  </motion.div>
                )}
                {isModalOpen && (
                  <ProjectModal
                    type={modalType}
                    onClose={() => setIsModalOpen(false)}
                    onAdd={fetchProjects}
                  />
                )}
              </motion.div>
            )
          } />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
        {isAuthenticated && (
          <motion.footer
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            onAnimationComplete={handleAnimationComplete}
            className="bg-holo text-white py-6 shadow-neon"
          >
            <div className="container mx-auto text-center">
              <p className="text-sm text-silver">AI-Translation © 2025</p>
            </div>
          </motion.footer>
        )}
      </div>
    </BrowserRouter>
  );
}

function NavigateRef({ navigateRef }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate, navigateRef]);
  return null;
}

export default App;