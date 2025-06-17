package main

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
)

// ClickUp API configuration
var (
	clickupClientID     string
	clickupClientSecret string
	clickupRedirectURI  string
	jwtSecret          string
)

// JWT Claims structure
type Claims struct {
	UserID      string `json:"user_id"`
	AccessToken string `json:"access_token"`
	jwt.RegisteredClaims
}

// ClickUp OAuth response
type ClickUpOAuthResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
}

// ClickUp User response
type ClickUpUser struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

type ClickUpUserResponse struct {
	User ClickUpUser `json:"user"`
}

// ClickUp Team structure
type ClickUpTeam struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Members []struct {
		User struct {
			ID       int    `json:"id"`
			Username string `json:"username"`
			Email    string `json:"email"`
		} `json:"user"`
	} `json:"members"`
}

type ClickUpTeamsResponse struct {
	Teams []ClickUpTeam `json:"teams"`
}

// ClickUp Task structure
type ClickUpTask struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status struct {
		Status string `json:"status"`
		Color  string `json:"color"`
	} `json:"status"`
	DateCreated string `json:"date_created"`
	DateUpdated string `json:"date_updated"`
	DueDate     string `json:"due_date"`
	Assignees   []struct {
		ID       int    `json:"id"`
		Username string `json:"username"`
		Email    string `json:"email"`
	} `json:"assignees"`
}

type ClickUpTasksResponse struct {
	Tasks []ClickUpTask `json:"tasks"`
}

type HealthResponse struct {
	Status    string    `json:"status"`
	Service   string    `json:"service"`
	Port      string    `json:"port"`
	Timestamp time.Time `json:"timestamp"`
	Version   string    `json:"version"`
	Features  []string  `json:"features,omitempty"`
}

type Task struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Priority    string    `json:"priority"`
	Status      string    `json:"status"`
	Assignee    string    `json:"assignee"`
	CreatedAt   time.Time `json:"created_at"`
	DueDate     string    `json:"due_date"`
}

type TeamMember struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Role         string  `json:"role"`
	Avatar       string  `json:"avatar"`
	Status       string  `json:"status"`
	CurrentTasks int     `json:"current_tasks"`
	MaxTasks     int     `json:"max_tasks"`
	WorkloadPct  float64 `json:"workload_percentage"`
}

func init() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Printf("Warning: .env file not found, using default values")
	}

	clickupClientID = getEnv("CLICKUP_CLIENT_ID", "DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL")
	clickupClientSecret = getEnv("CLICKUP_CLIENT_SECRET", "BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX")
	clickupRedirectURI = getEnv("CLICKUP_REDIRECT_URI", "http://192.168.20.10:777/api/v1/auth/clickup/callback")
	jwtSecret = getEnv("JWT_SECRET", "TaskFlow-Super-Secret-Key-2025-Production")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Generate random state for OAuth
func generateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// Create JWT token
func createJWTToken(userID, accessToken string) (string, error) {
	claims := &Claims{
		UserID:      userID,
		AccessToken: accessToken,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

// Validate JWT token
func validateJWTToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(jwtSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, err
	}

	return claims, nil
}

// ClickUp API request helper
func makeClickUpRequest(endpoint, accessToken string) ([]byte, error) {
	req, err := http.NewRequest("GET", "https://api.clickup.com/api/v2"+endpoint, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", accessToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ClickUp API error: %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

func main() {
	// Set Gin to release mode
	gin.SetMode(gin.ReleaseMode)
	
	// Create Gin router
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, HealthResponse{
			Status:    "OK",
			Service:   "TaskFlow Backend",
			Port:      "777",
			Timestamp: time.Now(),
			Version:   "2.0.0-clickup",
			Features:  []string{"clickup_integration", "oauth2", "real_data"},
		})
	})

	// API v1 routes
	v1 := r.Group("/api/v1")
	{
		// Health endpoint for API
		v1.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":    "OK",
				"service":   "TaskFlow API v1",
				"timestamp": time.Now(),
				"clickup":   "ready",
			})
		})

		// ClickUp OAuth routes
		auth := v1.Group("/auth")
		{
			// Start ClickUp OAuth flow
			auth.GET("/clickup/authorize", func(c *gin.Context) {
				state := generateState()
				
				authURL := fmt.Sprintf(
					"https://app.clickup.com/api?client_id=%s&redirect_uri=%s&state=%s",
					clickupClientID,
					url.QueryEscape(clickupRedirectURI),
					state,
				)

				c.JSON(http.StatusOK, gin.H{
					"auth_url": authURL,
					"state":    state,
				})
			})

			// Handle ClickUp OAuth callback
			auth.GET("/clickup/callback", func(c *gin.Context) {
				code := c.Query("code")
				if code == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "No authorization code received"})
					return
				}

				// Exchange code for access token
				tokenData := url.Values{}
				tokenData.Set("client_id", clickupClientID)
				tokenData.Set("client_secret", clickupClientSecret)
				tokenData.Set("code", code)

				resp, err := http.PostForm("https://api.clickup.com/api/v2/oauth/token", tokenData)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange code for token"})
					return
				}
				defer resp.Body.Close()

				var oauthResp ClickUpOAuthResponse
				if err := json.NewDecoder(resp.Body).Decode(&oauthResp); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse token response"})
					return
				}

				// Get user info
				userResp, err := makeClickUpRequest("/user", oauthResp.AccessToken)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
					return
				}

				var userInfo ClickUpUserResponse
				if err := json.Unmarshal(userResp, &userInfo); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse user info"})
					return
				}

				// Create JWT token
				jwtToken, err := createJWTToken(strconv.Itoa(userInfo.User.ID), oauthResp.AccessToken)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create JWT token"})
					return
				}

				// Redirect to frontend with token
				c.Redirect(http.StatusFound, fmt.Sprintf("http://192.168.20.10:555?token=%s", jwtToken))
			})

			// Check authentication status
			auth.GET("/status", func(c *gin.Context) {
				authHeader := c.GetHeader("Authorization")
				if authHeader == "" {
					c.JSON(http.StatusUnauthorized, gin.H{"authenticated": false})
					return
				}

				tokenString := strings.TrimPrefix(authHeader, "Bearer ")
				claims, err := validateJWTToken(tokenString)
				if err != nil {
					c.JSON(http.StatusUnauthorized, gin.H{"authenticated": false})
					return
				}

				c.JSON(http.StatusOK, gin.H{
					"authenticated": true,
					"user_id":      claims.UserID,
					"expires_at":   claims.ExpiresAt.Time,
				})
			})

			// Logout
			auth.POST("/logout", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
			})
		}

		// Protected routes (require authentication) 
		protected := v1.Group("/")
		protected.Use(func(c *gin.Context) {
			authHeader := c.GetHeader("Authorization")
			if authHeader == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
				c.Abort()
				return
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := validateJWTToken(tokenString)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
				c.Abort()
				return
			}

			c.Set("user_id", claims.UserID)
			c.Set("access_token", claims.AccessToken)
			c.Next()
		})

		// Get dashboard data (real ClickUp data)
		protected.GET("dashboard", func(c *gin.Context) {
			accessToken := c.GetString("access_token")

			// Get teams
			teamsResp, err := makeClickUpRequest("/team", accessToken)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch teams"})
				return
			}

			var teams ClickUpTeamsResponse
			if err := json.Unmarshal(teamsResp, &teams); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse teams"})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"teams": teams.Teams,
				"message": "Dashboard data from ClickUp",
			})
		})

		// Manual sync endpoint
		protected.POST("sync", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"message":    "Data synchronized successfully",
				"timestamp":  time.Now(),
				"status":     "completed",
			})
		})

		// Public endpoints (no auth required) - Demo data
		v1.GET("/tasks", func(c *gin.Context) {
			tasks := []Task{
				{
					ID:          "1",
					Title:       "พัฒนา Dashboard หลัก",
					Description: "สร้าง Dashboard สำหรับแสดงข้อมูล KPI และสถานะทีม",
					Priority:    "high",
					Status:      "in_progress",
					Assignee:    "สมชาย วิชาการ",
					CreatedAt:   time.Now().AddDate(0, 0, -2),
					DueDate:     "2025-06-20",
				},
				{
					ID:          "2",
					Title:       "ปรับปรุง API Backend",
					Description: "เพิ่มฟังก์ชัน authentication และ authorization",
					Priority:    "medium",
					Status:      "pending",
					Assignee:    "สุภา เทคโนโลยี",
					CreatedAt:   time.Now().AddDate(0, 0, -1),
					DueDate:     "2025-06-25",
				},
				{
					ID:          "3",
					Title:       "ทดสอบระบบ",
					Description: "ทดสอบ integration ทั้งระบบและ performance",
					Priority:    "high",
					Status:      "completed",
					Assignee:    "วิชัย ทดสอบ",
					CreatedAt:   time.Now().AddDate(0, 0, -5),
					DueDate:     "2025-06-15",
				},
			}
			c.JSON(http.StatusOK, gin.H{"tasks": tasks})
		})

		v1.GET("/team", func(c *gin.Context) {
			team := []TeamMember{
				{
					ID:           "1",
					Name:         "สมชาย วิชาการ",
					Role:         "Frontend Developer",
					Avatar:       "SC",
					Status:       "available",
					CurrentTasks: 3,
					MaxTasks:     5,
					WorkloadPct:  60.0,
				},
				{
					ID:           "2",
					Name:         "สุภา เทคโนโลยี",
					Role:         "Backend Developer",
					Avatar:       "ST",
					Status:       "busy",
					CurrentTasks: 4,
					MaxTasks:     5,
					WorkloadPct:  80.0,
				},
				{
					ID:           "3",
					Name:         "วิชัย ทดสอบ",
					Role:         "QA Engineer",
					Avatar:       "WT",
					Status:       "available",
					CurrentTasks: 2,
					MaxTasks:     4,
					WorkloadPct:  50.0,
				},
			}
			c.JSON(http.StatusOK, gin.H{"team": team})
		})
	}

	// Start server on all interfaces
	log.Printf("🚀 TaskFlow Backend starting on port 777...")
	log.Printf("🌐 Listening on all interfaces (0.0.0.0:777)")
	
	if err := r.Run("0.0.0.0:777"); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
	}
}