package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load("../.env")
	dsn := os.Getenv("DATABASE_DSN")
	if dsn == "" {
		log.Fatal("DATABASE_DSN not set")
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close(ctx)

	migration, err := os.ReadFile("../db/migrations/005_availability_comments.sql")
	if err != nil {
		log.Fatal(err)
	}

	_, err = conn.Exec(ctx, string(migration))
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Migration 004 applied successfully!")
}
