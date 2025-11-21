import React from 'react';
import { Shield, Zap, Users } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-8 text-center">About Peer Link</h2>
      <p className="text-lg mb-8 text-gray-300">
        Peer Link is a modern, secure, and high-performance file sharing solution. We leverage advanced peer-to-peer technology and a distributed cluster architecture to ensure your files are transferred directly, quickly, and privately—without ever touching a central server.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="bg-gray-800 p-6 rounded-lg">
          <Shield className="text-blue-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold mb-2">Secure by Design</h3>
          <p className="text-gray-400">End-to-end DTLS 1.3 encryption ensures your data remains private. We have zero knowledge of what you share.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <Zap className="text-yellow-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold mb-2">Blazing Fast</h3>
          <p className="text-gray-400">Our distributed cluster routing and direct P2P connections maximize transfer speeds, limited only by your network.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <Users className="text-green-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold mb-2">Simple & Free</h3>
          <p className="text-gray-400">No sign-ups, no installations, and no hidden fees. Just open the link and start sharing immediately.</p>
        </div>
      </div>
      <h3 className="text-2xl font-bold mb-4">Our Mission</h3>
      <p className="text-lg mb-8 text-gray-300">
        We believe file sharing should be frictionless and private. In an age of data surveillance, Peer Link stands for user sovereignty—giving you complete control over your data with a tool that just works.
      </p>
      <h3 className="text-2xl font-bold mb-4">Technology</h3>
      <p className="text-lg mb-8 text-gray-300">
        Built on WebRTC and powered by a high-performance Node.js cluster with Redis-backed signaling, Peer Link represents the next generation of browser-based file transfer.
      </p>
    </div>
  );
};

export default About;

