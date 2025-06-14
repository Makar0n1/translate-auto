import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Tooltip } from 'react-tooltip';

function MobileTabBar({ setModalType, setIsModalOpen, handleLogout }) {
  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed bottom-0 left-0 right-0 bg-holo text-white p-2 shadow-neon flex justify-around items-center md:hidden z-50 h-16"
    >
      <NavLink
        to="/dashboard"
        className={({ isActive }) => `nav-tab-mobile ${isActive ? 'nav-tab-mobile-active' : ''}`}
        data-tooltip-id="tooltip-tab-standard"
        data-tooltip-content="Standard Projects"
      >
        Standard
      </NavLink>
      <NavLink
        to="/csv-translation"
        className={({ isActive }) => `nav-tab-mobile ${isActive ? 'nav-tab-mobile-active' : ''}`}
        data-tooltip-id="tooltip-tab-csv"
        data-tooltip-content="CSV Projects"
      >
        CSV
      </NavLink>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleLogout}
        className="nav-tab-mobile bg-red-500 hover:bg-red-600"
        data-tooltip-id="tooltip-tab-logout"
        data-tooltip-content="Sign out"
      >
        Logout
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => { setModalType('csv'); setIsModalOpen(true); }}
        className="absolute -top-6 bg-orange-500 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-neon z-10"
        data-tooltip-id="tooltip-tab-create"
        data-tooltip-content="Create Project"
      >
        +
      </motion.button>
      <Tooltip id="tooltip-tab-standard" className="tooltip-custom" />
      <Tooltip id="tooltip-tab-create" className="tooltip-custom" />
      <Tooltip id="tooltip-tab-csv" className="tooltip-custom" />
      <Tooltip id="tooltip-tab-logout" className="tooltip-custom" />
    </motion.div>
  );
}

export default MobileTabBar;