package repository

import (
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
)

type FacilityRepository struct {
	db *sqlx.DB
}

func NewFacilityRepository(db *sqlx.DB) *FacilityRepository {
	return &FacilityRepository{db: db}
}

// GetFacilities returns facilities with optional filtering
func (r *FacilityRepository) GetFacilities(region, systemName, facilityType string, limit, offset int) ([]map[string]interface{}, int, error) {
	// Build WHERE clause
	var conditions []string
	var args []interface{}
	argNum := 1

	if region != "" {
		conditions = append(conditions, fmt.Sprintf("f.region = $%d", argNum))
		args = append(args, region)
		argNum++
	}
	if systemName != "" {
		conditions = append(conditions, fmt.Sprintf("f.system_name = $%d", argNum))
		args = append(args, systemName)
		argNum++
	}
	if facilityType != "" {
		conditions = append(conditions, fmt.Sprintf("f.facility_type = $%d", argNum))
		args = append(args, facilityType)
		argNum++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM facilities f %s", whereClause)
	var total int
	err := r.db.Get(&total, countQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count facilities: %w", err)
	}

	// Fetch facilities
	query := fmt.Sprintf(`
		SELECT
			f.id, f.name, f.system_name, f.city, f.state, f.zip,
			f.region, f.facility_type, f.bed_count, f.teaching_hospital,
			f.magnet_status, f.trauma_level, f.latitude, f.longitude,
			f.website, f.phone, f.address,
			f.created_at::text, f.updated_at::text
		FROM facilities f
		%s
		ORDER BY f.name
		LIMIT $%d OFFSET $%d
	`, whereClause, argNum, argNum+1)

	args = append(args, limit, offset)

	rows, err := r.db.Queryx(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query facilities: %w", err)
	}
	defer rows.Close()

	var facilities []map[string]interface{}
	for rows.Next() {
		result := make(map[string]interface{})
		err := rows.MapScan(result)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan facility: %w", err)
		}
		facilities = append(facilities, result)
	}

	return facilities, total, nil
}

// GetFacilityByID returns a single facility with all scores
func (r *FacilityRepository) GetFacilityByID(id string) (map[string]interface{}, error) {
	query := `
		SELECT
			f.id, f.name, f.system_name, f.city, f.state, f.zip,
			f.region, f.facility_type, f.bed_count, f.teaching_hospital,
			f.magnet_status, f.trauma_level, f.latitude, f.longitude,
			f.website, f.phone, f.address,
			f.created_at::text, f.updated_at::text,
			fs.pci_score, fs.eri_score, fs.pei_score, fs.fsi_score,
			fs.lssi_score, fs.ali_score, fs.csi_score, fs.qli_score,
			fs.cci_score, fs.ofs_score
		FROM facilities f
		LEFT JOIN facility_scores fs ON f.id = fs.facility_id
		WHERE f.id = $1
	`

	rows, err := r.db.Queryx(query, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query facility: %w", err)
	}
	defer rows.Close()

	if rows.Next() {
		result := make(map[string]interface{})
		err := rows.MapScan(result)
		if err != nil {
			return nil, fmt.Errorf("failed to scan facility: %w", err)
		}
		return result, nil
	}

	return nil, nil // Not found
}

// GetFacilitiesWithScores returns facilities with all 9 index scores
func (r *FacilityRepository) GetFacilitiesWithScores(region string, limit, offset int) ([]map[string]interface{}, int, error) {
	// Build WHERE clause
	var conditions []string
	var args []interface{}
	argNum := 1

	// Only include facilities that have scores
	conditions = append(conditions, "fs.facility_id IS NOT NULL")

	if region != "" {
		conditions = append(conditions, fmt.Sprintf("f.region = $%d", argNum))
		args = append(args, region)
		argNum++
	}

	whereClause := "WHERE " + strings.Join(conditions, " AND ")

	// Count total
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM facilities f
		LEFT JOIN facility_scores fs ON f.id = fs.facility_id
		%s
	`, whereClause)
	var total int
	err := r.db.Get(&total, countQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count facilities: %w", err)
	}

	// Fetch facilities with scores
	query := fmt.Sprintf(`
		SELECT
			f.id, f.name, f.system_name, f.city, f.state, f.zip,
			f.region, f.facility_type, f.bed_count, f.teaching_hospital,
			f.magnet_status, f.trauma_level,
			fs.pci_score, fs.eri_score, fs.pei_score, fs.fsi_score,
			fs.lssi_score, fs.ali_score, fs.csi_score, fs.qli_score,
			fs.cci_score, fs.ofs_score
		FROM facilities f
		LEFT JOIN facility_scores fs ON f.id = fs.facility_id
		%s
		ORDER BY fs.ofs_score DESC NULLS LAST, f.name
		LIMIT $%d OFFSET $%d
	`, whereClause, argNum, argNum+1)

	args = append(args, limit, offset)

	rows, err := r.db.Queryx(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query facilities: %w", err)
	}
	defer rows.Close()

	var facilities []map[string]interface{}
	for rows.Next() {
		result := make(map[string]interface{})
		err := rows.MapScan(result)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan facility: %w", err)
		}
		// Add letter grades for each score
		addGrades(result)
		facilities = append(facilities, result)
	}

	return facilities, total, nil
}

// GetRegions returns all distinct regions
func (r *FacilityRepository) GetRegions() ([]string, error) {
	query := `
		SELECT DISTINCT region
		FROM facilities
		WHERE region IS NOT NULL AND region != ''
		ORDER BY region
	`
	var regions []string
	err := r.db.Select(&regions, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get regions: %w", err)
	}
	return regions, nil
}

// GetSystems returns all distinct hospital systems
func (r *FacilityRepository) GetSystems() ([]string, error) {
	query := `
		SELECT DISTINCT system_name
		FROM facilities
		WHERE system_name IS NOT NULL AND system_name != ''
		ORDER BY system_name
	`
	var systems []string
	err := r.db.Select(&systems, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get systems: %w", err)
	}
	return systems, nil
}

// Helper to convert score to letter grade
func scoreToGrade(score interface{}) string {
	if score == nil {
		return ""
	}

	var s float64
	switch v := score.(type) {
	case float64:
		s = v
	case float32:
		s = float64(v)
	case int64:
		s = float64(v)
	case int:
		s = float64(v)
	default:
		return ""
	}

	switch {
	case s >= 90:
		return "A+"
	case s >= 85:
		return "A"
	case s >= 80:
		return "A-"
	case s >= 77:
		return "B+"
	case s >= 73:
		return "B"
	case s >= 70:
		return "B-"
	case s >= 67:
		return "C+"
	case s >= 63:
		return "C"
	case s >= 60:
		return "C-"
	case s >= 57:
		return "D+"
	case s >= 53:
		return "D"
	case s >= 50:
		return "D-"
	default:
		return "F"
	}
}

// Add letter grades to facility result
func addGrades(result map[string]interface{}) {
	scoreFields := []string{"pci_score", "eri_score", "pei_score", "fsi_score",
		"lssi_score", "ali_score", "csi_score", "qli_score", "cci_score", "ofs_score"}

	for _, field := range scoreFields {
		if score, ok := result[field]; ok {
			gradeField := strings.Replace(field, "_score", "_grade", 1)
			result[gradeField] = scoreToGrade(score)
		}
	}
}
