/**
 * Centralized filter value definitions for VANurses
 * Database values (keys) -> Display labels (values)
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
  endo: 'Endoscopy',
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
