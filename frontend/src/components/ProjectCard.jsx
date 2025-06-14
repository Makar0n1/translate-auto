import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClipLoader } from 'react-spinners';
import { Tooltip } from 'react-tooltip';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3200';

function ProjectCard({ project, index }) {
  const [isLoading, setIsLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const statusColors = {
    idle: 'bg-gray-500',
    running: 'bg-emerald-500',
    completed: 'bg-blue-500',
    error: 'bg-red-500',
    canceled: 'bg-gray-500'
  };

  const handleAction = async (action) => {
    console.log(`Action triggered: ${action} for project ${project._id}, current status: ${project.status}`);
    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      await axios.post(`${BACKEND_URL}/api/projects/${project._id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        signal: controller.signal
      });
      console.log(`Action ${action} completed successfully`);
      clearTimeout(timeoutId);
    } catch (error) {
      console.error(`Failed to ${action} project:`, error.message);
    } finally {
      setIsLoading(false);
      console.log(`Action ${action} finished, isLoading reset to false`);
    }
  };

  const handleDelete = async () => {
    console.log(`Delete triggered for project ${project._id}`);
    setIsLoading(true);
    try {
      await axios.delete(`${BACKEND_URL}/api/projects/${project._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log(`Delete completed successfully`);
    } catch (error) {
      console.error('Failed to delete project:', error.message);
    } finally {
      setIsLoading(false);
      console.log('Delete finished, isLoading reset to false');
    }
  };

  const handleDownload = () => {
    console.log(`Download triggered for project ${project._id}`);
    window.location.href = `${BACKEND_URL}/api/projects/${project._id}/download`;
  };

  // Сброс isLoading при обновлении статуса
  useEffect(() => {
    if (project.status === 'running' || project.status === 'canceled') {
      setIsLoading(false);
      console.log(`Status updated to ${project.status}, isLoading reset to false`);
    }
  }, [project.status]);

  console.log(`Rendering ProjectCard for ${project._id}, status: ${project.status}, isLoading: ${isLoading}`);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className="bg-dark-blue p-6 rounded-xl border border-silver shadow-lg hover:shadow-emerald transition-all duration-300"
        whileHover={{ scale: 1.02 }}
      >
        <h3 className="text-xl font-semibold text-white mb-2 truncate">{project.name}</h3>
        <div className="flex items-center mb-3">
          <div className={`w-3 h-3 rounded-full ${statusColors[project.status]} mr-2 animate-pulse`} />
          <p className="text-silver text-sm">{project.status.charAt(0).toUpperCase() + project.status.slice(1)}</p>
        </div>
        {project.errorMessage && (
          <p className="text-red-400 mb-3 text-sm truncate">{project.errorMessage}</p>
        )}
        <p className="text-silver text-sm mb-1">
          Type: {project.importToSite ? `Translate + Import (${project.domainId?.url || 'Unknown'})` : 'Translate Only'}
        </p>
        <p className="text-silver text-sm mb-1">Translation Progress: {project.translatedRows}/{project.totalRows} rows</p>
        {project.importToSite && (
          <p className="text-silver text-sm mb-1">Import Progress: {project.importedRows}/{project.totalRows} rows</p>
        )}
        <p className="text-silver text-sm mb-4">Languages: {project.languages.join(', ')}</p>
        <div className="mt-4 flex gap-2 flex-wrap">
          {project.status === 'idle' && (
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 10px rgba(42, 157, 143, 0.5)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAction('start')}
              className={`bg-emerald-500 text-white px-4 py-2 rounded-lg transition-all duration-300 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isLoading}
              data-tooltip-id={`tooltip-${project._id}`} data-tooltip-content="Start translation"
            >
              {isLoading ? <ClipLoader color="#FFF" size={16} /> : 'Start'}
            </motion.button>
          )}
          {project.status === 'running' && (
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 10px rgba(42, 157, 143, 0.5)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAction('cancel')}
              className={`bg-yellow-500 text-white px-4 py-2 rounded-lg transition-all duration-300 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isLoading}
              data-tooltip-id={`tooltip-${project._id}`} data-tooltip-content="Cancel translation"
            >
              {isLoading ? <ClipLoader color="#FFF" size={16} /> : 'Cancel'}
            </motion.button>
          )}
          {(project.status === 'canceled' || project.status === 'error') && (
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 10px rgba(42, 157, 143, 0.5)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAction('resume')}
              className={`bg-emerald-500 text-white px-4 py-2 rounded-lg transition-all duration-300 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isLoading}
              data-tooltip-id={`tooltip-${project._id}`} data-tooltip-content="Resume translation"
            >
              {isLoading ? <ClipLoader color="#FFF" size={16} /> : 'Resume'}
            </motion.button>
          )}
          {(project.status === 'completed' || (project.translatedRows > 0 && (project.status === 'canceled' || project.status === 'error'))) && (
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 10px rgba(42, 157, 143, 0.5)' }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDownload}
              className={`bg-blue-500 text-white px-4 py-2 rounded-lg transition-all duration-300 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isLoading}
              data-tooltip-id={`tooltip-${project._id}`} data-tooltip-content="Download translated XLSX"
            >
              Download
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 10px rgba(42, 157, 143, 0.5)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDelete}
            className={`bg-red-500 text-white px-4 py-2 rounded-lg transition-all duration-300 ${project.status === 'running' || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={project.status === 'running' || isLoading}
            data-tooltip-id={`tooltip-${project._id}`} data-tooltip-content="Delete project"
          >
            Delete
          </motion.button>
          {project.failedImports?.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 10px rgba(255, 46, 46, 0.5)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowErrors(!showErrors)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg transition-all duration-300"
              data-tooltip-id={`tooltip-${project._id}`} data-tooltip-content="View import errors"
            >
              Errors ({project.failedImports.length})
            </motion.button>
          )}
        </div>
        <div className="mt-4">
          <div className="bg-gray-700 rounded-full h-2 overflow-hidden mb-2">
            <motion.div
              className="bg-emerald-500 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${project.progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          {project.importToSite && (
            <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
              <motion.div
                className="bg-blue-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${project.importProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          )}
        </div>
        {showErrors && project.failedImports?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-gray-800 p-4 rounded-lg"
          >
            <h4 className="text-white text-sm font-semibold mb-2">Failed Imports</h4>
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-silver text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-1">URL</th>
                    <th className="text-left py-1">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {project.failedImports.map((fail, idx) => (
                    <tr key={idx}>
                      <td className="py-1 truncate max-w-xs">{fail.url}</td>
                      <td className="py-1 truncate max-w-xs">{fail.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </motion.div>
      <Tooltip id={`tooltip-${project._id}`} className="tooltip-custom" />
    </>
  );
}

export default ProjectCard;