package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"vanurses-api/internal/repository"
	"vanurses-api/pkg/utils"
)

type FacilityHandler struct {
	repo *repository.FacilityRepository
}

func NewFacilityHandler(repo *repository.FacilityRepository) *FacilityHandler {
	return &FacilityHandler{repo: repo}
}

// GetFacilities returns paginated list of facilities
func (h *FacilityHandler) GetFacilities(c *gin.Context) {
	// Parse query parameters
	region := c.Query("region")
	systemName := c.Query("system")
	facilityType := c.Query("type")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	// Clamp limit
	if limit > 100 {
		limit = 100
	}
	if limit < 1 {
		limit = 50
	}

	facilities, total, err := h.repo.GetFacilities(region, systemName, facilityType, limit, offset)
	if err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch facilities", err.Error())
		return
	}

	utils.PaginatedResponse(c, facilities, total, limit, offset)
}

// GetFacility returns a single facility by ID with all scores
func (h *FacilityHandler) GetFacility(c *gin.Context) {
	id := c.Param("id")

	facility, err := h.repo.GetFacilityByID(id)
	if err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch facility", err.Error())
		return
	}

	if facility == nil {
		utils.ErrorResponse(c, http.StatusNotFound, "Facility not found", "")
		return
	}

	utils.SuccessResponse(c, facility)
}

// GetFacilitiesWithScores returns facilities with all 9 index scores
func (h *FacilityHandler) GetFacilitiesWithScores(c *gin.Context) {
	region := c.Query("region")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit > 100 {
		limit = 100
	}
	if limit < 1 {
		limit = 50
	}

	facilities, total, err := h.repo.GetFacilitiesWithScores(region, limit, offset)
	if err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch facilities", err.Error())
		return
	}

	utils.PaginatedResponse(c, facilities, total, limit, offset)
}

// GetRegions returns all regions
func (h *FacilityHandler) GetRegions(c *gin.Context) {
	regions, err := h.repo.GetRegions()
	if err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch regions", err.Error())
		return
	}

	utils.SuccessResponse(c, gin.H{
		"regions": regions,
		"count":   len(regions),
	})
}

// GetSystems returns all hospital systems
func (h *FacilityHandler) GetSystems(c *gin.Context) {
	systems, err := h.repo.GetSystems()
	if err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch systems", err.Error())
		return
	}

	utils.SuccessResponse(c, gin.H{
		"systems": systems,
		"count":   len(systems),
	})
}
