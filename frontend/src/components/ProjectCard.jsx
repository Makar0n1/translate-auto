import axios from 'axios';

function ProjectCard({ project }) {
  const statusColors = {
    idle: 'bg-gray-500',
    running: 'bg-blue-500',
    completed: 'bg-green-500',
    error: 'bg-red-500',
    canceled: 'bg-gray-500'
  };

  const handleAction = async (action) => {
    try {
      await axios.post(`http://localhost:3000/api/projects/${project._id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
    } catch (error) {
      console.error(`Failed to ${action} project`);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`http://localhost:3000/api/projects/${project._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
    } catch (error) {
      console.error('Failed to delete project');
    }
  };

  const handleDownload = () => {
    window.location.href = `http://localhost:3000/api/projects/${project._id}/download`;
  };

  return (
    <div className="bg-white p-4 rounded shadow-md">
      <h3 className="text-xl">{project.name}</h3>
      <div className="flex items-center my-2">
        <div className={`w-4 h-4 rounded-full ${statusColors[project.status]} mr-2`}></div>
        <p>{project.status.charAt(0).toUpperCase() + project.status.slice(1)}</p>
      </div>
      <p>Progress: {project.translatedRows}/{project.totalRows} rows</p>
      <p>Languages: {project.languages.join(', ')}</p>
      <div className="mt-4 flex gap-2">
        {project.status === 'idle' && (
          <button
            onClick={() => handleAction('start')}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Start
          </button>
        )}
        {project.status === 'running' && (
          <button
            onClick={() => handleAction('cancel')}
            className="bg-yellow-500 text-white px-4 py-2 rounded"
          >
            Cancel
          </button>
        )}
        {project.status === 'canceled' && (
          <button
            onClick={() => handleAction('resume')}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Resume
          </button>
        )}
        {project.status === 'error' && (
          <button
            onClick={() => handleAction('start')}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Retry
          </button>
        )}
        {project.status === 'completed' && (
          <button
            onClick={handleDownload}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Download XLSX
          </button>
        )}
        <button
          onClick={handleDelete}
          className={`bg-red-500 text-white px-4 py-2 rounded ${project.status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={project.status === 'running'}
        >
          Delete
        </button>
      </div>
      <div className="mt-2">
        <div className="bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${project.progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default ProjectCard;