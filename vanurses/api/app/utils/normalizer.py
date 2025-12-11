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

# Region normalization - maps all variants to canonical display name
# Key: lowercase version of any variant -> Value: (canonical_display, db_values_to_match)
REGION_MAP = {
    # Northern Virginia
    "nova": "Northern Virginia",
    "northern_virginia": "Northern Virginia",
    "northern virginia": "Northern Virginia",
    # Hampton Roads
    "hampton_roads": "Hampton Roads",
    "hampton roads": "Hampton Roads",
    # Richmond
    "richmond": "Richmond Metro",
    "richmond_metro": "Richmond Metro",
    "richmond metro": "Richmond Metro",
    # Charlottesville
    "charlottesville": "Charlottesville",
    # Roanoke
    "roanoke": "Roanoke Valley",
    "roanoke_valley": "Roanoke Valley",
    "roanoke valley": "Roanoke Valley",
    # Shenandoah
    "shenandoah": "Shenandoah Valley",
    "shenandoah_valley": "Shenandoah Valley",
    "shenandoah valley": "Shenandoah Valley",
    # Southwest
    "southwest": "Southwest Virginia",
    "southwest_virginia": "Southwest Virginia",
    "southwest virginia": "Southwest Virginia",
    # Other regions (single canonical form)
    "central_virginia": "Central Virginia",
    "central virginia": "Central Virginia",
    "eastern_shore": "Eastern Shore",
    "eastern shore": "Eastern Shore",
    "fredericksburg": "Fredericksburg",
    "lynchburg": "Lynchburg",
    "middle_peninsula": "Middle Peninsula",
    "middle peninsula": "Middle Peninsula",
    "new_river_valley": "New River Valley",
    "new river valley": "New River Valley",
    "northern_neck": "Northern Neck",
    "northern neck": "Northern Neck",
    "southside": "Southside",
    "statewide": "Statewide",
    "national": "National",
    "other_virginia": "Other Virginia",
    "other virginia": "Other Virginia",
}

# Reverse map: display name -> list of db values that should match
REGION_DB_VALUES = {
    "Northern Virginia": ["nova", "northern_virginia", "Northern Virginia"],
    "Hampton Roads": ["hampton_roads", "Hampton Roads"],
    "Richmond Metro": ["richmond", "Richmond Metro", "richmond_metro"],
    "Charlottesville": ["charlottesville", "Charlottesville"],
    "Roanoke Valley": ["roanoke", "Roanoke Valley", "roanoke_valley"],
    "Shenandoah Valley": ["shenandoah", "Shenandoah Valley", "shenandoah_valley"],
    "Southwest Virginia": ["southwest", "Southwest Virginia", "southwest_virginia"],
    "Central Virginia": ["central_virginia"],
    "Eastern Shore": ["eastern_shore"],
    "Fredericksburg": ["fredericksburg"],
    "Lynchburg": ["Lynchburg", "lynchburg"],
    "Middle Peninsula": ["middle_peninsula"],
    "New River Valley": ["new_river_valley"],
    "Northern Neck": ["northern_neck"],
    "Southside": ["southside"],
    "Statewide": ["statewide"],
    "National": ["national"],
    "Other Virginia": ["Other Virginia", "other_virginia"],
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


def normalize_region(value: str) -> str:
    """Convert any region variant to canonical display format.

    Examples:
        normalize_region("nova") -> "Northern Virginia"
        normalize_region("hampton_roads") -> "Hampton Roads"
        normalize_region("Richmond Metro") -> "Richmond Metro"
    """
    if not value:
        return value
    return REGION_MAP.get(value.lower().replace("_", " "), value.replace("_", " ").title())


def get_region_db_values(display_region: str) -> List[str]:
    """Get all database values that should match a canonical region.

    Examples:
        get_region_db_values("Northern Virginia") -> ["nova", "northern_virginia", "Northern Virginia"]
    """
    return REGION_DB_VALUES.get(display_region, [display_region])


def get_canonical_regions() -> List[str]:
    """Get list of all canonical region display names."""
    return sorted(REGION_DB_VALUES.keys())


def normalize_specialty_display(value: str) -> str:
    """Convert specialty to proper display format.

    Examples:
        normalize_specialty_display("med_surg") -> "Med-Surg"
        normalize_specialty_display("icu") -> "ICU"
        normalize_specialty_display("cath_lab") -> "Cath Lab"
    """
    if not value:
        return value
    val = value.lower().replace("{", "").replace("}", "")
    if val in SPECIALTY_MAP:
        return SPECIALTY_MAP[val]
    # For unmapped specialties, make them title case with proper formatting
    return value.replace("_", " ").title()
