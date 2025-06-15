import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaHome } from 'react-icons/fa';
import { useState, useEffect } from 'react';

function MobileTabBar({ setModalType, setIsModalOpen, setIsTypeModalOpen, handleLogout, isModalOpen }) {
  const location = useLocation();
  const [safeAreaBottom, setSafeAreaBottom] = useState(0);

  const handlePlusClick = () => {
    if (location.pathname === '/') {
      setIsTypeModalOpen(true);
    } else {
      setModalType(location.pathname === '/csv-translation' ? 'csv' : 'standard');
      setIsModalOpen(true);
    }
  };

  useEffect(() => {
    const updateSafeArea = () => {
      const bottomInset = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)') || '0px';
      const bottomInsetValue = parseFloat(bottomInset) || 0;
      setSafeAreaBottom(Math.max(60, bottomInsetValue));
    };

    updateSafeArea();
    window.addEventListener('resize', updateSafeArea);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateSafeArea);
    }

    return () => {
      window.removeEventListener('resize', updateSafeArea);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateSafeArea);
      }
    };
  }, []);

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed bottom-0 left-0 right-0 text-white p-0 shadow-neon flex items-center md:hidden z-50 safe-area-bottom"
      style={{ height: `${50 + safeAreaBottom}px` }}
    >
      <div className="w-full h-[50px] bg-holo flex items-center">
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
        <motion.button
          onClick={handlePlusClick}
          //disabled={isModalOpen}
          className="bg-orange-500 text-white w-[50px] h-[50px] rounded-full flex items-center justify-center text-2xl shadow-neon z-60 absolute left-[calc(50%-25px)] top-0"
        >
          <span className="text-3xl leading-none mb-[6px]">+</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

export default MobileTabBar;