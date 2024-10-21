import React from 'react';
import { Link } from 'lucide-react';

interface HeaderProps {
  setCurrentView: (view: string) => void;
}

const Header: React.FC<HeaderProps> = ({ setCurrentView }) => {
  return (
    <header className="bg-gray-800 shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link className="text-blue-400 mr-2" size={24} />
          <h1 className="text-2xl font-bold text-white">Peer Link</h1>
        </div>
        <nav>
          <ul className="flex space-x-6">
            <li>
              <button
                onClick={() => setCurrentView('home')}
                className="text-gray-300 hover:text-white transition duration-150 ease-in-out"
              >
                Home
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView('about')}
                className="text-gray-300 hover:text-white transition duration-150 ease-in-out"
              >
                About
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView('faq')}
                className="text-gray-300 hover:text-white transition duration-150 ease-in-out"
              >
                FAQ
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView('privacy')}
                className="text-gray-300 hover:text-white transition duration-150 ease-in-out"
              >
                Privacy
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;