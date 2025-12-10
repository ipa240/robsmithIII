"""
VANurses.com - Scraper Configuration
"""

# Database configuration
DB_CONFIG = {
    'dbname': 'vanurses',
    'user': 'vanurses_app',
    'password': 'VaNurses2025Secure',
    'host': '192.168.0.150',
    'port': 5432
}

# Workday API endpoints for Virginia hospital systems
WORKDAY_SYSTEMS = {
    'sentara': {
        'name': 'Sentara',  # Matches DB system_name
        'base_url': 'https://sentara.wd1.myworkdayjobs.com',
        'api_path': '/wday/cxs/sentara/SCS/jobs',
        'facilities': 11,
    },
    'carilion': {
        'name': 'Carilion',  # Matches DB system_name
        'base_url': 'https://carilionclinic.wd12.myworkdayjobs.com',
        'api_path': '/wday/cxs/carilionclinic/External_Careers/jobs',
        'facilities': 6,
    },
    'vcuhealth': {
        'name': 'VCU Health',  # Matches DB system_name
        'base_url': 'https://vcuhealth.wd1.myworkdayjobs.com',
        'api_path': '/wday/cxs/vcuhealth/VCUHealth_careers/jobs',
        'facilities': 1,
    },
    'uvahealth': {
        'name': 'UVA Health',  # Matches DB system_name
        'base_url': 'https://uva.wd1.myworkdayjobs.com',
        'api_path': '/wday/cxs/uva/UVAJobs/jobs',
        'facilities': 3,
    },
    'valleyhealth': {
        'name': 'Valley Health',  # Matches DB system_name
        'base_url': 'https://valleyhealthlink.wd5.myworkdayjobs.com',
        'api_path': '/wday/cxs/valleyhealthlink/valleyhealthcareers/jobs',
        'facilities': 4,
    },
    'riverside': {
        'name': 'Riverside',  # Matches DB system_name
        'base_url': 'https://rivhs.wd1.myworkdayjobs.com',
        'api_path': '/wday/cxs/rivhs/Non-ProviderRHS/jobs',
        'facilities': 4,
    },
    'marywashington': {
        'name': 'Mary Washington',  # Matches DB system_name
        'base_url': 'https://marywashingtonhealthcare.wd5.myworkdayjobs.com',
        'api_path': '/wday/cxs/marywashingtonhealthcare/Externalcareers/jobs',
        'facilities': 2,
    },
    'vhchealth': {
        'name': 'VHC Health',  # Matches DB system_name
        'base_url': 'https://vhchealth.wd1.myworkdayjobs.com',
        'api_path': '/wday/cxs/vhchealth/VHCHealth/jobs',
        'facilities': 1,
    },
}

# Rate limiting
REQUEST_DELAY = 2.0  # seconds between requests
MAX_RETRIES = 3
RETRY_DELAY = 5.0  # seconds before retry

# Scraping settings
JOBS_PER_PAGE = 20
MAX_PAGES = 50  # Max pages to fetch per system (1000 jobs)
