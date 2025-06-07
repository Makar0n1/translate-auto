import { useState } from 'react';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

function ProjectCard({ project, index }) {
  const [isLoading, setIsLoading] = useState(false);

  const statusColors = {
    idle: 'bg-gray-400',
    running: 'bg-green-500',
    completed: 'bg-blue-500',
    error: 'bg-red-500',
    canceled: 'bg-gray-400'
  };

  const handleAction = async (action) => {
    setIsLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/api/projects/${project._id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
    } catch (error) {
      console.error(`Failed to ${action} project:`, error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await axios.delete(`${BACKEND_URL}/api/projects/${project._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
    } catch (error) {
      console.error('Failed to delete project:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    window.location.href = `${BACKEND_URL}/api/projects/${project._id}/download`;
  };

  return (
    <div className={`card bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 animate__animated animate__fadeIn animate__delay-${index % 3}s`}>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">{project.name}</h3>
      <div className="flex items-center mb-3">
        <div className={`w-4 h-4 rounded-full ${statusColors[project.status]} mr-2`}></div>
        <p className="text-gray-600">{project.status.charAt(0).toUpperCase() + project.status.slice(1)}</p>
      </div>
      {project.errorMessage && <p className="text-red-500 mb-3">{project.errorMessage}</p>}
      <p className="text-gray-600 mb-1">Progress: {project.translatedRows}/{project.totalRows} rows</p>
      <p className="text-gray-600 mb-4">Languages: {project.languages.join(', ')}</p>
      <div className="mt-4 flex gap-2 flex-wrap">
        {project.status === 'idle' && (
          <button
            onClick={() => handleAction('start')}
            className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? 'Starting...' : 'Start'}
          </button>
        )}
        {project.status === 'running' && (
          <button
            onClick={() => handleAction('cancel')}
            className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? 'Canceling...' : 'Cancel'}
          </button>
        )}
        {(project.status === 'canceled' || project.status === 'error') && (
          <button
            onClick={() => handleAction('resume')}
            className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? 'Resuming...' : 'Resume'}
          </button>
        )}
        {(project.status === 'completed' || (project.translatedRows > 0 && (project.status === 'canceled' || project.status === 'error'))) && (
          <button
            onClick={handleDownload}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            Download XLSX
          </button>
        )}
        <button
          onClick={handleDelete}
          className={`bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors duration-200 ${project.status === 'running' || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={project.status === 'running' || isLoading}
        >
          {isLoading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
      <div className="mt-4">
        <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${project.progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default ProjectCard;