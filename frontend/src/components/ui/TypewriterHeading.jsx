import React, { useEffect, useState } from 'react';

const texts = [
  'Entre na sua conta para continuar',
  'Unigran',
  'Onde o mundo acadêmico se encontra. :)'
];

export default function TypewriterHeading({ className = '' }) {
  const [display, setDisplay] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [index, setIndex] = useState(0); // texto atual
  const [char, setChar] = useState(0);

  useEffect(() => {
    let timeout;

    const currentText = texts[index];

    if (!isDeleting) {
      // Escrevendo
      if (char < currentText.length) {
        timeout = setTimeout(() => {
          setDisplay(currentText.slice(0, char + 1));
          setChar(char + 1);
        }, 60);
      } else {
        // Espera antes de apagar
        timeout = setTimeout(() => setIsDeleting(true), 1000);
      }
    } else {
      // Apagando
      if (char > 0) {
        timeout = setTimeout(() => {
          setDisplay(currentText.slice(0, char - 1));
          setChar(char - 1);
        }, 30);
      } else {
        // Vai para o próximo texto (loop)
        setIsDeleting(false);
        setIndex((prev) => (prev + 1) % texts.length);
      }
    }

    return () => clearTimeout(timeout);
  }, [char, isDeleting, index]);

  return (
    <h1 className={`auth-heading ${className}`}>
      {display}
      <span className="typewriter-cursor" />
    </h1>
  );
}