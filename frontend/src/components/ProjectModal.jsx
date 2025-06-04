import { useState, useRef } from 'react';
import axios from 'axios';

function ProjectModal({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState({ imdbid: '', title: '', description: '' });
  const [languages, setLanguages] = useState([]);
  const [newLanguage, setNewLanguage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const modalRef = useRef();

  const handleClickOutside = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && !selectedFile.name.endsWith('.xlsx')) {
      setError('Please upload an XLSX file');
      setFile(null);
    } else {
      setError('');
      setFile(selectedFile);
    }
  };

  const handleAddLanguage = () => {
    const trimmedLang = newLanguage.trim();
    if (trimmedLang && !languages.includes(trimmedLang)) {
      setLanguages([...languages, trimmedLang]);
      setNewLanguage('');
    }
  };

  const resetForm = () => {
    setName('');
    setFile(null);
    setColumns({ imdbid: '', title: '', description: '' });
    setLanguages([]);
    setNewLanguage('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !name || !columns.imdbid || !columns.title || !columns.description || languages.length === 0) {
      setError('All fields are required, including at least one language');
      return;
    }

    setIsLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    formData.append('columns', JSON.stringify(columns));
    formData.append('languages', JSON.stringify(languages));

    try {
      const response = await axios.post('http://localhost:3000/api/projects', formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      console.log('Project created:', response.data);
      resetForm();
      onAdd();
      onClose();
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create project';
      console.error('Project creation error:', errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      onClick={handleClickOutside}
    >
      <div ref={modalRef} className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Add Project</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isLoading}
          />
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="w-full p-3 mb-4 border border-gray-300 rounded-md"
            disabled={isLoading}
          />
          <input
            type="text"
            placeholder="IMDb ID Column"
            value={columns.imdbid}
            onChange={(e) => setColumns({ ...columns, imdbid: e.target.value })}
            className="w-full p-3 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isLoading}
          />
          <input
            type="text"
            placeholder="Title Column"
            value={columns.title}
            onChange={(e) => setColumns({ ...columns, title: e.target.value })}
            className="w-full p-3 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isLoading}
          />
          <input
            type="text"
            placeholder="Description Column"
            value={columns.description}
            onChange={(e) => setColumns({ ...columns, description: e.target.value })}
            className="w-full p-3 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isLoading}
          />
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter language codes (e.g., es, pt, fr)"
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={handleAddLanguage}
                className="bg-indigo-500 text-white px-4 py-2 rounded-md hover:bg-indigo-600 transition-colors duration-200"
                disabled={isLoading}
              >
                +
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {languages.map(lang => (
                <span key={lang} className="inline-block bg-indigo-100 text-indigo-800 rounded px-2 py-1">
                  {lang}
                </span>
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-500 text-white p-3 rounded-md hover:bg-indigo-600 transition-colors duration-200 disabled:bg-indigo-300 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Add Project'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProjectModal;