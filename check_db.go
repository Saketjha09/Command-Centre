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
	godotenv.Load("backend/.env")
	dsn := os.Getenv("DATABASE_DSN")
	conn, err := pgx.Connect(context.Background(), dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close(context.Background())

	var dataType string
	err = conn.QueryRow(context.Background(), 
		"SELECT data_type FROM information_schema.columns WHERE table_schema = 'ops' AND table_name = 'tasks' AND column_name = 'brand'",
	).Scan(&dataType)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Brand Column Type: %s\n", dataType)
}
