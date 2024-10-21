import React from 'react';

const FAQ: React.FC = () => {
  const faqs = [
    {
      question: "How secure is Peer Link?",
      answer: "Peer Link uses end-to-end encryption with DTLS 1.3, ensuring that your files are secure during transfer. We don't store any of your files on our servers, and the data is transferred directly between peers."
    },
    {
      question: "Is there a file size limit?",
      answer: "There is no set file size limit for transfers. However, larger files may take longer to transfer depending on your internet connection speed."
    },
    {
      question: "Do I need to create an account to use Peer Link?",
      answer: "No, Peer Link doesn't require any account creation. You can start sharing files immediately without signing up."
    },
    {
      question: "How long are my files available for download?",
      answer: "Files are only available during the active transfer session. Once the transfer is complete, the files are not stored anywhere and the link becomes invalid."
    },
    {
      question: "Can I use Peer Link on mobile devices?",
      answer: "Yes, Peer Link works on modern mobile browsers that support WebRTC technology."
    },
    {
      question: "What happens if my connection is interrupted during a transfer?",
      answer: "If your connection is interrupted, the transfer will break and will need to be redone from the beginning."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
      <div className="space-y-8">
        {faqs.map((faq, index) => (
          <div key={index} className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">{faq.question}</h3>
            <p className="text-gray-300">{faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FAQ;