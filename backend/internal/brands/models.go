package brands

import (
	"time"
)

type Brand struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	HexColor  string    `json:"hex_color"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateBrandRequest struct {
	Name     string `json:"name"`
	Slug     string `json:"slug"`
	HexColor string `json:"hex_color"`
}
