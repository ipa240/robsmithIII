/**
 * Data normalization utilities for VANurses frontend
 * Converts between display format and database format
 */

import {
  NURSING_TYPES,
  SPECIALTIES,
  EMPLOYMENT_TYPES,
  SHIFT_TYPES
} from './filterValues';

// Create reverse maps (display -> database)
const createReverseMap = (map: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(map).map(([k, v]) => [v.toLowerCase(), k])
  );

const NURSING_TYPE_REVERSE = createReverseMap(NURSING_TYPES);
const SPECIALTY_REVERSE = createReverseMap(SPECIALTIES);
const EMPLOYMENT_TYPE_REVERSE = createReverseMap(EMPLOYMENT_TYPES);
const SHIFT_TYPE_REVERSE = createReverseMap(SHIFT_TYPES);

type FieldType = 'nursing_type' | 'specialty' | 'employment_type' | 'shift_type';

/**
 * Convert any format to database format
 *
 * @example
 * normalizeToDb("Full-Time", "employment_type") // returns "full_time"
 * normalizeToDb("ICU", "specialty") // returns "icu"
 * normalizeToDb("{FULL_TIME}", "employment_type") // returns "full_time"
 */
export function normalizeToDb(value: string | undefined | null, fieldType: FieldType): string {
  if (!value) return '';

  // Clean: lowercase, replace hyphens/spaces with underscores, remove braces
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[{}]/g, '');

  // Try reverse map first (handles display values like "Full-Time")
  switch (fieldType) {
    case 'nursing_type':
      return NURSING_TYPE_REVERSE[value.toLowerCase()] || normalized;
    case 'specialty':
      return SPECIALTY_REVERSE[value.toLowerCase()] || normalized;
    case 'employment_type':
      return EMPLOYMENT_TYPE_REVERSE[value.toLowerCase()] || normalized;
    case 'shift_type':
      return SHIFT_TYPE_REVERSE[value.toLowerCase()] || normalized;
    default:
      return normalized;
  }
}

/**
 * Convert database format to display format
 *
 * @example
 * toDisplay("full_time", "employment_type") // returns "Full-Time"
 * toDisplay("icu", "specialty") // returns "ICU"
 */
export function toDisplay(value: string | undefined | null, fieldType: FieldType): string {
  if (!value) return '';

  // Clean braces from legacy data
  const clean = value.toLowerCase().replace(/[{}]/g, '');

  switch (fieldType) {
    case 'nursing_type':
      return NURSING_TYPES[clean as keyof typeof NURSING_TYPES] || value.toUpperCase();
    case 'specialty':
      return SPECIALTIES[clean as keyof typeof SPECIALTIES] ||
        (value.length <= 4 ? value.toUpperCase() : value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    case 'employment_type':
      return EMPLOYMENT_TYPES[clean as keyof typeof EMPLOYMENT_TYPES] ||
        value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    case 'shift_type':
      return SHIFT_TYPES[clean as keyof typeof SHIFT_TYPES] ||
        value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    default:
      return value;
  }
}

/**
 * Normalize a list of values to database format
 */
export function normalizeListToDb(values: string[] | undefined | null, fieldType: FieldType): string[] {
  if (!values || !Array.isArray(values)) return [];
  return values.filter(Boolean).map(v => normalizeToDb(v, fieldType));
}

/**
 * Convert a list of database values to display format
 */
export function toDisplayList(values: string[] | undefined | null, fieldType: FieldType): string[] {
  if (!values || !Array.isArray(values)) return [];
  return values.filter(Boolean).map(v => toDisplay(v, fieldType));
}

/**
 * Normalize filter params before API call
 * Use this to ensure all filter values are in database format
 */
export function normalizeFilters(
  filters: Record<string, string | string[] | undefined | null>
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    // Handle array values
    if (Array.isArray(value)) {
      if (key === 'specialties' || key === 'specialty') {
        result[key] = normalizeListToDb(value, 'specialty');
      } else if (key === 'employment_types' || key === 'employmentTypes') {
        result.employment_types = normalizeListToDb(value, 'employment_type');
      } else if (key === 'shift_types' || key === 'shiftTypes') {
        result.shift_types = normalizeListToDb(value, 'shift_type');
      } else if (key === 'nursing_types' || key === 'nursingTypes') {
        result.nursing_types = normalizeListToDb(value, 'nursing_type');
      } else {
        result[key] = value;
      }
      continue;
    }

    // Handle string values
    if (key === 'nursing_type' || key === 'nursingType') {
      result.nursing_type = normalizeToDb(value, 'nursing_type');
    } else if (key === 'specialty') {
      result.specialty = normalizeToDb(value, 'specialty');
    } else if (key === 'employment_type' || key === 'employmentType') {
      result.employment_type = normalizeToDb(value, 'employment_type');
    } else if (key === 'shift_type' || key === 'shiftType') {
      result.shift_type = normalizeToDb(value, 'shift_type');
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Build query params for matched jobs API
 * Converts preferences to normalized query string format
 */
export function buildMatchedJobsParams(preferences: {
  specialties?: string[];
  employment_types?: string[];
  shift_preferences?: string[];
}): Record<string, string> {
  const params: Record<string, string> = {};

  if (preferences.specialties?.length) {
    params.specialties = normalizeListToDb(preferences.specialties, 'specialty').join(',');
  }

  if (preferences.employment_types?.length) {
    params.employment_types = normalizeListToDb(preferences.employment_types, 'employment_type').join(',');
  }

  return params;
}
