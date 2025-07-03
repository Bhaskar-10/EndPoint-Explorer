from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import requests, os
from dotenv import load_dotenv
from firecrawl import FirecrawlApp, ScrapeOptions
import json
import asyncio
from firecrawl import AsyncFirecrawlApp
from firecrawl import ScrapeOptions
from fastapi import Request


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

@app.post("/crawl")
async def crawl_url(request: Request):
    """Crawl a URL and return the scraped data."""
    body = await request.json()
    url = body.get("url")
    if not url:
        return {"error": "URL not provided"}

    async_firecrawl_app = AsyncFirecrawlApp(api_key=FIRECRAWL_API_KEY)
    response = await async_firecrawl_app.crawl_url(
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

    async_firecrawl_app = AsyncFirecrawlApp(api_key=FIRECRAWL_API_KEY)

    async def scrape_single_url(url):
        try:
            response = await async_firecrawl_app.scrape_url(
                url=url,
                formats=['markdown']
            )
            return {"url": url, "markdown": getattr(response, "markdown", None)}
        except Exception as e:
            return {"url": url, "error": str(e)}

    results = await asyncio.gather(*(scrape_single_url(url) for url in urls))
    return {"results": results}
