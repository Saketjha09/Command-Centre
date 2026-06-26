package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// Load environment variables from .env
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("backend/.env")

	dsn := os.Getenv("DATABASE_DSN")
	if dsn == "" {
		log.Fatal("Error: DATABASE_DSN environment variable is not set")
	}

	reader := bufio.NewReader(os.Stdin)

	// Check environment variables first, otherwise ask or default
	email := os.Getenv("SEED_EMAIL")
	if email == "" {
		fmt.Print("Email [admin@example.com]: ")
		input, _ := reader.ReadString('\n')
		email = strings.TrimSpace(input)
		if email == "" {
			email = "admin@example.com"
		}
	}

	name := os.Getenv("SEED_NAME")
	if name == "" {
		fmt.Print("Name [Super Admin]: ")
		input, _ := reader.ReadString('\n')
		name = strings.TrimSpace(input)
		if name == "" {
			name = "Super Admin"
		}
	}

	password := os.Getenv("SEED_PASSWORD")
	if password == "" {
		fmt.Print("Password [Password123!]: ")
		input, _ := reader.ReadString('\n')
		password = strings.TrimSpace(input)
		if password == "" {
			password = "Password123!"
		}
	}

	// Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Connect to database
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer conn.Close(ctx)

	fmt.Println("Inserting superadmin user...")

	var id string
	query := `
		INSERT INTO ops.users (name, email, hashed_password, role, is_active)
		VALUES ($1, $2, $3, 'superadmin', true)
		ON CONFLICT (email) DO UPDATE 
		SET name = EXCLUDED.name, hashed_password = EXCLUDED.hashed_password
		RETURNING id;
	`
	err = conn.QueryRow(ctx, query, name, email, string(hashed)).Scan(&id)
	if err != nil {
		log.Fatalf("Failed to insert/update user: %v", err)
	}

	fmt.Printf("Successfully seeded superadmin user! ID: %s\n", id)
}
