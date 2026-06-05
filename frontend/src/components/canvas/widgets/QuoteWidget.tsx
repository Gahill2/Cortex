import { useEffect, useState } from "react";

interface Quote {
  text: string;
  author: string;
}

const FALLBACK_QUOTES: Quote[] = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Focus is about saying no to the hundred other good ideas.", author: "Steve Jobs" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { text: "We are what we repeatedly do. Excellence is not an act, but a habit.", author: "Aristotle" },
  { text: "Shipping beats perfection.", author: "Reid Hoffman" },
  { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
];

function getDailyQuote(): Quote {
  const dayIndex = Math.floor(Date.now() / 86400000) % FALLBACK_QUOTES.length;
  return FALLBACK_QUOTES[dayIndex];
}

export function QuoteWidget() {
  const [quote, setQuote] = useState<Quote>(getDailyQuote);
  const [fading, setFading] = useState(false);

  const refresh = () => {
    setFading(true);
    setTimeout(() => {
      const idx = Math.floor(Math.random() * FALLBACK_QUOTES.length);
      setQuote(FALLBACK_QUOTES[idx]);
      setFading(false);
    }, 200);
  };

  return (
    <div className="quote-widget">
      <div className={`quote-content${fading ? " quote-content--fading" : ""}`}>
        <blockquote className="quote-text">"{quote.text}"</blockquote>
        <cite className="quote-author">— {quote.author}</cite>
      </div>
      <button className="quote-refresh" onClick={refresh} title="New quote">↻</button>
    </div>
  );
}
