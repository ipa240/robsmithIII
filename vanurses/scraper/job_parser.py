"""
VANurses.com - Job Description Parser

Extracts structured sections from job posting HTML using:
1. Ollama (primary) - AI-based extraction
2. Regex (fallback) - Pattern-based extraction
3. Raw (last resort) - Clean HTML text
"""

import re
import json
import requests
from typing import Dict, Optional, Any
from datetime import datetime
from bs4 import BeautifulSoup

# Ollama configuration
OLLAMA_HOST = "http://192.168.0.105:11434"
OLLAMA_MODEL = "dolphin-mistral:7b"
OLLAMA_TIMEOUT = 60  # seconds


def clean_html_to_text(html: str) -> str:
    """Convert HTML to clean text while preserving structure."""
    soup = BeautifulSoup(html, 'html.parser')

    # Remove script and style elements
    for element in soup(['script', 'style']):
        element.decompose()

    # Get text with newlines for block elements
    text = soup.get_text('\n', strip=True)

    # Clean up excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)

    return text.strip()


def extract_with_ollama(text: str) -> Optional[Dict[str, Any]]:
    """Extract job sections using Ollama LLM."""
    # Truncate text if too long (keep first 5000 chars for more context)
    text = text[:5000] if len(text) > 5000 else text

    prompt = f"""You are extracting structured data from a nursing job posting. Be thorough and extract ALL relevant details.

Return a JSON object with these fields:

{{
  "summary": "ALWAYS write a 2-3 sentence overview based on the job title, department, and any key details. Example: 'Join our ICU team caring for critically ill patients. This full-time night position offers competitive benefits and growth opportunities.' Even if brief info, write SOMETHING useful.",
  "education": "ALL mentioned degrees: required and preferred. Examples: 'BSN required', 'ADN with BSN in progress accepted', 'MSN preferred'",
  "experience": "Years required, type of experience, and any preferred experience. Examples: '1+ years acute care required', '2 years ICU preferred', 'New grads welcome'",
  "certifications": "ALL licenses and certifications mentioned - both required and preferred. Examples: 'Active VA RN license required', 'BLS required', 'ACLS preferred', 'CCRN a plus'",
  "benefits": "List ALL benefits mentioned: insurance, PTO, retirement, tuition, childcare, parking, etc. Be comprehensive.",
  "schedule": "Shift details: Day/Night/Rotating, hours (7a-7p, 7p-7a), pattern (3x12, 4x10), weekend requirements, holiday rotation, on-call requirements",
  "sign_on_bonus": null or integer dollar amount (e.g., 10000 for $10,000 bonus)
}}

IMPORTANT RULES:
- For summary: ALWAYS generate something based on title and any context. Never return null for summary.
- For other fields: use null only if truly not mentioned
- Include exact numbers when mentioned (years, dollar amounts)
- For benefits, list each one even if briefly mentioned

Job posting to analyze:
{text}

Return ONLY the JSON object, nothing else:"""

    try:
        response = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            },
            timeout=OLLAMA_TIMEOUT
        )
        response.raise_for_status()

        result = response.json()
        parsed = json.loads(result.get('response', '{}'))

        # Validate we got at least some data
        if parsed and any(v for v in parsed.values() if v):
            return parsed
        return None

    except (requests.RequestException, json.JSONDecodeError) as e:
        print(f"Ollama extraction failed: {e}")
        return None


def extract_with_regex(text: str) -> Dict[str, Any]:
    """Extract job sections using regex patterns (fallback)."""
    result = {
        'summary': None,
        'education': None,
        'experience': None,
        'certifications': None,
        'benefits': None,
        'schedule': None,
        'sign_on_bonus': None,
    }

    # Sign-on bonus patterns
    bonus_patterns = [
        r'\$\s*([\d,]+(?:\.\d{2})?)\s*(?:sign[- ]?on|signing)\s*bonus',
        r'(?:sign[- ]?on|signing)\s*bonus[^$]*\$\s*([\d,]+)',
        r'\$\s*([\d,]+)\s*bonus',
    ]
    for pattern in bonus_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                result['sign_on_bonus'] = int(match.group(1).replace(',', '').split('.')[0])
                break
            except ValueError:
                pass

    # Education patterns
    edu_patterns = [
        r'(?:Education|Degree)[:\s]*([^\n]+(?:\n[^\n]+){0,3})',
        r'(?:BSN|MSN|ADN|Bachelor|Master)[^\n]*(?:required|preferred)',
    ]
    for pattern in edu_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result['education'] = match.group(0).strip()[:500]
            break

    # Experience patterns
    exp_patterns = [
        r'Experience[:\s]*([^\n]+(?:\n[^\n]+){0,3})',
        r'(\d+\+?\s*(?:years?|yrs?)[^\n]*experience[^\n]*)',
        r'((?:minimum|at least|required)[^\n]*\d+\s*(?:years?|yrs?)[^\n]*)',
    ]
    for pattern in exp_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result['experience'] = match.group(0).strip()[:500]
            break

    # Certification patterns
    cert_patterns = [
        r'(?:Certification|Licensure|License)[:\s]*([^\n]+(?:\n[^\n]+){0,5})',
        r'((?:BLS|ACLS|PALS|NRP|RN\s*license)[^\n]*)',
    ]
    for pattern in cert_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result['certifications'] = match.group(0).strip()[:500]
            break

    # Schedule/Shift patterns
    schedule_patterns = [
        r'(?:Shift|Schedule)[:\s]*([^\n]+)',
        r'((?:Day|Night|Evening|Rotating)[^\n]*shift[^\n]*)',
        r'((?:3x12|4x10|5x8|12[- ]?hour|8[- ]?hour)[^\n]*)',
    ]
    for pattern in schedule_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result['schedule'] = match.group(0).strip()[:300]
            break

    # Benefits patterns
    benefits_patterns = [
        r'Benefits[:\s]*([^\n]+(?:\n[•\-\*][^\n]+){0,10})',
        r'((?:Medical|Dental|Vision|401k|PTO)[^\n]*(?:\n[•\-\*][^\n]+){0,5})',
    ]
    for pattern in benefits_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result['benefits'] = match.group(0).strip()[:1000]
            break

    # Summary - first substantial paragraph
    paragraphs = text.split('\n\n')
    for para in paragraphs:
        para = para.strip()
        if len(para) > 100 and not any(kw in para.lower() for kw in ['education', 'experience', 'certification', 'benefit']):
            result['summary'] = para[:500]
            break

    return result


def parse_job_description(html: str, use_ollama: bool = True) -> Dict[str, Any]:
    """
    Parse job description HTML into structured sections.

    Args:
        html: Raw HTML from job posting
        use_ollama: Whether to try Ollama first (default True)

    Returns:
        Dict with parsed sections and metadata
    """
    # Clean HTML to text
    text = clean_html_to_text(html)

    parsed = None
    extraction_method = 'raw'

    # Try Ollama first
    if use_ollama:
        parsed = extract_with_ollama(text)
        if parsed:
            extraction_method = 'ollama'

    # Fallback to regex
    if not parsed:
        parsed = extract_with_regex(text)
        if any(v for v in parsed.values() if v):
            extraction_method = 'regex'

    # Return result with metadata
    return {
        'parsed': parsed or {},
        'raw_text': text[:5000],  # Store truncated raw text as fallback
        'extraction_method': extraction_method,
        'fetched_at': datetime.utcnow().isoformat(),
    }


def detect_platform(url: str) -> str:
    """Detect the job platform from URL."""
    if 'myworkdayjobs.com' in url:
        return 'workday'
    elif 'icims.com' in url:
        return 'icims'
    elif 'oraclecloud.com' in url:
        return 'oracle'
    elif 'ultipro' in url:
        return 'ultipro'
    elif 'usajobs.gov' in url or 'jobs.virginia.gov' in url:
        return 'government'
    elif 'amnhealthcare.com' in url or 'ayahealthcare.com' in url:
        return 'travel_agency'
    else:
        return 'custom'


def fetch_workday_job_details(job_url: str) -> Optional[Dict]:
    """
    Fetch full job details from Workday API.

    Workday URL formats:
    1. Standard: https://tenant.wd1.myworkdayjobs.com/SITE/job/Location/Title_ID
    2. External: https://tenant.wd1.myworkdayjobs.com/en-US/SITE/job/Location/Title_ID
    3. With details: https://tenant.wd1.myworkdayjobs.com/SITE/job/Location/Title_ID/details

    API format: https://tenant.wd1.myworkdayjobs.com/wday/cxs/tenant/SITE/job/Location/Title_ID
    """
    if 'myworkdayjobs.com' not in job_url:
        return None

    try:
        import urllib.parse
        parsed = urllib.parse.urlparse(job_url)
        host = parsed.netloc  # e.g., sentara.wd1.myworkdayjobs.com

        # Extract tenant from subdomain
        tenant = host.split('.')[0]  # e.g., sentara

        # Clean and parse path
        path = parsed.path.strip('/')
        path_parts = [p for p in path.split('/') if p]  # Remove empty parts

        if len(path_parts) < 2:
            print(f"Workday URL too short: {job_url}")
            return None

        # Skip language prefixes like 'en-US', 'es-ES', etc.
        if len(path_parts[0]) <= 5 and '-' in path_parts[0]:
            path_parts = path_parts[1:]

        if len(path_parts) < 2:
            print(f"Workday URL missing site after language: {job_url}")
            return None

        # Extract site (first part) and job path (rest)
        site = path_parts[0]  # e.g., SCS, External, en-US/External

        # Find the 'job' segment and build path from there
        job_index = -1
        for i, part in enumerate(path_parts):
            if part.lower() == 'job':
                job_index = i
                break

        if job_index == -1:
            # No 'job' segment - might be a different URL format
            job_path = '/'.join(path_parts[1:])
        else:
            # Include 'job' and everything after
            job_path = '/'.join(path_parts[job_index:])

        # Remove trailing '/details' if present
        if job_path.endswith('/details'):
            job_path = job_path[:-8]

        # Build API URL
        api_url = f"https://{host}/wday/cxs/{tenant}/{site}/{job_path}"

        print(f"Workday API URL: {api_url}")

        response = requests.get(
            api_url,
            headers={
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout=30
        )

        # Check for redirects to invalid-url or error pages
        if 'invalid-url' in response.url or response.status_code == 404:
            print(f"Workday job expired or invalid: {job_url}")
            return {'error': 'expired', 'message': 'Job posting no longer available'}

        response.raise_for_status()

        data = response.json()
        job_info = data.get('jobPostingInfo', {})

        # Check if the response indicates job is filled/expired
        if not job_info or not job_info.get('jobDescription'):
            # Try to detect "job filled" message in the response
            error_text = str(data)
            if 'filled' in error_text.lower() or 'no longer' in error_text.lower():
                return {'error': 'expired', 'message': 'Job has been filled'}

        return job_info

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print(f"Workday job not found (404): {job_url}")
            return {'error': 'expired', 'message': 'Job posting not found'}
        print(f"Workday HTTP error: {e}")
        return None
    except Exception as e:
        print(f"Error fetching Workday details: {e}")
        return None


def enrich_job(job_url: str, existing_description: str = None, use_ollama: bool = True) -> Dict[str, Any]:
    """
    Fetch and parse job details from any platform.

    Args:
        job_url: URL to the job posting
        existing_description: Fallback description from database if fetch fails
        use_ollama: Whether to use Ollama for extraction

    Returns:
        Dict with parsed data and metadata
    """
    platform = detect_platform(job_url)

    html = None
    api_data = {}
    is_expired = False

    # Try platform-specific fetching
    if platform == 'workday':
        details = fetch_workday_job_details(job_url)
        if details:
            # Check if job is expired
            if details.get('error') == 'expired':
                is_expired = True
                api_data['expired_message'] = details.get('message', 'Job no longer available')
            else:
                html = details.get('jobDescription', '')
                api_data = {
                    'time_type': details.get('timeType'),
                    'start_date': details.get('startDate'),
                    'remote_type': details.get('remoteType'),
                    'location': details.get('location'),
                }

    # Generic HTML fetch for other platforms
    if not html and not is_expired:
        try:
            response = requests.get(
                job_url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout=30
            )

            # HTTP 410 Gone means job is expired/removed
            if response.status_code == 410:
                is_expired = True
                api_data['expired_message'] = 'Job posting has been removed (HTTP 410)'
            elif response.status_code == 404:
                is_expired = True
                api_data['expired_message'] = 'Job posting not found (HTTP 404)'
            else:
                response.raise_for_status()
                html = response.text

                # Check for expired job indicators in HTML
                # BUT first check for Phenom/UVA-style sites that embed job status in JSON
                # These sites always have "has been filled" text as a template, check JSON status instead
                html_lower = html.lower()

                # Check for Phenom platform embedded job status (UVA uses this)
                if 'phapp.ddo' in html_lower and 'jobdetail' in html_lower:
                    # Try to extract job status from embedded JSON
                    import re
                    status_match = re.search(r'"jobDetail":\s*\{"status":\s*(\d+)', html)
                    if status_match:
                        job_status = int(status_match.group(1))
                        if job_status == 200:
                            # Job is available, don't mark as expired even if template text exists
                            pass  # Job is valid
                        elif job_status in (404, 410, 204):
                            is_expired = True
                            api_data['expired_message'] = f'Job no longer available (status {job_status})'
                    # If we found Phenom platform, skip the text-based expired checks
                else:
                    # Regular sites - check for expired indicators in text
                    expired_indicators = [
                        'job you are trying to apply for has been filled',
                        'position is no longer available',
                        'this job has expired',
                        'job has been removed',
                        'no longer accepting applications',
                    ]
                    for indicator in expired_indicators:
                        if indicator in html_lower:
                            is_expired = True
                            api_data['expired_message'] = 'Job posting is no longer available'
                            break

        except requests.exceptions.HTTPError as e:
            if hasattr(e, 'response') and e.response is not None:
                if e.response.status_code in (404, 410):
                    is_expired = True
                    api_data['expired_message'] = f'Job expired (HTTP {e.response.status_code})'
                else:
                    print(f"Error fetching job page: {e}")
            else:
                print(f"Error fetching job page: {e}")
            # Try fallback to existing description
            if existing_description:
                print(f"Using existing description as fallback")
                html = existing_description
            else:
                return {
                    'parsed': {},
                    'raw_text': '',
                    'extraction_method': 'failed',
                    'error': str(e),
                    'fetched_at': datetime.utcnow().isoformat(),
                    'platform': platform,
                    'is_expired': False,
                }

    # If expired, return minimal info without AI processing
    if is_expired:
        return {
            'parsed': {},
            'raw_text': '',
            'extraction_method': 'expired',
            'is_expired': True,
            'expired_message': api_data.get('expired_message', 'Job no longer available'),
            'fetched_at': datetime.utcnow().isoformat(),
            'platform': platform,
            'api_data': api_data,
        }

    # Fallback to existing description if no HTML fetched
    if not html and existing_description:
        print(f"Using existing description for enrichment")
        html = existing_description

    if not html:
        return {
            'parsed': {},
            'raw_text': '',
            'extraction_method': 'no_content',
            'fetched_at': datetime.utcnow().isoformat(),
            'platform': platform,
            'is_expired': False,
        }

    # Parse the HTML
    result = parse_job_description(html, use_ollama=use_ollama)
    result['platform'] = platform
    result['api_data'] = api_data
    result['is_expired'] = False

    return result


if __name__ == '__main__':
    # Test with a sample Workday job
    import sys

    test_url = sys.argv[1] if len(sys.argv) > 1 else \
        "https://sentara.wd1.myworkdayjobs.com/SCS/job/Charlottesville-VA/Registered-Nurse--RN--Nursery-Postpartum_JR-89779"

    print(f"Testing job parser with: {test_url}")
    print("=" * 60)

    result = enrich_job(test_url)

    print(f"Platform: {result.get('platform')}")
    print(f"Extraction Method: {result.get('extraction_method')}")
    print(f"Fetched At: {result.get('fetched_at')}")
    print()

    parsed = result.get('parsed', {})
    for key, value in parsed.items():
        if value:
            print(f"{key.upper()}:")
            if isinstance(value, (dict, list)):
                print(f"  {json.dumps(value, indent=2)}")
            else:
                print(f"  {value[:200]}..." if len(str(value)) > 200 else f"  {value}")
            print()
