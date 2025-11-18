import { useState } from 'react';
// Import HashRouter, Route, Routes, and Link
import { HashRouter, Route, Routes, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TestPage1 from './pages/TestPage1';
import TestPage2 from './pages/TestPage2';
import TestPage3 from './pages/TestPage3';

// Helper component for the animated hamburger/cross icon
const AnimatedMenuIcon = ({ isOpen }) => (
  <div className="flex flex-col justify-center items-center w-6 h-6 transition duration-300 ease-in-out">
    <div
      className={`block w-6 h-0.5 bg-white transition duration-300 ease-in-out ${
        isOpen ? 'transform rotate-45 translate-y-0.5' : 'transform translate-y-[-4px]'
      }`}
    />
    <div
      className={`block w-6 h-0.5 bg-white transition duration-300 ease-in-out ${
        isOpen ? 'opacity-0' : 'opacity-100 mt-1'
      }`}
    />
    <div
      className={`block w-6 h-0.5 bg-white transition duration-300 ease-in-out ${
        isOpen ? 'transform -rotate-45 translate-y-[-4.5px]' : 'transform translate-y-[4px]'
      }`}
    />
  </div>
);

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // Helper function to determine if a link is active.
  // Note: HashRouter/Link handles history, but checking window.location.hash is simplest 
  // for manually applying an active class without useLocation hook complexity.
  const isLinkActive = (path) => {
    // HashRouter uses the format #/path. 
    // We check if the current hash starts with the path (e.g., #/test1 should match /test1)
    if (path === '/') {
        // Special case for root: it should match only '#/' or ''
        return window.location.hash === '#/' || window.location.hash === '';
    }
    return window.location.hash.startsWith(`#${path}`);
  };

  // Helper to apply active class based on the current hash
  const getLinkClass = (path) => {
      const isActive = isLinkActive(path);
      const baseClass = "transition duration-300";
      const activeDesktop = "text-green-400 font-semibold";
      const inactiveDesktop = "text-white hover:text-green-400";
      const activeMobile = "block py-3 px-4 text-green-400 font-semibold bg-gray-700 rounded";
      const inactiveMobile = "block py-3 px-4 text-white hover:bg-gray-700 rounded";

      // Apply different classes for mobile vs desktop active/inactive states
      if (mobileMenuOpen) {
          return baseClass + (isActive ? ` ${activeMobile}` : ` ${inactiveMobile}`);
      } else {
          return baseClass + (isActive ? ` ${activeDesktop}` : ` ${inactiveDesktop}`);
      }
  };

  return (
    // 1. Use HashRouter instead of BrowserRouter. This automatically handles the # routing.
    <HashRouter>
      <div>
        {/* Navigation Menu */}
        <nav className="bg-gray-800 p-4 shadow-md">
          <div className="max-w-7xl mx-auto">
            {/* Mobile Menu Button */}
            <div className="flex justify-between items-center lg:hidden">
              <span className="text-white font-bold text-lg">ACM Tour de France Poule</span>
              <button
                onClick={toggleMobileMenu}
                className="text-white focus:outline-none p-1"
                aria-label="Toggle menu"
              >
                {/* 2. Animated Hamburger/Cross Icon */}
                <AnimatedMenuIcon isOpen={mobileMenuOpen} />
              </button>
            </div>

            {/* Desktop Menu */}
            <ul className="hidden lg:flex justify-center space-x-24">
              <li>
                {/* Use <Link> component */}
                <Link to="/" className={getLinkClass('/')}>
                  Home
                </Link>
              </li>
              <li>
                <Link to="/test1" className={getLinkClass('/test1')}>
                  Test Page 1
                </Link>
              </li>
              <li>
                <Link to="/test2" className={getLinkClass('/test2')}>
                  Test Page 2
                </Link>
              </li>
              <li>
                <Link to="/test3" className={getLinkClass('/test3')}>
                  Test Page 3
                </Link>
              </li>
            </ul>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
              // 3. Visually Distinct Menu: Added darker background and top border divider
              <ul className="lg:hidden mt-4 space-y-2 border-t border-gray-700 bg-gray-900 pt-4">
                <li>
                  <Link to="/" onClick={closeMobileMenu} className={getLinkClass('/')}>
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/test1" onClick={closeMobileMenu} className={getLinkClass('/test1')}>
                    Test Page 1
                  </Link>
                </li>
                <li>
                  <Link to="/test2" onClick={closeMobileMenu} className={getLinkClass('/test2')}>
                    Test Page 2
                  </Link>
                </li>
                <li>
                  <Link to="/test3" onClick={closeMobileMenu} className={getLinkClass('/test3')}>
                    Test Page 3
                  </Link>
                </li>
              </ul>
            )}
          </div>
        </nav>

        {/* Routes: Now managed by HashRouter */}
        <main className="max-w-7xl mx-auto p-4">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/test1" element={<TestPage1 />} />
            <Route path="/test2" element={<TestPage2 />} />
            <Route path="/test3" element={<TestPage3 />} />
            {/* You might add a catch-all route here: <Route path="*" element={<NotFoundPage />} /> */}
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
