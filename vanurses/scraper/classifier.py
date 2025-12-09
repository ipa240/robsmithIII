"""
VANurses.com - Nursing Job Classifier
Determines if a job is nursing-related and classifies by type/specialty
"""

import re
from typing import Optional, Dict, Tuple

# Nursing job patterns (INCLUDE)
NURSING_PATTERNS = [
    # Registered Nurses
    (r'\bRN\b', 'rn'),
    (r'\bR\.N\b', 'rn'),
    (r'Registered Nurse', 'rn'),
    (r'Staff Nurse', 'rn'),
    (r'Charge Nurse', 'rn'),
    (r'Clinical Nurse', 'rn'),
    (r'Nurse Manager', 'rn'),
    (r'Nurse Educator', 'rn'),
    (r'Nurse Navigator', 'rn'),
    (r'Nurse Coordinator', 'rn'),
    (r'Float Pool.*Nurse', 'rn'),
    (r'Resource Nurse', 'rn'),
    (r'Relief Nurse', 'rn'),

    # Nurse Practitioners & Advanced Practice
    (r'Nurse Practitioner', 'np'),
    (r'\bNP\b', 'np'),
    (r'\bAPRN\b', 'np'),
    (r'Advanced Practice', 'np'),
    (r'\bCRNP\b', 'np'),
    (r'Family Nurse Practitioner', 'np'),
    (r'\bFNP\b', 'np'),
    (r'Acute Care NP', 'np'),

    # Clinical Nurse Specialists
    (r'Clinical Nurse Specialist', 'cns'),
    (r'\bCNS\b', 'cns'),

    # Nurse Anesthetists
    (r'Nurse Anesthetist', 'crna'),
    (r'\bCRNA\b', 'crna'),

    # Nurse Midwives
    (r'Nurse Midwife', 'cnm'),
    (r'\bCNM\b', 'cnm'),

    # Licensed Practical/Vocational Nurses
    (r'\bLPN\b', 'lpn'),
    (r'\bLVN\b', 'lpn'),
    (r'Licensed Practical Nurse', 'lpn'),
    (r'Licensed Vocational Nurse', 'lpn'),

    # Certified Nursing Assistants
    (r'\bCNA\b', 'cna'),
    (r'Certified Nursing Assistant', 'cna'),
    (r'Nursing Assistant', 'cna'),
    (r'Nurse Aide', 'cna'),
    (r'Patient Care Tech', 'cna'),
    (r'\bPCT\b', 'cna'),
    (r'Patient Care Associate', 'cna'),
    (r'Nurse Tech', 'cna'),

    # Leadership
    (r'Director of Nursing', 'rn'),
    (r'\bDON\b', 'rn'),
    (r'Chief Nursing', 'rn'),
    (r'\bCNO\b', 'rn'),
    (r'Nursing Supervisor', 'rn'),
    (r'Nurse Supervisor', 'rn'),
    (r'Assistant Nurse Manager', 'rn'),
    (r'\bANM\b', 'rn'),
    (r'Unit Manager.*Nurs', 'rn'),

    # Travel/Contract
    (r'Travel Nurse', 'rn'),
    (r'Contract Nurse', 'rn'),
    (r'Per Diem.*Nurse', 'rn'),
    (r'PRN.*Nurse', 'rn'),
    (r'Nurse.*PRN', 'rn'),
    (r'Agency Nurse', 'rn'),
]

# Patterns to EXCLUDE (not nursing jobs)
EXCLUDE_PATTERNS = [
    r'Physician(?!.*Nurse)',
    r'Doctor(?!.*Nurse)',
    r'\bMD\b',
    r'\bDO\b(?!N)',  # Exclude DO but not DON
    r'Physical Therapist',
    r'\bPT\b(?!.*Nurse)',
    r'Occupational Therapist',
    r'\bOT\b(?!.*Nurse)',
    r'Pharmacist',
    r'Pharmacy Tech',
    r'Radiology Tech',
    r'X-Ray Tech',
    r'CT Tech',
    r'MRI Tech',
    r'Lab Tech',
    r'Medical Technologist',
    r'Respiratory Therapist',
    r'\bRT\b(?!.*Nurse)',
    r'Social Worker',
    r'\bMSW\b',
    r'\bLCSW\b',
    r'Speech Therapist',
    r'Speech Language',
    r'\bSLP\b',
    r'Dietitian',
    r'Nutritionist',
    r'Administrative Assistant',
    r'Receptionist',
    r'Medical Records',
    r'Health Information',
    r'Billing Specialist',
    r'Coder(?!.*Nurse)',
    r'Housekeeper',
    r'Environmental Services',
    r'\bEVS\b',
    r'Food Service',
    r'Dietary(?!.*Nurse)',
    r'Maintenance',
    r'Security(?!.*Nurse)',
    r'\bIT\b(?!.*Nurse)',
    r'Human Resources',
    r'\bHR\b(?!.*Nurse)',
    r'Accountant',
    r'Finance(?!.*Nurse)',
]

# Specialty patterns
SPECIALTY_PATTERNS = {
    'icu': r'ICU|Intensive Care|Critical Care|CCU|MICU|SICU|CVICU|Neuro ICU',
    'er': r'\bER\b|Emergency|\bED\b|Trauma(?!.*OR)',
    'or': r'\bOR\b|Operating Room|Surgical(?!.*ICU)|Perioperative|Surgery(?!.*Post)',
    'pacu': r'PACU|Post.*Anesthesia|Recovery Room',
    'med_surg': r'Med[/-]?Surg|Medical[/-]?Surgical|Acute Care(?!.*NP)',
    'tele': r'Telemetry|Tele\b|Cardiac(?!.*Cath)|Step[- ]?Down|Progressive Care|PCU',
    'cardiac': r'Cardiac Cath|Cath Lab|Cardiology|Heart|Cardiovascular',
    'labor_delivery': r'L&D|Labor.*Delivery|OB\b|Obstetric|Postpartum|Mother.*Baby|LDRP|Birthing|Antepartum',
    'nicu': r'NICU|Neonatal|Newborn ICU',
    'picu': r'PICU|Pediatric ICU|Pediatric Intensive',
    'peds': r'Peds|Pediatric(?!.*ICU)|Children|Child',
    'psych': r'Psych|Behavioral|Mental Health|Psychiatric',
    'oncology': r'Oncology|Cancer|Chemo|Infusion(?!.*General)',
    'dialysis': r'Dialysis|Renal|Nephrology|Hemodialysis',
    'home_health': r'Home Health|Home Care|Visiting|Community Health',
    'hospice': r'Hospice|Palliative',
    'rehab': r'Rehab|Rehabilitation(?!.*Psych)',
    'ltc': r'Long[- ]?Term|SNF|Skilled Nursing|Nursing Home|Extended Care',
    'wound': r'Wound|Ostomy|WOC',
    'endo': r'Endo(?:scopy)?|GI\b|Gastro',
    'neuro': r'Neuro(?!.*ICU)|Stroke|Epilepsy',
    'ortho': r'Ortho|Orthopedic|Joint|Spine',
    'float': r'Float|Resource Pool|Flex',
    'education': r'Educat|Clinical Instructor|Preceptor|Staff Development',
    'case_management': r'Case Manag|Utilization|Discharge Planning|Care Coordination',
    'infection_control': r'Infection|IP\b.*Nurse|Epidemiology',
    'quality': r'Quality|Performance Improvement|Patient Safety',
    'informatics': r'Informatics|Clinical Systems|EHR|EMR',
    'outpatient': r'Outpatient|Ambulatory|Clinic(?!.*ICU)',
    'pre_op': r'Pre[- ]?Op|Pre[- ]?Surgical|Admissions',
}

# Employment type patterns
EMPLOYMENT_PATTERNS = {
    'full_time': r'Full[- ]?Time|FT\b|Regular',
    'part_time': r'Part[- ]?Time|PT\b',
    'prn': r'\bPRN\b|Per Diem|As Needed|Relief',
    'contract': r'Contract|Temporary|Temp\b',
    'travel': r'Travel|Traveler|Assignment',
}

# Shift patterns
SHIFT_PATTERNS = {
    'days': r'Day Shift|Days\b|7a|7:00\s*a|0700|Day\b(?!.*Night)',
    'nights': r'Night Shift|Nights\b|7p|7:00\s*p|1900|Noc|Overnight',
    'evenings': r'Evening|3p|3:00\s*p|1500|Swing|Second Shift',
    'rotating': r'Rotating|Variable|Flex(?:ible)? Schedule',
    'weekends': r'Weekend|Sat|Sun|Baylor',
}

SHIFT_HOURS_PATTERNS = {
    '3x12': r'3x12|36\s*hours|three.*12',
    '4x10': r'4x10|40\s*hours.*10|four.*10',
    '5x8': r'5x8|40\s*hours.*8|five.*8|8\s*hour',
    '12hr': r'12[- ]?hour|12\s*hr',
    '8hr': r'8[- ]?hour|8\s*hr',
}


def is_nursing_job(title: str, description: str = None) -> Tuple[bool, Optional[str]]:
    """
    Determine if a job posting is a nursing position.

    Returns:
        Tuple of (is_nursing, nursing_type)
    """
    text = f"{title} {description or ''}"

    # Check exclusions first
    for pattern in EXCLUDE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            # Double-check it's not a nurse role with excluded word
            if not re.search(r'Nurse|Nursing|\bRN\b|\bLPN\b|\bCNA\b', text, re.IGNORECASE):
                return False, None

    # Check nursing patterns
    for pattern, nursing_type in NURSING_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True, nursing_type

    return False, None


def classify_specialty(title: str, description: str = None) -> str:
    """Determine the nursing specialty from job title/description."""
    text = f"{title} {description or ''}"

    for specialty, pattern in SPECIALTY_PATTERNS.items():
        if re.search(pattern, text, re.IGNORECASE):
            return specialty

    return 'general'


def classify_employment_type(title: str, description: str = None) -> str:
    """Determine employment type from job title/description."""
    text = f"{title} {description or ''}"

    for emp_type, pattern in EMPLOYMENT_PATTERNS.items():
        if re.search(pattern, text, re.IGNORECASE):
            return emp_type

    return 'full_time'  # Default


def classify_shift(title: str, description: str = None) -> Tuple[Optional[str], Optional[str]]:
    """
    Determine shift type and hours from job title/description.

    Returns:
        Tuple of (shift_type, shift_hours)
    """
    text = f"{title} {description or ''}"

    shift_type = None
    for stype, pattern in SHIFT_PATTERNS.items():
        if re.search(pattern, text, re.IGNORECASE):
            shift_type = stype
            break

    shift_hours = None
    for hours, pattern in SHIFT_HOURS_PATTERNS.items():
        if re.search(pattern, text, re.IGNORECASE):
            shift_hours = hours
            break

    return shift_type, shift_hours


def classify_job(title: str, description: str = None) -> Optional[Dict]:
    """
    Full classification of a job posting.

    Returns:
        Dict with classification data, or None if not a nursing job
    """
    is_nursing, nursing_type = is_nursing_job(title, description)

    if not is_nursing:
        return None

    specialty = classify_specialty(title, description)
    employment_type = classify_employment_type(title, description)
    shift_type, shift_hours = classify_shift(title, description)

    return {
        'job_category': 'nursing',
        'nursing_type': nursing_type,
        'specialty': specialty,
        'employment_type': employment_type,
        'shift_type': shift_type,
        'shift_hours': shift_hours,
    }


# Quick test
if __name__ == '__main__':
    test_titles = [
        "RN - ICU Night Shift",
        "Registered Nurse - Emergency Department",
        "LPN - Long Term Care",
        "CNA - Med/Surg PRN",
        "Nurse Practitioner - Cardiology",
        "Director of Nursing",
        "Travel Nurse - OR",
        "Physical Therapist",  # Should be excluded
        "Pharmacy Tech",  # Should be excluded
        "Nurse Manager - NICU",
        "RN Case Manager",
    ]

    print("Job Classification Test:")
    print("=" * 60)
    for title in test_titles:
        result = classify_job(title)
        if result:
            print(f"✓ {title}")
            print(f"  Type: {result['nursing_type']}, Specialty: {result['specialty']}")
            print(f"  Employment: {result['employment_type']}, Shift: {result['shift_type']}")
        else:
            print(f"✗ {title} (not nursing)")
        print()
