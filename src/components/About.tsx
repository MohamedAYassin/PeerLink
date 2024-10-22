import React from 'react';
import { Shield, Zap, Users } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-8 text-center">About Peer Link</h2>
      <p className="text-lg mb-8 text-gray-300">
        Peer Link is the ultimate one-click file sending solution, designed to make sharing files as easy and secure as possible. Our platform leverages cutting-edge peer-to-peer technology to ensure your files are transferred directly between devices, without ever touching our servers.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="bg-gray-800 p-6 rounded-lg">
          <Shield className="text-blue-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold mb-2">Secure</h3>
          <p className="text-gray-400">DTLS 1.3 Encryption ensures your files remain private and secure throughout the transfer process.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <Zap className="text-yellow-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold mb-2">Fast</h3>
          <p className="text-gray-400">Direct peer-to-peer connections allow for lightning-fast file transfers, regardless of file size.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <Users className="text-green-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold mb-2">Easy to Use</h3>
          <p className="text-gray-400">Our intuitive interface makes it simple for anyone to send and receive files with just a few clicks.</p>
        </div>
      </div>
      <h3 className="text-2xl font-bold mb-4">Our Mission</h3>
      <p className="text-lg mb-8 text-gray-300">
        At Peer Link, we believe that sharing files should be simple, fast, and secure. Our mission is to provide a seamless file-sharing experience that respects your privacy and puts you in control of your data.
      </p>
      <h3 className="text-2xl font-bold mb-4">How It Works</h3>
      <p className="text-lg mb-8 text-gray-300">
        Peer Link uses WebRTC technology to establish direct connections between peers. When you share a file, it's encrypted and sent directly to the recipient without passing through any intermediary servers. This ensures maximum privacy and security for your transfers.
      </p>
    </div>
  );
};

export default About;