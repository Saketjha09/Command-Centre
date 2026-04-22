package brands

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/google/uuid"
)

const dbTimeout = 5 * time.Second

func ListBrands(ctx context.Context, pool *pgxpool.Pool) ([]Brand, error) {
	ctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()

	rows, err := pool.Query(ctx, "SELECT id, name, slug, hex_color, created_at FROM ops.brands ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var brands []Brand
	for rows.Next() {
		var b Brand
		var id pgtype.UUID
		if err := rows.Scan(&id, &b.Name, &b.Slug, &b.HexColor, &b.CreatedAt); err != nil {
			return nil, err
		}
		b.ID = uuid.UUID(id.Bytes).String()
		brands = append(brands, b)
	}
	return brands, nil
}

func CreateBrand(ctx context.Context, pool *pgxpool.Pool, req CreateBrandRequest) (Brand, error) {
	ctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()

	var id pgtype.UUID
	var createdAt time.Time
	err := pool.QueryRow(ctx, 
		"INSERT INTO ops.brands (name, slug, hex_color) VALUES ($1, $2, $3) RETURNING id, created_at",
		req.Name, req.Slug, req.HexColor,
	).Scan(&id, &createdAt)

	if err != nil {
		return Brand{}, fmt.Errorf("brands: create failed: %w", err)
	}

	return Brand{
		ID:        uuid.UUID(id.Bytes).String(),
		Name:      req.Name,
		Slug:      req.Slug,
		HexColor:  req.HexColor,
		CreatedAt: createdAt,
	}, nil
}

func DeleteBrand(ctx context.Context, pool *pgxpool.Pool, id string) error {
	ctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()

	u, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("invalid brand id")
	}

	_, err = pool.Exec(ctx, "DELETE FROM ops.brands WHERE id = $1", pgtype.UUID{Bytes: u, Valid: true})
	return err
}
