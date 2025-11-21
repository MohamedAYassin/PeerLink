import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-800 text-gray-300 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p>&copy; 2025 Peer Link. All rights reserved.</p>
          <p className="mt-4 md:mt-0">
            Made by <a href="https://yassin.dev" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">Mohamed</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

