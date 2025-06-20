import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClipLoader } from 'react-spinners';
import { Tooltip } from 'react-tooltip';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3200';

function ProjectModal({ type, onClose, onAdd }) {
  const [tab, setTab] = useState('translation');
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState(
    type === 'csv' ? 
      { id: '', Title: '', Content: '', Permalink: '', Slug: '' } : 
      { imdbid: '', title: '', description: '' }
  );
  const [languages, setLanguages] = useState([]);
  const [newLanguage, setNewLanguage] = useState('');
  const [importToSite, setImportToSite] = useState(false);
  const [generateOnly, setGenerateOnly] = useState(false);
  const [generateMetaDescription, setGenerateMetaDescription] = useState(false); // Новый чекбокс
  const [domain, setDomain] = useState({
    url: '',
    login: '',
    apiPassword: '',
    isWordPress: false
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const modalRef = useRef();
  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleClickOutside = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  const handleFileChange = (e) => {
    console.log('File input changed:', e.target.files);
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx')) {
        setErrors({ ...errors, file: 'Please upload an XLSX file' });
        setFile(null);
      } else if (selectedFile.size > 50 * 1024 * 1024) {
        setErrors({ ...errors, file: 'File size exceeds 50MB limit' });
        setFile(null);
      } else {
        setErrors({ ...errors, file: '' });
        setFile(selectedFile);
      }
    } else {
      setFile(null);
    }
  };

  const handleAddLanguage = () => {
    if (generateOnly) {
      if (languages.length === 0) {
        setLanguages(['en']);
        console.log('Added default language: en for generateOnly');
      }
      return;
    }
    const trimmedLang = newLanguage.trim();
    if (trimmedLang && !languages.includes(trimmedLang)) {
      setLanguages([...languages, trimmedLang]);
      setNewLanguage('');
      setErrors({ ...errors, languages: '' });
      console.log('Added language:', trimmedLang);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!name) newErrors.name = 'Project name is required';
    if (!file) newErrors.file = 'File is required';
    const requiredFields = type === 'csv' ? 
      ['id', 'Title', 'Content', 'Permalink', 'Slug'] : 
      ['imdbid', 'title', 'description'];
    requiredFields.forEach(field => {
      if (!columns[field]) newErrors[field] = `${field} column is required`;
    });
    if (!generateOnly && languages.length === 0) {
      newErrors.languages = 'At least one language is required';
    }
    if (importToSite) {
      if (!domain.url) newErrors.domainUrl = 'Website URL is required';
      if (!domain.login) newErrors.domainLogin = 'Login is required';
      if (!domain.apiPassword) newErrors.domainPassword = 'API password is required';
      if (!domain.isWordPress) newErrors.isWordPress = 'WordPress confirmation is required';
    }
    setErrors(newErrors);
    console.log('Validation errors:', newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setName('');
    setFile(null);
    setColumns(type === 'csv' ? 
      { id: '', Title: '', Content: '', Permalink: '', Slug: '' } : 
      { imdbid: '', title: '', description: '' }
    );
    setLanguages(generateOnly ? ['en'] : []);
    setNewLanguage('');
    setImportToSite(false);
    setGenerateOnly(false);
    setGenerateMetaDescription(false);
    setDomain({ url: '', login: '', apiPassword: '', isWordPress: false });
    setErrors({});
    setTab('translation');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('type', type);
    formData.append('file', file);
    formData.append('columns', JSON.stringify(columns));
    formData.append('languages', JSON.stringify(generateOnly ? ['en'] : languages));
    formData.append('importToSite', importToSite);
    formData.append('generateOnly', generateOnly);
    formData.append('generateMetaDescription', generateMetaDescription);

    if (importToSite) {
      let normalizedUrl = domain.url.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      if (!normalizedUrl.endsWith('/wp-json/wp/v2')) {
        normalizedUrl = normalizedUrl.replace(/\/$/, '') + '/wp-json/wp/v2';
      }
      const domainData = {
        url: normalizedUrl,
        login: domain.login,
        apiPassword: domain.apiPassword,
        isWordPress: domain.isWordPress
      };
      console.log('Domain data to send:', domainData);
      formData.append('domain', JSON.stringify(domainData));
    } else {
      console.log('No import, skipping domain data');
    }

    console.log('Form data:', [...formData.entries()]);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/projects`, formData, {
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
      setErrors({ ...errors, general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-60 flex items-start sm:items-center justify-center z-60 p-4 overflow-y-auto md:overflow-hidden md:bottom-0 bottom-16"
        onClick={handleClickOutside}
      >
        <motion.div
          ref={modalRef}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className="bg-dark-blue p-4 sm:p-6 md:p-8 rounded-xl border border-silver shadow-neon w-full max-w-[90vw] sm:max-w-lg max-h-[600px] overflow-y-auto"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-emerald mb-4 sm:mb-6 text-center">
            New {type === 'csv' ? 'CSV' : 'Standard'} Project
          </h2>
          {errors.general && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 mb-4 text-center text-xs sm:text-sm"
            >
              {errors.general}
            </motion.p>
          )}
          <div className="flex mb-4">
            <button
              className={`flex-1 py-2 px-2 sm:px-4 text-white text-xs sm:text-base ${tab === 'translation' ? 'bg-emerald-500' : 'bg-gray-700'} rounded-l-lg transition-all duration-300`}
              onClick={() => setTab('translation')}
            >
              Translation
            </button>
            {type === 'csv' && (
              <button
                className={`flex-1 py-2 px-2 sm:px-4 text-white text-xs sm:text-base ${tab === 'import' ? 'bg-emerald-500' : 'bg-gray-700'} rounded-r-lg transition-all duration-300 ${!importToSite ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => importToSite && setTab('import')}
                disabled={!importToSite}
              >
                Import
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit}>
            {tab === 'translation' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <motion.input
                  whileFocus={{ borderColor: '#2A9D8F' }}
                  type="text"
                  placeholder="Project Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full p-2 sm:p-3 mb-2 sm:mb-4 bg-gray-800 border ${errors.name ? 'border-red-400' : 'border-silver'} rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300`}
                  disabled={isLoading}
                  {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-name', 'data-tooltip-content': 'Enter project name', 'data-tooltip-delay-show': 1000 })}
                />
                {errors.name && <p className="text-red-400 text-xs mb-2">{errors.name}</p>}
                <div className="mb-2 sm:mb-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className={`bg-emerald-500 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg transition-all duration-300 text-xs sm:text-base ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isLoading}
                    {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-file', 'data-tooltip-content': 'Upload XLSX file', 'data-tooltip-delay-show': 1000 })}
                  >
                    Choose File
                  </motion.button>
                  <span className="ml-2 text-silver text-xs sm:text-sm">
                    {file ? file.name : 'No file selected'}
                  </span>
                  {errors.file && <p className="text-red-400 text-xs mt-1">{errors.file}</p>}
                </div>
                {type === 'csv' ? (
                  <>
                    <motion.input
                      whileFocus={{ borderColor: '#2A9D8F' }}
                      type="text"
                      placeholder="ID Column"
                      value={columns.id}
                      onChange={(e) => setColumns({ ...columns, id: e.target.value })}
                      className={`w-full p-2 sm:p-3 mb-2 sm:mb-4 bg-gray-800 border ${errors.id ? 'border-red-400' : 'border-silver'} rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300`}
                      disabled={isLoading}
                      {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-id', 'data-tooltip-content': 'Column name for ID', 'data-tooltip-delay-show': 1000 })}
                    />
                    {errors.id && <p className="text-red-400 text-xs mb-2">{errors.id}</p>}
                    <motion.input
                      whileFocus={{ borderColor: '#2A9D8F' }}
                      type="text"
                      placeholder="Title Column"
                      value={columns.Title}
                      onChange={(e) => setColumns({ ...columns, Title: e.target.value })}
                      className={`w-full p-2 sm:p-3 mb-2 sm:mb-4 bg-gray-800 border ${errors.Title ? 'border-red-400' : 'border-silver'} rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300`}
                      disabled={isLoading}
                      {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-title', 'data-tooltip-content': 'Column name for Title', 'data-tooltip-delay-show': 1000 })}
                    />
                    {errors.Title && <p className="text-red-400 text-xs mb-2">{errors.Title}</p>}
                    <motion.input
                      whileFocus={{ borderColor: '#2A9D8F' }}
                      type="text"
                      placeholder="Content Column"
                      value={columns.Content}
                      onChange={(e) => setColumns({ ...columns, Content: e.target.value })}
                      className={`w-full p-2 sm:p-3 mb-2 sm:mb-4 bg-gray-800 border ${errors.Content ? 'border-red-400' : 'border-silver'} rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300`}
                      disabled={isLoading}
                      {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-content', 'data-tooltip-content': 'Column name for Content', 'data-tooltip-delay-show': 1000 })}
                    />
                    {errors.Content && <p className="text-red-400 text-xs mb-2">{errors.Content}</p>}
                    <motion.input
                      whileFocus={{ borderColor: '#2A9D8F' }}
                      type="text"
                      placeholder="Permalink Column"
                      value={columns.Permalink}
                      onChange={(e) => setColumns({ ...columns, Permalink: e.target.value })}
                      className={`w-full p-2 sm:p-3 mb-2 sm:mb-4 bg-gray-800 border ${errors.Permalink ? 'border-red-400' : 'border-silver'} rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300`}
                      disabled={isLoading}
                      {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-permalink', 'data-tooltip-content': 'Column name for Permalink', 'data-tooltip-delay-show': 1000 })}
                    />
                    {errors.Permalink && <p className="text-red-400 text-xs mb-2">{errors.Permalink}</p>}
                    <motion.input
                      whileFocus={{ borderColor: '#2A9D8F' }}
                      type="text"
                      placeholder="Slug Column"
                      value={columns.Slug}
                      onChange={(e) => setColumns({ ...columns, Slug: e.target.value })}
                      className={`w-full p-2 sm:p-3 mb-2 sm:mb-4 bg-gray-800 border ${errors.Slug ? 'border-red-400' : 'border-silver'} rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300`}
                      disabled={isLoading}
                      {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-slug', 'data-tooltip-content': 'Column name for Slug', 'data-tooltip-delay-show': 1000 })}
                    />
                    {errors.Slug && <p className="text-red-400 text-xs mb-2">{errors.Slug}</p>}
                    <div className="mb-2 sm:mb-4 flex items-center">
                      <input
                        type="checkbox"
                        checked={generateOnly}
                        onChange={(e) => setGenerateOnly(e.target.checked)}
                        className="mr-2 h-3 sm:h-4 w-3 sm:w-4 text-emerald-500 border-silver rounded focus:ring-emerald-500"
                        disabled={isLoading}
                        id="generateOnly"
                        {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-generate-only', 'data-tooltip-content': 'Generate descriptions without translating titles' })}
                      />
                      <label htmlFor="generateOnly" className="text-silver text-xs sm:text-sm">
                        No translation, generate descriptions only
                      </label>
                    </div>
                    <div className="mb-2 sm:mb-4 flex items-center">
                      <input
                        type="checkbox"
                        checked={generateMetaDescription}
                        onChange={(e) => setGenerateMetaDescription(e.target.checked)}
                        className="mr-2 h-3 sm:h-4 w-3 sm:w-4 text-emerald-500 border-silver rounded focus:ring-emerald-500"
                        disabled={isLoading}
                        id="generateMetaDescription"
                        {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-meta-description', 'data-tooltip-content': 'Generate SEO-optimized meta description' })}
                      />
                      <label htmlFor="generateMetaDescription" className="text-silver text-xs sm:text-sm">
                        Generate SEO Meta Description
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <motion.input
                      whileFocus={{ borderColor: '#2A9D8F' }}
                      type="text"
                      placeholder="IMDb ID Column"
                      value={columns.imdbid}
                      onChange={(e) => setColumns({ ...columns, imdbid: e.target.value })}
                      className={`w-full p-2 sm:p-3 mb-2 sm:mb-4 bg-gray-800 border ${errors.imdbid ? 'border-red-400' : 'border-silver'} rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300`}
                      disabled={isLoading}
                      {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-imdbid', 'data-tooltip-content': 'Column name for IMDb ID', 'data-tooltip-delay-show': 1000 })}
                    />
                    {errors.imdbid && <p className="text-red-400 text-xs mb-2">{errors.imdbid}</p>}
                    <motion.input
                      whileFocus={{ borderColor: '#2A9D8F' }}
                      type="text"
                      placeholder="Title Column"
                      value={columns.title}
                      onChange={(e) => setColumns({ ...columns, title: e.target.value })}
                      className={`w-full p-2 sm:p-3 mb-2 sm:mb-4 bg-gray-800 border ${errors.title ? 'border-red-400' : 'border-silver'} rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300`}
                      disabled={isLoading}
                      {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-title-std', 'data-tooltip-content': 'Column name for Title', 'data-tooltip-delay-show': 1000 })}
                    />
                    {errors.title && <p className="text-red-400 text-xs mb-2">{errors.title}</p>}
                    <motion.input
                      whileFocus={{ borderColor: '#2A9D8F' }}
                      type="text"
                      placeholder="Description Column"
                      value={columns.description}
                      onChange={(e) => setColumns({ ...columns, description: e.target.value })}
                      className={`w-full p-2 sm:p-3 mb-2 sm:mb-4 bg-gray-800 border ${errors.description ? 'border-red-400' : 'border-silver'} rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300`}
                      disabled={isLoading}
                      {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-description', 'data-tooltip-content': 'Column name for Description', 'data-tooltip-delay-show': 1000 })}
                    />
                    {errors.description && <p className="text-red-400 text-xs mb-2">{errors.description}</p>}
                  </>
                )}
                <div className="mb-2 sm:mb-4">
                  <div className="flex gap-2">
                    <motion.input
                      whileFocus={{ borderColor: '#2A9D8F' }}
                      type="text"
                      placeholder="Language codes (e.g., ru, es)"
                      value={newLanguage}
                      onChange={(e) => setNewLanguage(e.target.value)}
                      className={`w-full p-2 sm:p-3 border ${errors.languages ? 'border-red-400' : 'border-silver'} bg-gray-800 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300 ${generateOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isLoading || generateOnly}
                      {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-language', 'data-tooltip-content': 'Enter a language code', 'data-tooltip-delay-show': 1000 })}
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={handleAddLanguage}
                      className={`bg-emerald-500 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg transition-all duration-300 text-xs sm:text-base ${isLoading || generateOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isLoading || generateOnly}
                      {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-add-lang', 'data-tooltip-content': 'Add language', 'data-tooltip-delay-show': 1000 })}
                    >
                      +
                    </motion.button>
                  </div>
                  {errors.languages && <p className="text-red-400 text-xs mt-1">{errors.languages}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {languages.map(lang => (
                      <motion.span
                        key={lang}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-block bg-emerald-500 text-white rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm"
                      >
                        {lang}
                      </motion.span>
                    ))}
                  </div>
                </div>
                {type === 'csv' && (
                  <div className="mb-2 sm:mb-4 flex items-center">
                    <input
                      type="checkbox"
                      checked={importToSite}
                      onChange={(e) => setImportToSite(e.target.checked)}
                      className="mr-2 h-3 sm:h-4 w-3 sm:w-4 text-emerald-500 border-silver rounded focus:ring-emerald-500"
                      disabled={isLoading}
                      id="importToSite"
                      {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-import', 'data-tooltip-content': 'Import to WordPress site' })}
                    />
                    <label htmlFor="importToSite" className="text-silver text-xs sm:text-sm">
                      Import translations to website
                    </label>
                  </div>
                )}
              </motion.div>
            )}
            {tab === 'import' && type === 'csv' && importToSite && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <motion.input
                  whileFocus={{ borderColor: '#2A9D8F' }}
                  type="text"
                  placeholder="Website URL (e.g., https://example.com)"
                  value={domain.url}
                  onChange={(e) => setDomain({ ...domain, url: e.target.value })}
                  className={`w-full p-2 sm:p-3 mb-2 sm:mb-4 bg-gray-800 border ${errors.domainUrl ? 'border-red-400' : 'border-silver'} rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300`}
                  disabled={isLoading}
                  {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-domain-url', 'data-tooltip-content': 'Enter website URL (API endpoint will be added automatically)' })}
                />
                {errors.domainUrl && <p className="text-red-400 text-xs mb-2">{errors.domainUrl}</p>}
                <motion.input
                  whileFocus={{ borderColor: '#2A9D8F' }}
                  type="text"
                  placeholder="Login"
                  value={domain.login}
                  onChange={(e) => setDomain({ ...domain, login: e.target.value })}
                  className={`w-full p-2 sm:p-3 mb-2 sm:mb-4 bg-gray-800 border ${errors.domainLogin ? 'border-red-400' : 'border-silver'} rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300`}
                  disabled={isLoading}
                  {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-domain-login', 'data-tooltip-content': 'Enter WordPress login' })}
                />
                {errors.domainLogin && <p className="text-red-400 text-xs mb-2">{errors.domainLogin}</p>}
                <motion.input
                  whileFocus={{ borderColor: '#2A9D8F' }}
                  type="password"
                  placeholder="API Password"
                  value={domain.apiPassword}
                  onChange={(e) => setDomain({ ...domain, apiPassword: e.target.value })}
                  className={`w-full p-2 sm:p-3 mb-2 sm:mb-4 bg-gray-800 border ${errors.domainPassword ? 'border-red-400' : 'border-silver'} rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300`}
                  disabled={isLoading}
                  {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-domain-password', 'data-tooltip-content': 'Enter WordPress API password' })}
                />
                {errors.domainPassword && <p className="text-red-400 text-xs mb-2">{errors.domainPassword}</p>}
                <div className="mb-2 sm:mb-4 flex items-center">
                  <input
                    type="checkbox"
                    checked={domain.isWordPress}
                    onChange={(e) => setDomain({ ...domain, isWordPress: e.target.checked })}
                    className={`mr-2 h-3 sm:h-4 w-3 sm:w-4 text-emerald-500 border ${errors.isWordPress ? 'border-red-400' : 'border-silver'} rounded focus:ring-emerald-500`}
                    disabled={isLoading}
                    id="isWordPress"
                    {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-is-wordpress', 'data-tooltip-content': 'Confirm WordPress site' })}
                  />
                  <label htmlFor="isWordPress" className="text-silver text-xs sm:text-sm">
                    This is a WordPress site (required)
                  </label>
                </div>
                {errors.isWordPress && <p className="text-red-400 text-xs mb-2">{errors.isWordPress}</p>}
              </motion.div>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="submit"
              className={`w-full bg-emerald-500 text-white p-2 sm:p-3 rounded-lg transition-all duration-300 text-sm sm:text-base ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isLoading}
              {...(isMobile ? {} : { 'data-tooltip-id': 'tooltip-submit', 'data-tooltip-content': 'Create project' })}
            >
              {isLoading ? <ClipLoader color="#FFF" size={16} /> : 'Create Project'}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
      {!isMobile && (
        <>
          <Tooltip id="tooltip-name" className="tooltip-custom" />
          <Tooltip id="tooltip-file" className="tooltip-custom" />
          <Tooltip id="tooltip-id" className="tooltip-custom" />
          <Tooltip id="tooltip-title" className="tooltip-custom" />
          <Tooltip id="tooltip-content" className="tooltip-custom" />
          <Tooltip id="tooltip-permalink" className="tooltip-custom" />
          <Tooltip id="tooltip-slug" className="tooltip-custom" />
          <Tooltip id="tooltip-imdbid" className="tooltip-custom" />
          <Tooltip id="tooltip-title-std" className="tooltip-custom" />
          <Tooltip id="tooltip-description" className="tooltip-custom" />
          <Tooltip id="tooltip-language" className="tooltip-custom" />
          <Tooltip id="tooltip-add-lang" className="tooltip-custom" />
          <Tooltip id="tooltip-submit" className="tooltip-custom" />
          <Tooltip id="tooltip-domain-url" className="tooltip-custom" />
          <Tooltip id="tooltip-domain-login" className="tooltip-custom" />
          <Tooltip id="tooltip-domain-password" className="tooltip-custom" />
          <Tooltip id="tooltip-import" className="tooltip-custom" />
          <Tooltip id="tooltip-is-wordpress" className="tooltip-custom" />
          <Tooltip id="tooltip-generate-only" className="tooltip-custom" />
          <Tooltip id="tooltip-meta-description" className="tooltip-custom" />
        </>
      )}
    </>
  );
}

export default ProjectModal;