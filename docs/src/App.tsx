import { useState } from 'react';
import { HashRouter, Route, Routes, Link, useLocation } from 'react-router-dom';
import HomePage from './pages/Leaderboard';
import TestPage1 from './pages/RiderLeaderboard';
import TestPage2 from './pages/TestPage2';
import TestPage3 from './pages/TestPage3';

// Animated hamburger menu icon that transforms into an X when open
const AnimatedMenuIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
  <div className="flex flex-col justify-center items-center w-6 h-5 gap-1">
    <span
      className={`block w-full h-0.5 bg-white transition-all duration-300 ${
        isOpen ? 'rotate-45 translate-y-[0.4rem]' : ''
      }`}
    />
    <span
      className={`block w-full h-0.5 bg-white transition-all duration-300 ${
        isOpen ? 'opacity-0' : 'opacity-100'
      }`}
    />
    <span
      className={`block w-full h-0.5 bg-white transition-all duration-300 ${
        isOpen ? '-rotate-45 -translate-y-[0.4rem]' : ''
      }`}
    />
  </div>
);

// Navigation component that has access to useLocation
function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // Check if a navigation link matches the current route
  const isLinkActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Generate appropriate CSS classes for navigation links based on active state and viewport
  const getLinkClass = (path: string) => {
    const isActive = isLinkActive(path);
    const baseClass = "transition duration-300";
    const activeDesktop = "text-tdf-accent font-semibold";
    const inactiveDesktop = "text-white hover:text-tdf-accent";
    const activeMobile = "block py-3 px-4 text-tdf-accent font-semibold bg-gray-700/50 rounded";
    const inactiveMobile = "block py-3 px-4 text-white hover:bg-gray-700/30 rounded transition-colors";

    if (mobileMenuOpen) {
      return baseClass + (isActive ? ` ${activeMobile}` : ` ${inactiveMobile}`);
    } else {
      return baseClass + (isActive ? ` ${activeDesktop}` : ` ${inactiveDesktop}`);
    }
  };

  return (
    <nav className="bg-gray-800 p-4 shadow-md">
      <div className="max-w-7xl mx-auto">
        {/* Mobile Header with Menu Toggle */}
        <div className="flex justify-between items-center lg:hidden">
          <span className="text-white font-bold text-lg">ACM Tour de France Poule</span>
          <button
            onClick={toggleMobileMenu}
            className="text-white focus:outline-none active:bg-transparent p-2 hover:bg-gray-700 rounded transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label="Toggle menu"
          >
            <AnimatedMenuIcon isOpen={mobileMenuOpen} />
          </button>
        </div>

        {/* Desktop Navigation Links */}
        <ul className="hidden lg:flex justify-center space-x-24">
          <li>
            <Link to="/" className={getLinkClass('/')}>
              Klassement
            </Link>
          </li>
          <li>
            <Link to="/test1" className={getLinkClass('/test1')}>
              Renner Punten
            </Link>
          </li>
          <li>
            <Link to="/test2" className={getLinkClass('/test2')}>
              Team Selectie
            </Link>
          </li>
          <li>
            <Link to="/test3" className={getLinkClass('/test3')}>
              Over deze Poule
            </Link>
          </li>
        </ul>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <ul className="lg:hidden mt-4 space-y-1 pt-4 border-t border-gray-700">
            <li>
              <Link to="/" onClick={closeMobileMenu} className={getLinkClass('/')}>
                Klassement
              </Link>
            </li>
            <li>
              <Link to="/test1" onClick={closeMobileMenu} className={getLinkClass('/test1')}>
                Renner Punten
              </Link>
            </li>
            <li>
              <Link to="/test2" onClick={closeMobileMenu} className={getLinkClass('/test2')}>
                Team Selectie
              </Link>
            </li>
            <li>
              <Link to="/test3" onClick={closeMobileMenu} className={getLinkClass('/test3')}>
                Over deze Poule
              </Link>
            </li>
          </ul>
        )}
      </div>
    </nav>
  );
}

function App() {
  return (
    <HashRouter>
      <div>
        <Navigation />

        {/* Page Content */}
        <main className="max-w-7xl mx-auto p-4">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/test1" element={<TestPage1 />} />
            <Route path="/test2" element={<TestPage2 />} />
            <Route path="/test3" element={<TestPage3 />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;