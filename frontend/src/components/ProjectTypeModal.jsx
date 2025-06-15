import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function ProjectTypeModal({ onClose, setModalType, setIsModalOpen }) {
  const navigate = useNavigate();

  const handleSelectType = (type, path) => {
    setModalType(type);
    setIsModalOpen(true);
    navigate(path);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="bg-dark-blue p-6 rounded-xl border border-silver shadow-neon w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-emerald mb-4 text-center">Select Project Type</h2>
        <div className="flex flex-col gap-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSelectType('standard', '/dashboard')}
            className="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-all duration-300"
          >
            Standard Project
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSelectType('csv', '/csv-translation')}
            className="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-all duration-300"
          >
            CSV Project
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ProjectTypeModal;