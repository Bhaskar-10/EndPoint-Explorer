from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from firecrawl import FirecrawlApp, ScrapeOptions
import httpx
import os
from dotenv import load_dotenv
import json
import asyncio
from fastapi import Request
import chromadb
from chromadb.config import Settings
import hashlib
from datetime import datetime
import uuid
from typing import List, Dict, Any
import re

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Create directories for storing markdown files
MARKDOWN_DIR = "scraped_markdown"
os.makedirs(MARKDOWN_DIR, exist_ok=True)

# Initialize ChromaDB client
chroma_client = chromadb.PersistentClient(path="./chroma_db")

# Create or get collection
collection = chroma_client.get_or_create_collection(
    name="scraped_content",
    metadata={"hnsw:space": "cosine"}
)

class FirecrawlClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.firecrawl.dev/v1"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }


    async def scrape_url(self, url: str, formats: list = None):
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "url": url,
                "formats": formats or ["markdown"]
            }
            response = await client.post(
                f"{self.base_url}/scrape",
                json=payload,
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()


class ChatbotClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.groq.com/openai/v1"

    async def generate_response(self, user_query: str, context: str) -> str:
        """Generate a response using Groq API with the provided context"""
        prompt = f"""You are a helpful assistant that answers questions based on the provided context. 
        Use the context information to answer the user's question accurately. If the context doesn't contain 
        relevant information to answer the question, politely say so and suggest what information might be needed.
        
        Keep your responses clear, concise, and helpful. Always base your answers on the provided context. 
        But dont't tell about the context information to user. 
        Just provide the ansswer if you find it in database or else say no.

        Context information:
        {context}

        User question: {user_query}

        Please answer the question based on the context provided above."""

        async with httpx.AsyncClient(timeout=60.0) as client:
            payload = {
                "model": "llama3-70b-8192",  # Updated to correct Groq model name
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 1000,
                "top_p": 0.95
            }
            
            try:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    }
                )
                
                # Print response details for debugging
                print(f"Response status: {response.status_code}")
                if response.status_code != 200:
                    print(f"Response content: {response.text}")
                
                response.raise_for_status()
                result = response.json()
                
                # Extract the response text from Groq's response format
                if 'choices' in result and len(result['choices']) > 0:
                    choice = result['choices'][0]
                    if 'message' in choice and 'content' in choice['message']:
                        return choice['message']['content']
                
                return "I'm sorry, I couldn't generate a response. Please try again."
                
            except httpx.HTTPStatusError as e:
                print(f"HTTP error occurred: {e}")
                print(f"Response content: {e.response.text}")
                return f"API request failed: {e.response.status_code}"
            except Exception as e:
                print(f"Error occurred: {e}")
                return f"Request failed: {str(e)}"


@app.post("/crawl")
async def crawl_url(request: Request):
    """Crawl a URL and return the scraped data."""
    body = await request.json()
    url = body.get("url")
    if not url:
        return {"error": "URL not provided"}

    async_firecrawl_app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)
    response = async_firecrawl_app.crawl_url(
        url=url,
        limit=5,
        scrape_options=ScrapeOptions(
            formats= [ 'links' ]
        )
    )
    if hasattr(response, 'data') and response.data:
        if isinstance(response.data, list) and len(response.data) > 0:
            first_item = response.data[0]
            return first_item.links
    return {"error": "No data found"}
        


@app.post("/scrape")
async def scrape_urls(request: Request):
    """Scrape multiple URLs and return the scraped data."""
    body = await request.json()
    urls = body.get("urls")
    if not urls or not isinstance(urls, list):
        return {"error": "A list of URLs must be provided in the 'urls' field."}

    firecrawl_client = FirecrawlClient(api_key=FIRECRAWL_API_KEY)

    async def scrape_single_url(url):
        try:
            response = await firecrawl_client.scrape_url(
                url=url,
                formats=["markdown"]
            )
            return {
                "url": url, 
                "markdown": response.get("data", {}).get("markdown")
            }
        except Exception as e:
            return {"url": url, "error": str(e)}

    results = await asyncio.gather(*(scrape_single_url(url) for url in urls))
    return {"results": results}

def create_filename_from_url(url: str) -> str:
    """Create a safe filename from URL"""
    # Remove protocol and replace special characters
    filename = re.sub(r'https?://', '', url)
    filename = re.sub(r'[^\w\-_\.]', '_', filename)
    filename = filename.strip('_')
    # Add timestamp to make it unique
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{filename}_{timestamp}.md"

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Split text into overlapping chunks"""
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end > len(text):
            end = len(text)
        
        chunk = text[start:end]
        chunks.append(chunk)
        
        if end == len(text):
            break
            
        start = end - overlap
    
    return chunks

@app.post("/scrape-and-store")
async def scrape_and_store(request: Request):
    """Scrape URLs, save to markdown files, and store in ChromaDB vector database"""
    body = await request.json()
    urls = body.get("urls")
    if not urls or not isinstance(urls, list):
        return {"error": "A list of URLs must be provided in the 'urls' field."}

    firecrawl_client = FirecrawlClient(api_key=FIRECRAWL_API_KEY)
    processed_results = []

    async def process_single_url(url):
        try:
            # Scrape the URL
            response = await firecrawl_client.scrape_url(
                url=url,
                formats=["markdown"]
            )
            
            markdown_content = response.get("data", {}).get("markdown")
            if not markdown_content:
                return {"url": url, "error": "No markdown content found"}
            
            # Create filename and save to markdown file
            filename = create_filename_from_url(url)
            filepath = os.path.join(MARKDOWN_DIR, filename)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f"# Scraped from: {url}\n")
                f.write(f"# Scraped at: {datetime.now().isoformat()}\n\n")
                f.write(markdown_content)
            
            # Chunk the content for better vector storage
            chunks = chunk_text(markdown_content)
            
            # Store in ChromaDB
            chunk_ids = []
            for i, chunk in enumerate(chunks):
                chunk_id = f"{hashlib.md5(url.encode()).hexdigest()}_{i}"
                chunk_ids.append(chunk_id)
                
                # Add to ChromaDB collection
                collection.add(
                    documents=[chunk],
                    ids=[chunk_id],
                    metadatas=[{
                        "url": url,
                        "filename": filename,
                        "chunk_index": i,
                        "total_chunks": len(chunks),
                        "scraped_at": datetime.now().isoformat()
                    }]
                )
            
            return {
                "url": url,
                "status": "success",
                "markdown_file": filepath,
            }
            
        except Exception as e:
            return {"url": url, "error": str(e)}

    results = await asyncio.gather(*(process_single_url(url) for url in urls))
    
    # Summary statistics
    successful = [r for r in results if r.get("status") == "success"]
    failed = [r for r in results if r.get("error")]
    
    return {
        "results": results,
        "summary": {
            "total_urls": len(urls),
            "successful": len(successful),
            "failed": len(failed),
            "total_chunks_stored": sum(r.get("chunks_stored", 0) for r in successful)
        }
    }

@app.post("/search-vector")
async def search_vector(request: Request):
    """Search in the vector database"""
    body = await request.json()
    query = body.get("query")
    limit = body.get("limit", 5)
    
    if not query:
        return {"error": "Query text must be provided"}
    
    try:
        # Search in ChromaDB
        results = collection.query(
            query_texts=[query],
            n_results=limit
        )
        
        # Format results
        formatted_results = []
        if results['documents'] and results['documents'][0]:
            for i, doc in enumerate(results['documents'][0]):
                formatted_results.append({
                    "id": results['ids'][0][i],
                    "content": doc,
                    "metadata": results['metadatas'][0][i],
                    "distance": results['distances'][0][i] if results.get('distances') else None
                })
        
        return {
            "query": query,
            "results": formatted_results,
            "total_found": len(formatted_results)
        }
        
    except Exception as e:
        return {"error": f"Search failed: {str(e)}"}


@app.post("/chatbot")
async def chatbot(request: Request):
    """Chatbot endpoint that uses vector database to answer user queries"""
    body = await request.json()
    user_query = body.get("query")
    limit = body.get("limit", 5)  # Number of relevant chunks to retrieve
    
    if not user_query:
        return {"error": "Query text must be provided"}
    
    if not GROQ_API_KEY:
        return {"error": "Groq API key not configured"}
    
    try:
        # Search for relevant content in ChromaDB
        search_results = collection.query(
            query_texts=[user_query],
            n_results=limit
        )
        
        # Build context from search results
        context = ""
        sources = []
        
        if search_results['documents'] and search_results['documents'][0]:
            for i, doc in enumerate(search_results['documents'][0]):
                context += f"Source {i+1}:\n{doc}\n\n"
                
                # Collect source information
                metadata = search_results['metadatas'][0][i]
                source_info = {
                    "url": metadata.get("url"),
                    "chunk_index": metadata.get("chunk_index"),
                    "distance": search_results['distances'][0][i] if search_results.get('distances') else None
                }
                sources.append(source_info)
        
        if not context.strip():
            return {
                "query": user_query,
                "response": "I don't have any relevant information in my database to answer your question. Please try scraping some relevant content first using the /scrape-and-store endpoint.",
                "sources": [],
                "context_used": False
            }
        
        # Generate response using Groq
        chatbot_client = ChatbotClient(api_key=GROQ_API_KEY)
        ai_response = await chatbot_client.generate_response(user_query, context)
        
        return {
            "query": user_query,
            "response": ai_response,
            "sources": sources,
            "context_used": True,
            "num_sources": len(sources)
        }
        
    except Exception as e:
        return {"error": f"Chatbot failed: {str(e)}"}

# Optional: Add a simple endpoint to check database contents
@app.get("/database-info")
async def get_database_info():
    """Get information about the vector database"""
    try:
        # Get collection count
        collection_count = collection.count()
        
        return {
            "collection_name": "scraped_content",
            "total_documents": collection_count,
            "database_path": "./chroma_db"
        }
    except Exception as e:
        return {"error": f"Failed to get database info: {str(e)}"}
