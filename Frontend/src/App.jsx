import React, { useState } from 'react';
import './App.css';
import { Search, ExternalLink, CheckSquare, Square, Loader, AlertCircle, FileText } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000'; // Adjust this to your backend URL

export default function URLCrawler() {
  const [url, setUrl] = useState('');
  const [crawlResults, setCrawlResults] = useState([]);
  const [selectedUrls, setSelectedUrls] = useState(new Set());
  const [scrapeResults, setScrapeResults] = useState([]);
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCrawl = async () => {
    if (!url.trim()) {
      setError('Please enter a URL to crawl');
      return;
    }

    setCrawlLoading(true);
    setError('');
    setCrawlResults([]);
    setSelectedUrls(new Set());
    setScrapeResults([]);

    try {
      const response = await fetch(`${API_BASE_URL}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else if (Array.isArray(data)) {
        setCrawlResults(data);
      } else {
        setError('Unexpected response format');
      }
    } catch (err) {
      setError('Failed to crawl URL. Please check if the backend is running.');
    } finally {
      setCrawlLoading(false);
    }
  };

  const handleUrlSelection = (urlToToggle) => {
    const newSelected = new Set(selectedUrls);
    if (newSelected.has(urlToToggle)) {
      newSelected.delete(urlToToggle);
    } else {
      newSelected.add(urlToToggle);
    }
    setSelectedUrls(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUrls.size === crawlResults.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(crawlResults));
    }
  };

  const handleScrape = async () => {
    if (selectedUrls.size === 0) {
      setError('Please select at least one URL to scrape');
      return;
    }

    setScrapeLoading(true);
    setError('');
    setScrapeResults([]);

    try {
      const response = await fetch(`${API_BASE_URL}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls: Array.from(selectedUrls) }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else if (data.results) {
        setScrapeResults(data.results);
      } else {
        setError('Unexpected response format');
      }
    } catch (err) {
      setError('Failed to scrape URLs. Please check if the backend is running.');
    } finally {
      setScrapeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">URL Explorer</h1>
          <p className="text-gray-600">Crawl websites to discover links, then scrape content from selected pages</p>
        </div>

        {/* URL Input Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <Search className="mr-2" size={20} />
            Enter URL to Crawl
          </h2>

          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleCrawl()}
            />
            <button
              onClick={handleCrawl}
              disabled={crawlLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {crawlLoading ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
              {crawlLoading ? 'Crawling...' : 'Crawl'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center">
            <AlertCircle className="text-red-500 mr-2" size={20} />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Crawl Results Section */}
        {crawlResults.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <ExternalLink className="mr-2" size={20} />
                Found Links ({crawlResults.length})
              </h2>
              <button
                onClick={handleSelectAll}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {selectedUrls.size === crawlResults.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
              {crawlResults.map((link, index) => (
                <div
                  key={index}
                  className="flex items-center p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleUrlSelection(link)}
                >
                  {selectedUrls.has(link) ? (
                    <CheckSquare className="text-blue-600 mr-3 flex-shrink-0" size={18} />
                  ) : (
                    <Square className="text-gray-400 mr-3 flex-shrink-0" size={18} />
                  )}
                  <span className="text-sm text-gray-700 break-all">{link}</span>
                </div>
              ))}
            </div>

            {selectedUrls.size > 0 && (
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {selectedUrls.size} URL{selectedUrls.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={handleScrape}
                  disabled={scrapeLoading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {scrapeLoading ? <Loader className="animate-spin" size={16} /> : <FileText size={16} />}
                  {scrapeLoading ? 'Scraping...' : 'Scrape Selected'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scrape Results Section */}
        {scrapeResults.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <FileText className="mr-2" size={20} />
              Scraped Content
            </h2>

            <div className="space-y-6">
              {scrapeResults.map((result, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-800 break-all">{result.url}</h3>
                    {result.error && (
                      <span className="text-red-500 text-sm flex items-center">
                        <AlertCircle size={14} className="mr-1" />
                        Error
                      </span>
                    )}
                  </div>

                  {result.error ? (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <p className="text-red-700 text-sm">{result.error}</p>
                    </div>
                  ) : result.markdown ? (
                    <div className="bg-gray-50 border border-gray-200 rounded p-4 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                        {result.markdown}
                      </pre>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p className="text-yellow-700 text-sm">No content available</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}