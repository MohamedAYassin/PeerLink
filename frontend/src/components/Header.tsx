import React, { useState } from 'react';
import { Link, Menu, X } from 'lucide-react';

interface HeaderProps {
  setCurrentView: (view: string) => void;
}

const Header: React.FC<HeaderProps> = ({ setCurrentView }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleNavClick = (view: string) => {
    setCurrentView(view);
    setIsMenuOpen(false);
  };

  return (
      <header className="bg-gray-800 shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Link className="text-blue-400 mr-2" size={24}/>
              <h1
                  className="text-2xl font-bold text-white flex items-center cursor-pointer"
                  onClick={() => window.location.href = ''}
                  style={{textDecoration: 'none'}}
              >
                Peer Link
                <span className="text-sm text-blue-400 ml-1 relative" style={{top: '4px'}}>
               
              </span>
              </h1>
            </div>

            <button
                className="md:hidden text-gray-300 hover:text-white"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <nav className="hidden md:block">
              <ul className="flex space-x-6">
                <li>
                  <button
                      onClick={() => handleNavClick('home')}
                      className="text-gray-300 hover:text-white transition duration-150 ease-in-out"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                      onClick={() => handleNavClick('about')}
                      className="text-gray-300 hover:text-white transition duration-150 ease-in-out"
                  >
                    About
                  </button>
                </li>
                <li>
                  <button
                      onClick={() => handleNavClick('faq')}
                      className="text-gray-300 hover:text-white transition duration-150 ease-in-out"
                  >
                    FAQ
                  </button>
                </li>
                <li>
                  <button
                      onClick={() => handleNavClick('privacy')}
                      className="text-gray-300 hover:text-white transition duration-150 ease-in-out"
                  >
                    Privacy
                  </button>
                </li>
              </ul>
            </nav>
          </div>

          {isMenuOpen && (
              <nav className="md:hidden mt-4">
                <ul className="flex flex-col space-y-4">
                  <li>
                    <button
                        onClick={() => handleNavClick('home')}
                        className="text-gray-300 hover:text-white transition duration-150 ease-in-out block w-full text-left"
                    >
                      Home
                    </button>
                  </li>
                  <li>
                    <button
                        onClick={() => handleNavClick('about')}
                        className="text-gray-300 hover:text-white transition duration-150 ease-in-out block w-full text-left"
                    >
                      About
                    </button>
                  </li>
                  <li>
                    <button
                        onClick={() => handleNavClick('faq')}
                        className="text-gray-300 hover:text-white transition duration-150 ease-in-out block w-full text-left"
                    >
                      FAQ
                    </button>
                  </li>
                  <li>
                    <button
                        onClick={() => handleNavClick('privacy')}
                        className="text-gray-300 hover:text-white transition duration-150 ease-in-out block w-full text-left"
                    >
                      Privacy
                    </button>
                  </li>
                </ul>
              </nav>
          )}
        </div>
      </header>
  );
};

export default Header;

