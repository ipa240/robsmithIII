"""
Centralized data normalization for VANurses.
Converts between display format and database format.
"""
from typing import List, Optional

# Database canonical values -> Display values
NURSING_TYPE_MAP = {
    "rn": "RN", "np": "NP", "cna": "CNA", "lpn": "LPN",
    "crna": "CRNA", "cns": "CNS", "cnm": "CNM"
}

SPECIALTY_MAP = {
    "icu": "ICU", "er": "ER", "or": "OR", "pacu": "PACU",
    "med_surg": "Med-Surg", "tele": "Telemetry", "cardiac": "Cardiac",
    "labor_delivery": "Labor & Delivery", "nicu": "NICU", "picu": "PICU",
    "peds": "Pediatrics", "psych": "Psych", "oncology": "Oncology",
    "dialysis": "Dialysis", "home_health": "Home Health", "hospice": "Hospice",
    "rehab": "Rehab", "ltc": "Long-Term Care", "wound": "Wound Care",
    "endo": "Endoscopy", "neuro": "Neuro", "ortho": "Ortho",
    "float": "Float Pool", "outpatient": "Outpatient", "general": "General"
}

EMPLOYMENT_TYPE_MAP = {
    "full_time": "Full-Time", "part_time": "Part-Time",
    "prn": "PRN", "contract": "Contract", "travel": "Travel",
    "other": "Other", "temporary": "Temporary"
}

SHIFT_TYPE_MAP = {
    "days": "Days", "nights": "Nights", "evenings": "Evenings",
    "rotating": "Rotating", "weekends": "Weekends"
}

# Reverse maps (display -> database)
NURSING_TYPE_REVERSE = {v.lower(): k for k, v in NURSING_TYPE_MAP.items()}
SPECIALTY_REVERSE = {v.lower(): k for k, v in SPECIALTY_MAP.items()}
EMPLOYMENT_TYPE_REVERSE = {v.lower(): k for k, v in EMPLOYMENT_TYPE_MAP.items()}
SHIFT_TYPE_REVERSE = {v.lower(): k for k, v in SHIFT_TYPE_MAP.items()}


def normalize_to_db(value: str, field_type: str) -> str:
    """Convert display value to database format.

    Examples:
        normalize_to_db("Full-Time", "employment_type") -> "full_time"
        normalize_to_db("ICU", "specialty") -> "icu"
        normalize_to_db("{FULL_TIME}", "employment_type") -> "full_time"
    """
    if not value:
        return value

    # Clean the value: lowercase, replace hyphens/spaces with underscores
    val = value.strip().lower().replace("-", "_").replace(" ", "_")

    # Remove curly braces from legacy data like {FULL_TIME}
    val = val.replace("{", "").replace("}", "")

    # Try to get from reverse map first (handles display values)
    if field_type == "employment_type":
        return EMPLOYMENT_TYPE_REVERSE.get(value.lower(), val)
    elif field_type == "specialty":
        return SPECIALTY_REVERSE.get(value.lower(), val)
    elif field_type == "nursing_type":
        return NURSING_TYPE_REVERSE.get(value.lower(), val)
    elif field_type == "shift_type":
        return SHIFT_TYPE_REVERSE.get(value.lower(), val)

    return val


def normalize_list_to_db(values: Optional[List[str]], field_type: str) -> List[str]:
    """Convert list of display values to database format."""
    if not values:
        return []
    return [normalize_to_db(v, field_type) for v in values if v]


def to_display(value: str, field_type: str) -> str:
    """Convert database value to display format.

    Examples:
        to_display("full_time", "employment_type") -> "Full-Time"
        to_display("icu", "specialty") -> "ICU"
    """
    if not value:
        return value

    # Clean the value (handle legacy braces)
    val = value.lower().replace("{", "").replace("}", "")

    if field_type == "employment_type":
        return EMPLOYMENT_TYPE_MAP.get(val, value.replace("_", " ").title())
    elif field_type == "specialty":
        return SPECIALTY_MAP.get(val, value.upper() if len(value) <= 4 else value.replace("_", " ").title())
    elif field_type == "nursing_type":
        return NURSING_TYPE_MAP.get(val, value.upper())
    elif field_type == "shift_type":
        return SHIFT_TYPE_MAP.get(val, value.replace("_", " ").title())

    return value


def to_display_list(values: Optional[List[str]], field_type: str) -> List[str]:
    """Convert list of database values to display format."""
    if not values:
        return []
    return [to_display(v, field_type) for v in values if v]
