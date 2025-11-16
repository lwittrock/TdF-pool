import { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TestPage1 from './pages/TestPage1';
import TestPage2 from './pages/TestPage2';
import TestPage3 from './pages/TestPage3';

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <Router basename="/TdF-pool">
      <div>
        {/* Navigation Menu */}
        <nav className="bg-gray-800 p-4 shadow-md">
          <div className="max-w-7xl mx-auto">
            {/* Mobile Menu Button */}
            <div className="flex justify-between items-center lg:hidden">
              <span className="text-white font-bold text-lg">ACM Tour de France Poule</span>
              <button
                onClick={toggleMobileMenu}
                className="text-white focus:outline-none"
                aria-label="Toggle menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>

            {/* Desktop Menu */}
            <ul className="hidden lg:flex justify-center space-x-24">
              <li>
                <Link
                  to="/"
                  className="text-white hover:text-green-400 transition duration-300"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/test1"
                  className="text-white hover:text-green-400 transition duration-300"
                >
                  Test Page 1
                </Link>
              </li>
              <li>
                <Link
                  to="/test2"
                  className="text-white hover:text-green-400 transition duration-300"
                >
                  Test Page 2
                </Link>
              </li>
              <li>
                <Link
                  to="/test3"
                  className="text-white hover:text-green-400 transition duration-300"
                >
                  Test Page 3
                </Link>
              </li>
            </ul>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
              <ul className="lg:hidden mt-4 space-y-2">
                <li>
                  <Link
                    to="/"
                    onClick={closeMobileMenu}
                    className="block py-3 px-4 text-white hover:bg-gray-700 rounded transition duration-300"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    to="/test1"
                    onClick={closeMobileMenu}
                    className="block py-3 px-4 text-white hover:bg-gray-700 rounded transition duration-300"
                  >
                    Test Page 1
                  </Link>
                </li>
                <li>
                  <Link
                    to="/test2"
                    onClick={closeMobileMenu}
                    className="block py-3 px-4 text-white hover:bg-gray-700 rounded transition duration-300"
                  >
                    Test Page 2
                  </Link>
                </li>
                <li>
                  <Link
                    to="/test3"
                    onClick={closeMobileMenu}
                    className="block py-3 px-4 text-white hover:bg-gray-700 rounded transition duration-300"
                  >
                    Test Page 3
                  </Link>
                </li>
              </ul>
            )}
          </div>
        </nav>

        {/* Routes */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/test1" element={<TestPage1 />} />
          <Route path="/test2" element={<TestPage2 />} />
          <Route path="/test3" element={<TestPage3 />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;