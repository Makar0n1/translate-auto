import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaHome } from 'react-icons/fa';

function MobileTabBar({ setModalType, setIsModalOpen, setIsTypeModalOpen, handleLogout, isModalOpen }) {
  const location = useLocation();

  const handlePlusClick = () => {
    if (location.pathname === '/') {
      setIsTypeModalOpen(true);
    } else {
      setModalType(location.pathname === '/csv-translation' ? 'csv' : 'standard');
      setIsModalOpen(true);
    }
  };

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed bottom-0 left-0 right-0 bg-holo text-white p-0 shadow-neon flex items-center md:hidden z-50 h-[50px] pb-safe"
    >
      <NavLink
        to="/"
        className={({ isActive }) => `nav-tab-mobile nav-tab-home ${isActive ? 'nav-tab-mobile-active' : ''} ${isModalOpen ? 'pointer-events-none opacity-50' : ''}`}
      >
        <FaHome className="text-xl" />
      </NavLink>
      <NavLink
        to="/dashboard"
        className={({ isActive }) => `nav-tab-mobile nav-tab-standard ${isActive ? 'nav-tab-mobile-active' : ''} ${isModalOpen ? 'pointer-events-none opacity-50' : ''}`}
      >
        Standard
      </NavLink>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handlePlusClick}
        disabled={isModalOpen}
        className="bg-orange-500 text-white w-[50px] h-[50px] rounded-full flex items-center justify-center text-2xl shadow-neon z-60 absolute left-1/2 transform -translate-x-1/2"
      >
        <span className="text-3xl leading-none mb-[6px]">+</span>
      </motion.button>
      <NavLink
        to="/csv-translation"
        className={({ isActive }) => `nav-tab-mobile nav-tab-csv ${isActive ? 'nav-tab-mobile-active' : ''} ${isModalOpen ? 'pointer-events-none opacity-50' : ''}`}
      >
        CSV
      </NavLink>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleLogout}
        disabled={isModalOpen}
        className={`nav-tab-mobile nav-tab-logout bg-red-500 ${isModalOpen ? 'pointer-events-none opacity-50' : ''}`}
      >
        Logout
      </motion.button>
    </motion.div>
  );
}

export default MobileTabBar;