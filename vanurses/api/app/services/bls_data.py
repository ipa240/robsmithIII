"""BLS wage data service - provides market rate data from Bureau of Labor Statistics"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional

# Map nursing_type values to SOC codes
NURSING_TYPE_TO_SOC = {
    'rn': '29-1141',
    'lpn': '29-2061',
    'cna': '31-1131',
    'np': '29-1171',
    'crna': '29-1151',
    'travel': '29-1141',  # Travel nurses are RNs
}

# Display names for nursing types
NURSING_TYPE_DISPLAY = {
    'rn': 'Registered Nurse',
    'lpn': 'Licensed Practical Nurse',
    'cna': 'Nursing Assistant',
    'np': 'Nurse Practitioner',
    'crna': 'Nurse Anesthetist',
    'travel': 'Travel Nurse',
}


def get_market_rate(db: Session, nursing_type: Optional[str], city: Optional[str]) -> Optional[dict]:
    """
    Get BLS market rate for a job type and location.

    Args:
        db: Database session
        nursing_type: Type of nursing role (rn, lpn, cna, np, crna, travel)
        city: City name for location-based lookup

    Returns:
        Dictionary with min, median, max hourly rates and metadata, or None if not found
    """
    if not nursing_type:
        return None

    soc_code = NURSING_TYPE_TO_SOC.get(nursing_type.lower())
    if not soc_code:
        return None

    area_code = '51'  # Default to Virginia statewide
    area_name = 'Virginia'

    # Try to get metro area code from city
    if city:
        area_result = db.execute(text(
            "SELECT area_code, area_name FROM metro_area_mapping WHERE city ILIKE :city"
        ), {"city": city.strip()}).fetchone()

        if area_result:
            area_code = area_result.area_code
            area_name = area_result.area_name

    # Get wage data for this SOC code and area
    wage = db.execute(text("""
        SELECT hourly_25th, hourly_median, hourly_75th, area_name, soc_title, year
        FROM bls_wage_data
        WHERE soc_code = :soc AND area_code = :area
        ORDER BY year DESC
        LIMIT 1
    """), {"soc": soc_code, "area": area_code}).fetchone()

    # If no metro-specific data, fall back to state average
    if not wage and area_code != '51':
        wage = db.execute(text("""
            SELECT hourly_25th, hourly_median, hourly_75th, area_name, soc_title, year
            FROM bls_wage_data
            WHERE soc_code = :soc AND area_code = '51'
            ORDER BY year DESC
            LIMIT 1
        """), {"soc": soc_code}).fetchone()

    if wage:
        # For travel nurses, add a premium (typically 20-40% higher than staff RN)
        multiplier = 1.25 if nursing_type.lower() == 'travel' else 1.0

        return {
            "min": round(float(wage.hourly_25th) * multiplier, 2) if wage.hourly_25th else None,
            "median": round(float(wage.hourly_median) * multiplier, 2) if wage.hourly_median else None,
            "max": round(float(wage.hourly_75th) * multiplier, 2) if wage.hourly_75th else None,
            "area": wage.area_name,
            "occupation": NURSING_TYPE_DISPLAY.get(nursing_type.lower(), wage.soc_title),
            "source": f"BLS OEWS {wage.year}",
            "isTravel": nursing_type.lower() == 'travel'
        }

    return None


def get_all_market_rates(db: Session, city: Optional[str] = None) -> dict:
    """
    Get market rates for all nursing types in a given area.

    Args:
        db: Database session
        city: Optional city name for location-based lookup

    Returns:
        Dictionary mapping nursing types to their market rates
    """
    rates = {}
    for nursing_type in NURSING_TYPE_TO_SOC.keys():
        rate = get_market_rate(db, nursing_type, city)
        if rate:
            rates[nursing_type] = rate
    return rates
