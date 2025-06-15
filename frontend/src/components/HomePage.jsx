import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Tooltip } from 'react-tooltip';

function HomePage() {
  const isMobile = window.innerWidth < 768;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7 }}
      className="container mx-auto px-4 py-6 sm:py-8 flex-grow w-full pb-16 md:pb-0 bg-gradient-to-b from-dark-blue to-futuristic"
    >
      {isMobile ? (
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-emerald mb-6">Welcome to AI-Translation</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Standard Projects</h3>
              <p className="text-silver text-sm">
                Translate individual data entries, such as movie titles and descriptions, with precision and ease.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">CSV Projects</h3>
              <p className="text-silver text-sm">
                Bulk translate CSV files with support for WordPress import, perfect for large-scale content updates.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-emerald mb-8">Choose Your Project Type</h2>
          <motion.div
            className="grid gap-6 md:grid-cols-1"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
            }}
          >
            <motion.div
              className="bg-dark-blue p-6 rounded-xl border border-silver shadow-neon-lg"
              variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
              transition={{ type: 'spring', stiffness: 100 }}
            >
              <h3 className="text-xl font-semibold text-white mb-4">Standard Projects</h3>
              <p className="text-silver text-sm mb-6">
                Translate individual data entries, such as movie titles and descriptions, with precision and ease.
              </p>
              <NavLink
                to="/dashboard"
                className="bg-emerald-500 text-white px-6 py-2 rounded-lg hover:bg-emerald-600 transition-all duration-300 inline-block"
                data-tooltip-id="tooltip-standard"
                data-tooltip-content="Go to Standard Projects"
              >
                Go to Standard Projects
              </NavLink>
            </motion.div>
            <motion.div
              className="bg-dark-blue p-6 rounded-xl border border-silver shadow-neon-lg"
              variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
              transition={{ type: 'spring', stiffness: 100 }}
            >
              <h3 className="text-xl font-semibold text-white mb-4">CSV Projects</h3>
              <p className="text-silver text-sm mb-6">
                Bulk translate CSV files with support for WordPress import, perfect for large-scale content updates.
              </p>
              <NavLink
                to="/csv-translation"
                className="bg-emerald-500 text-white px-6 py-2 rounded-lg hover:bg-emerald-600 transition-all duration-300 inline-block"
                data-tooltip-id="tooltip-csv"
                data-tooltip-content="Go to CSV Projects"
              >
                Go to CSV Projects
              </NavLink>
            </motion.div>
          </motion.div>
        </div>
      )}
      {!isMobile && (
        <>
          <Tooltip id="tooltip-standard" className="tooltip-custom" />
          <Tooltip id="tooltip-csv" className="tooltip-custom" />
        </>
      )}
    </motion.div>
  );
}

export default HomePage;