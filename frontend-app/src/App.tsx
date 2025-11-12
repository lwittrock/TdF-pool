import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TestPage1 from './pages/TestPage1';
import TestPage2 from './pages/TestPage2';
import TestPage3 from './pages/TestPage3';

function App() {
  return (
    <Router>
      <div>
        {/* Navigation Menu */}
        <nav className="bg-gray-800 p-4 shadow-md">
          <ul className="flex justify-center space-x-24">
            <li>
              <Link to="/" className="text-white hover:text-green-400 transition duration-300">Home</Link>
            </li>
            <li>
              <Link to="/test1" className="text-white hover:text-green-400 transition duration-300">Test Page 1</Link>
            </li>
            <li>
              <Link to="/test2" className="text-white hover:text-green-400 transition duration-300">Test Page 2</Link>
            </li>
            <li>
              <Link to="/test3" className="text-white hover:text-green-400 transition duration-300">Test Page 3</Link>
            </li>
          </ul>
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