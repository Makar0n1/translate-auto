import { useState, useRef } from 'react';
import axios from 'axios';

function ProjectModal({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState({ imdbid: '', title: '', description: '' });
  const [languages, setLanguages] = useState(['es', 'pt', 'fr']);
  const [newLanguage, setNewLanguage] = useState('');
  const [error, setError] = useState('');
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
    if (newLanguage && !languages.includes(newLanguage)) {
      setLanguages([...languages, newLanguage]);
      setNewLanguage('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !name || !columns.imdbid || !columns.title || !columns.description) {
      setError('All fields are required');
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    formData.append('columns', JSON.stringify(columns));
    formData.append('languages', JSON.stringify(languages));

    try {
      await axios.post('http://localhost:3000/api/projects', formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      onAdd();
      onClose();
    } catch (err) {
      setError('Failed to create project');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      onClick={handleClickOutside}
    >
      <div ref={modalRef} className="bg-white p-8 rounded shadow-md w-1/2">
        <h2 className="text-2xl mb-4">Add Project</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 mb-4 border rounded"
          />
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="w-full p-2 mb-4 border rounded"
          />
          <input
            type="text"
            placeholder="IMDb ID Column"
            value={columns.imdbid}
            onChange={(e) => setColumns({ ...columns, imdbid: e.target.value })}
            className="w-full p-2 mb-4 border rounded"
          />
          <input
            type="text"
            placeholder="Title Column"
            value={columns.title}
            onChange={(e) => setColumns({ ...columns, title: e.target.value })}
            className="w-full p-2 mb-4 border rounded"
          />
          <input
            type="text"
            placeholder="Description Column"
            value={columns.description}
            onChange={(e) => setColumns({ ...columns, description: e.target.value })}
            className="w-full p-2 mb-4 border rounded"
          />
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add Language (e.g., de)"
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <button
                onClick={handleAddLanguage}
                className="bg-blue-500 text-white px-4 py-2 rounded"
              >
                +
              </button>
            </div>
            <div className="mt-2">
              {languages.map(lang => (
                <span key={lang} className="inline-block bg-gray-200 rounded px-2 py-1 mr-2">
                  {lang}
                </span>
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-green-500 text-white p-2 rounded"
          >
            Add Project
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProjectModal;