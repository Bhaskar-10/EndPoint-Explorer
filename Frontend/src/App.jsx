import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('crawl');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [scrapeUrls, setScrapeUrls] = useState('');
  const [storeUrls, setStoreUrls] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatQuery, setChatQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [dbInfo, setDbInfo] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedUrls, setSelectedUrls] = useState(new Set());

  useEffect(() => {
    fetchDbInfo();
  }, []);

  // Update scrape and store URLs when selected URLs change
  useEffect(() => {
    const urlsArray = Array.from(selectedUrls);
    const urlsString = urlsArray.join('\n');
    setScrapeUrls(urlsString);
    setStoreUrls(urlsString);
  }, [selectedUrls]);

  const fetchDbInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/database-info`);
      const data = await response.json();
      setDbInfo(data);
    } catch (error) {
      console.error('Error fetching database info:', error);
    }
  };

  const handleUrlToggle = (url) => {
    setSelectedUrls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(url)) {
        newSet.delete(url);
      } else {
        newSet.add(url);
      }
      return newSet;
    });
  };

  const selectAllUrls = () => {
    if (results && Array.isArray(results)) {
      setSelectedUrls(new Set(results));
    }
  };

  const clearAllUrls = () => {
    setSelectedUrls(new Set());
  };

  const handleCrawl = async () => {
    if (!crawlUrl.trim()) return;
    
    setLoading(true);
    setResults(null);
    setSelectedUrls(new Set()); // Clear previous selections
    
    try {
      const response = await fetch(`${API_BASE_URL}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: crawlUrl }),
      });
      
      const data = await response.json();
      setResults(data);
    } catch (error) {
      setResults({ error: 'Failed to crawl URL: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async () => {
    const urls = scrapeUrls.split('\n').map(url => url.trim()).filter(url => url);
    if (urls.length === 0) return;
    
    setLoading(true);
    setResults(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls }),
      });
      
      const data = await response.json();
      setResults(data);
    } catch (error) {
      setResults({ error: 'Failed to scrape URLs: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeAndStore = async () => {
    const urls = storeUrls.split('\n').map(url => url.trim()).filter(url => url);
    if (urls.length === 0) return;
    
    setLoading(true);
    setResults(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/scrape-and-store`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls }),
      });
      
      const data = await response.json();
      setResults(data);
      fetchDbInfo(); // Refresh database info
    } catch (error) {
      setResults({ error: 'Failed to scrape and store URLs: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setResults(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/search-vector`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery, limit: 5 }),
      });
      
      const data = await response.json();
      setResults(data);
    } catch (error) {
      setResults({ error: 'Failed to search: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!chatQuery.trim()) return;
    
    setLoading(true);
    
    // Add user message to chat history
    const userMessage = { type: 'user', content: chatQuery, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMessage]);
    
    try {
      const response = await fetch(`${API_BASE_URL}/chatbot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: chatQuery, limit: 5 }),
      });
      
      const data = await response.json();
      
      // Add bot response to chat history
      const botMessage = { 
        type: 'bot', 
        content: data.response || data.error, 
        sources: data.sources || [],
        timestamp: new Date(),
        error: !!data.error
      };
      setChatHistory(prev => [...prev, botMessage]);
      
    } catch (error) {
      const errorMessage = { 
        type: 'bot', 
        content: 'Failed to get response: ' + error.message, 
        timestamp: new Date(),
        error: true
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setChatQuery('');
    }
  };

  const clearChat = () => {
    setChatHistory([]);
  };

  const renderUrlList = () => {
    if (!results || !Array.isArray(results)) return null;
    
    return (
      <div className="url-list-container">
        <div className="url-list-header">
          <h3>Found URLs ({results.length})</h3>
          <div className="url-actions">
            <button onClick={selectAllUrls} className="select-all-btn">
              Select All
            </button>
            <button onClick={clearAllUrls} className="clear-all-btn">
              Clear All
            </button>
            <span className="selected-count">
              {selectedUrls.size} selected
            </span>
          </div>
        </div>
        <div className="url-list">
          {results.map((url, index) => (
            <div key={index} className="url-item">
              <label className="url-checkbox">
                <input
                  type="checkbox"
                  checked={selectedUrls.has(url)}
                  onChange={() => handleUrlToggle(url)}
                />
                <span className="checkmark"></span>
              </label>
              <a href={url} target="_blank" rel="noopener noreferrer" className="url-link">
                {url}
              </a>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!results) return null;
    
    // If results is an array of URLs (from crawl), show the URL list
    if (Array.isArray(results)) {
      return renderUrlList();
    }
    
    // Otherwise show JSON results
    return (
      <div className="results-container">
        <h3>Results</h3>
        <pre className="results-content">
          {JSON.stringify(results, null, 2)}
        </pre>
      </div>
    );
  };

  const renderChatHistory = () => {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <h3>Chat History</h3>
          <button onClick={clearChat} className="clear-chat-btn">Clear Chat</button>
        </div>
        <div className="chat-messages">
          {chatHistory.length === 0 ? (
            <div className="no-messages">No messages yet. Start a conversation!</div>
          ) : (
            chatHistory.map((message, index) => (
              <div key={index} className={`message ${message.type} ${message.error ? 'error' : ''}`}>
                <div className="message-content">{message.content}</div>
                {message.sources && message.sources.length > 0 && (
                  <div className="message-sources">
                    <strong>Sources:</strong>
                    {message.sources.map((source, i) => (
                      <div key={i} className="source-item">
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          {source.url}
                        </a>
                        {source.distance && (
                          <span className="source-distance">
                            (similarity: {(1 - source.distance).toFixed(3)})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="message-timestamp">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Web Scraper & AI Chat</h1>
        {dbInfo && (
          <div className="db-info">
            <span>Database: {dbInfo.total_documents} documents</span>
          </div>
        )}
      </header>

      <nav className="tab-nav">
        <button 
          className={activeTab === 'crawl' ? 'active' : ''}
          onClick={() => setActiveTab('crawl')}
        >
          Crawl Links
        </button>
        <button 
          className={activeTab === 'scrape' ? 'active' : ''}
          onClick={() => setActiveTab('scrape')}
        >
          Scrape URLs
        </button>
        <button 
          className={activeTab === 'store' ? 'active' : ''}
          onClick={() => setActiveTab('store')}
        >
          Scrape & Store
        </button>
        <button 
          className={activeTab === 'search' ? 'active' : ''}
          onClick={() => setActiveTab('search')}
        >
          Search Vector
        </button>
        <button 
          className={activeTab === 'chat' ? 'active' : ''}
          onClick={() => setActiveTab('chat')}
        >
          AI Chat
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'crawl' && (
          <div className="tab-content">
            <h2>Crawl Website Links</h2>
            <div className="input-group">
              <input
                type="url"
                placeholder="Enter website URL to crawl for links"
                value={crawlUrl}
                onChange={(e) => setCrawlUrl(e.target.value)}
                className="url-input"
              />
              <button 
                onClick={handleCrawl} 
                disabled={loading}
                className="action-btn"
              >
                {loading ? 'Crawling...' : 'Crawl Links'}
              </button>
            </div>
            {renderResults()}
          </div>
        )}

        {activeTab === 'scrape' && (
          <div className="tab-content">
            <h2>Scrape URLs</h2>
            <div className="input-group">
              <textarea
                placeholder="Enter URLs (one per line) or select from crawled URLs"
                value={scrapeUrls}
                onChange={(e) => setScrapeUrls(e.target.value)}
                className="url-textarea"
                rows="5"
              />
              <button 
                onClick={handleScrape} 
                disabled={loading}
                className="action-btn"
              >
                {loading ? 'Scraping...' : 'Scrape URLs'}
              </button>
            </div>
            {selectedUrls.size > 0 && (
              <div className="selected-urls-info">
                <span>📌 {selectedUrls.size} URLs selected from crawl results</span>
              </div>
            )}
            {renderResults()}
          </div>
        )}

        {activeTab === 'store' && (
          <div className="tab-content">
            <h2>Scrape & Store in Vector Database</h2>
            <div className="input-group">
              <textarea
                placeholder="Enter URLs (one per line) or select from crawled URLs"
                value={storeUrls}
                onChange={(e) => setStoreUrls(e.target.value)}
                className="url-textarea"
                rows="5"
              />
              <button 
                onClick={handleScrapeAndStore} 
                disabled={loading}
                className="action-btn"
              >
                {loading ? 'Processing...' : 'Scrape & Store'}
              </button>
            </div>
            {selectedUrls.size > 0 && (
              <div className="selected-urls-info">
                <span>📌 {selectedUrls.size} URLs selected from crawl results</span>
              </div>
            )}
            {renderResults()}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="tab-content">
            <h2>Search Vector Database</h2>
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter search query"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button 
                onClick={handleSearch} 
                disabled={loading}
                className="action-btn"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
            {renderResults()}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="tab-content">
            <h2>AI Chat</h2>
            {renderChatHistory()}
            <div className="chat-input-group">
              <input
                type="text"
                placeholder="Ask a question about your scraped content..."
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !loading && handleChat()}
                className="chat-input"
              />
              <button 
                onClick={handleChat} 
                disabled={loading || !chatQuery.trim()}
                className="action-btn"
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
