"""Resume Upload and AI Tailoring API"""
import httpx
import io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db

router = APIRouter(prefix="/api/resume", tags=["resume"])

# Ollama configuration (same as sully.py)
OLLAMA_URL = "http://192.168.0.105:11434"
OLLAMA_MODEL = "dolphin-mistral:7b"


class TailorRequest(BaseModel):
    resume_text: str
    job_id: str


class TailorResponse(BaseModel):
    original: str
    tailored: str
    suggestions: list[str]
    keywords_added: list[str]


class UploadResponse(BaseModel):
    success: bool
    text: str
    word_count: int
    message: str


def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """Extract text from uploaded file (PDF, DOCX, or TXT)"""

    filename_lower = filename.lower()

    if filename_lower.endswith('.txt'):
        # Plain text
        return file_content.decode('utf-8', errors='ignore')

    elif filename_lower.endswith('.pdf'):
        # Try PyPDF2 for PDF extraction
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(file_content))
            text_parts = []
            for page in reader.pages:
                text_parts.append(page.extract_text() or '')
            return '\n'.join(text_parts)
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="PDF parsing not available. Please upload a TXT or DOCX file."
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Could not parse PDF: {str(e)}"
            )

    elif filename_lower.endswith('.docx'):
        # Try python-docx for DOCX extraction
        try:
            from docx import Document
            doc = Document(io.BytesIO(file_content))
            text_parts = []
            for paragraph in doc.paragraphs:
                text_parts.append(paragraph.text)
            return '\n'.join(text_parts)
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="DOCX parsing not available. Please upload a TXT or PDF file."
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Could not parse DOCX: {str(e)}"
            )

    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload PDF, DOCX, or TXT."
        )


@router.post("/upload", response_model=UploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
):
    """Upload and parse a resume file"""

    # Check file size (max 5MB)
    file_content = await file.read()
    if len(file_content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")

    # Extract text
    text = extract_text_from_file(file_content, file.filename)

    # Clean up the text
    text = ' '.join(text.split())  # Normalize whitespace

    if len(text) < 50:
        raise HTTPException(
            status_code=400,
            detail="Could not extract enough text from the file. Please try a different format."
        )

    word_count = len(text.split())

    return UploadResponse(
        success=True,
        text=text,
        word_count=word_count,
        message=f"Successfully extracted {word_count} words from your resume."
    )


@router.post("/tailor", response_model=TailorResponse)
async def tailor_resume(
    request: TailorRequest,
    db: Session = Depends(get_db)
):
    """AI-tailor a resume to a specific job posting using Ollama"""

    # Get the job details
    job = db.execute(
        text("""
            SELECT j.id, j.title, j.description, j.requirements, j.specialty,
                   j.nursing_type, j.employment_type, j.shift_type,
                   f.name as facility_name, f.health_system
            FROM jobs j
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE j.id = :job_id
        """),
        {"job_id": request.job_id}
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Build the job context
    job_context = f"""
JOB TITLE: {job.title}
FACILITY: {job.facility_name or 'Unknown'} ({job.health_system or 'Unknown System'})
NURSING TYPE: {job.nursing_type or 'Not specified'}
SPECIALTY: {job.specialty or 'Not specified'}
EMPLOYMENT: {job.employment_type or 'Not specified'}
SHIFT: {job.shift_type or 'Not specified'}

JOB DESCRIPTION:
{job.description or 'No description available'}

REQUIREMENTS:
{job.requirements or 'No specific requirements listed'}
"""

    # Build the AI prompt for tailoring
    system_prompt = """You are an expert nursing resume consultant. Your job is to tailor resumes to specific job postings.

IMPORTANT RULES:
1. Keep all factual information accurate - don't fabricate experience
2. Reorder and emphasize relevant skills and experience
3. Add keywords from the job description where appropriate
4. Improve bullet points to highlight transferable skills
5. Keep the same general structure but optimize for ATS systems
6. Be concise - this should fit on 1-2 pages

Output format:
1. First, provide the tailored resume text
2. Then list 3-5 specific suggestions as bullet points
3. Finally, list the keywords you added or emphasized"""

    user_prompt = f"""Please tailor this resume for the following job:

{job_context}

CURRENT RESUME:
{request.resume_text}

Please provide:
1. A tailored version of the resume
2. Specific suggestions for improvement
3. Keywords added/emphasized from the job posting"""

    # Call Ollama
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": user_prompt,
                    "system": system_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,  # Lower temp for more consistent output
                        "top_p": 0.9,
                        "num_predict": 2000  # Allow longer response
                    }
                }
            )
            response.raise_for_status()
            data = response.json()
            ai_response = data.get("response", "")

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="AI processing took too long. Please try again with a shorter resume."
        )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=503,
            detail="AI service is currently unavailable. Please try again later."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing request: {str(e)}"
        )

    # Parse the AI response into sections
    # This is a simple parser - the AI should generally follow the format
    tailored_text = ai_response
    suggestions = []
    keywords = []

    # Try to extract suggestions and keywords
    lines = ai_response.split('\n')
    in_suggestions = False
    in_keywords = False
    tailored_parts = []

    for line in lines:
        line_lower = line.lower()
        if 'suggestion' in line_lower or 'improvement' in line_lower:
            in_suggestions = True
            in_keywords = False
            continue
        elif 'keyword' in line_lower and ('added' in line_lower or 'emphasized' in line_lower):
            in_suggestions = False
            in_keywords = True
            continue
        elif in_suggestions and line.strip().startswith(('-', '*', '•')):
            suggestions.append(line.strip().lstrip('-*• '))
        elif in_keywords and line.strip():
            # Keywords might be comma-separated or bullet points
            if ',' in line:
                keywords.extend([k.strip() for k in line.split(',') if k.strip()])
            elif line.strip().startswith(('-', '*', '•')):
                keywords.append(line.strip().lstrip('-*• '))
        elif not in_suggestions and not in_keywords:
            tailored_parts.append(line)

    # If we found sections, use them; otherwise use the full response
    if tailored_parts:
        tailored_text = '\n'.join(tailored_parts).strip()

    # Ensure we have at least some suggestions
    if not suggestions:
        suggestions = [
            "Consider adding more specific metrics and achievements",
            "Ensure your certifications are prominently displayed",
            "Highlight experience matching the job requirements"
        ]

    # Ensure we have at least some keywords
    if not keywords:
        keywords = [kw for kw in [job.specialty, job.nursing_type, "patient care", "clinical"] if kw]

    return TailorResponse(
        original=request.resume_text,
        tailored=tailored_text,
        suggestions=suggestions[:5],
        keywords_added=keywords[:10]
    )


@router.get("/jobs/recent")
async def get_recent_jobs(
    db: Session = Depends(get_db),
    limit: int = 20
):
    """Get recent jobs for the job selection dropdown"""

    jobs = db.execute(
        text("""
            SELECT j.id, j.title, j.specialty, j.nursing_type,
                   f.name as facility_name, f.city
            FROM jobs j
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE j.is_active = true
            ORDER BY j.posted_at DESC NULLS LAST
            LIMIT :limit
        """),
        {"limit": limit}
    ).fetchall()

    return {
        "jobs": [
            {
                "id": j.id,
                "title": j.title,
                "specialty": j.specialty,
                "nursing_type": j.nursing_type,
                "facility_name": j.facility_name,
                "city": j.city,
                "display": f"{j.title} at {j.facility_name or 'Unknown'} ({j.city or 'VA'})"
            }
            for j in jobs
        ]
    }
