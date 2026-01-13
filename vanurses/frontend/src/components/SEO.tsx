import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title: string
  description: string
  canonical?: string
  ogImage?: string
  ogType?: 'website' | 'article'
  noindex?: boolean
  schema?: object
}

const SITE_URL = 'https://vanurses.net'
const SITE_NAME = 'VANurses'
const DEFAULT_IMAGE = `${SITE_URL}/media/images/vanurses_emblem.png`

export function SEO({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  noindex = false,
  schema,
}: SEOProps) {
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`
  const canonicalUrl = canonical || SITE_URL
  const image = ogImage || DEFAULT_IMAGE

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Schema.org JSON-LD */}
      {schema && (
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      )}
    </Helmet>
  )
}

// Pre-configured SEO for common page types
export function JobPostingSEO({
  title,
  facility,
  specialty,
  city,
  state,
  pay,
  jobId,
  description: jobDescription,
}: {
  title: string
  facility: string
  specialty?: string
  city: string
  state: string
  pay?: string
  jobId: string
  description?: string
}) {
  const desc = `${specialty || 'Nursing'} position at ${facility} in ${city}, ${state}. ${pay || 'Competitive pay'}`

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title,
    description: jobDescription || desc,
    hiringOrganization: {
      '@type': 'Organization',
      name: facility,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: city,
        addressRegion: state,
        addressCountry: 'US',
      },
    },
  }

  return (
    <SEO
      title={`${title} at ${facility}`}
      description={desc}
      canonical={`${SITE_URL}/jobs/${jobId}`}
      schema={schema}
    />
  )
}

export function FacilitySEO({
  name,
  city,
  state,
  grade,
  facilityId,
}: {
  name: string
  city: string
  state: string
  grade?: string
  facilityId: string
}) {
  const desc = `${name} in ${city}, ${state}${grade ? `. Grade: ${grade}` : ''}. Read nurse reviews, ratings, and facility information.`

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name,
    address: {
      '@type': 'PostalAddress',
      addressLocality: city,
      addressRegion: state,
      addressCountry: 'US',
    },
  }

  return (
    <SEO
      title={`${name} - Nurse Reviews & Ratings`}
      description={desc}
      canonical={`${SITE_URL}/facilities/${facilityId}`}
      schema={schema}
    />
  )
}

export default SEO
