/**
 * Centralized filter value definitions for VANurses
 * Database values (keys) -> Display labels (values)
 *
 * These constants ensure consistent data format across the application.
 * Always use database format (keys) when making API requests.
 */

export const NURSING_TYPES = {
  rn: 'RN',
  np: 'NP',
  cna: 'CNA',
  lpn: 'LPN',
  crna: 'CRNA',
  cns: 'CNS',
  cnm: 'CNM'
} as const;

export const SPECIALTIES = {
  icu: 'ICU',
  er: 'ER',
  or: 'OR',
  pacu: 'PACU',
  med_surg: 'Med-Surg',
  tele: 'Telemetry',
  cardiac: 'Cardiac',
  labor_delivery: 'Labor & Delivery',
  nicu: 'NICU',
  picu: 'PICU',
  peds: 'Pediatrics',
  psych: 'Psych',
  oncology: 'Oncology',
  dialysis: 'Dialysis',
  home_health: 'Home Health',
  hospice: 'Hospice',
  rehab: 'Rehab',
  ltc: 'Long-Term Care',
  wound: 'Wound Care',
  neuro: 'Neuro',
  ortho: 'Ortho',
  float: 'Float Pool',
  outpatient: 'Outpatient',
  general: 'General'
} as const;

export const EMPLOYMENT_TYPES = {
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  prn: 'PRN',
  contract: 'Contract',
  travel: 'Travel',
  temporary: 'Temporary',
  other: 'Other'
} as const;

export const SHIFT_TYPES = {
  days: 'Days',
  nights: 'Nights',
  evenings: 'Evenings',
  rotating: 'Rotating',
  weekends: 'Weekends'
} as const;

// Type definitions
export type NursingType = keyof typeof NURSING_TYPES;
export type Specialty = keyof typeof SPECIALTIES;
export type EmploymentType = keyof typeof EMPLOYMENT_TYPES;
export type ShiftType = keyof typeof SHIFT_TYPES;

// Helper to get all values as array for dropdowns
export const getNursingTypeOptions = () =>
  Object.entries(NURSING_TYPES).map(([value, label]) => ({ value, label }));

export const getSpecialtyOptions = () =>
  Object.entries(SPECIALTIES).map(([value, label]) => ({ value, label }));

export const getEmploymentTypeOptions = () =>
  Object.entries(EMPLOYMENT_TYPES).map(([value, label]) => ({ value, label }));

export const getShiftTypeOptions = () =>
  Object.entries(SHIFT_TYPES).map(([value, label]) => ({ value, label }));
