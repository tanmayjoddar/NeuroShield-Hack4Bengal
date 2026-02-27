# Render deployment script for Wallet1 backend
$ErrorActionPreference = "Stop"

Write-Host "Wallet Backend - Render Deployment Helper" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Check for Go
$hasGo = $null -ne (Get-Command go -ErrorAction SilentlyContinue)
if (-not $hasGo) {
    Write-Host "Go not found. Make sure Go is installed and in your PATH." -ForegroundColor Red
    Write-Host "Visit: https://go.dev/dl/ to install Go." -ForegroundColor Yellow
}

# Check for Docker
$hasDocker = $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
if (-not $hasDocker) {
    Write-Host "Docker not found. Install Docker to test your container locally." -ForegroundColor Red
    Write-Host "Visit: https://www.docker.com/products/docker-desktop/ to install Docker." -ForegroundColor Yellow
}

# Menu
Write-Host "`nOptions:" -ForegroundColor White
Write-Host "1. Build and test locally (Go)" -ForegroundColor Green
Write-Host "2. Build and test Docker image locally" -ForegroundColor Green
Write-Host "3. Show Render deployment instructions" -ForegroundColor Green
Write-Host "4. Exit" -ForegroundColor Red

$choice = Read-Host "`nEnter option"

switch ($choice) {
    "1" {
        if ($hasGo) {
            Write-Host "`nBuilding Go application locally..." -ForegroundColor Cyan
            $env:CGO_ENABLED = 0
            go build -o app.exe .
            if ($LASTEXITCODE -eq 0) {
                Write-Host "`nBuild successful!" -ForegroundColor Green
                Write-Host "Running the application locally..." -ForegroundColor Yellow

                # Start the application in a new PowerShell window
                Start-Process powershell -ArgumentList "-Command", ".\app.exe" -NoNewWindow
                Write-Host "`nApplication running on http://localhost:8080" -ForegroundColor Green
                Write-Host "Press any key to stop the application..." -ForegroundColor Yellow
                $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

                # Find and stop the process
                $process = Get-Process -Name "app" -ErrorAction SilentlyContinue
                if ($process) {
                    $process | Stop-Process -Force
                    Write-Host "Application stopped." -ForegroundColor Yellow
                }
            } else {
                Write-Host "Go build failed." -ForegroundColor Red
            }
        } else {
            Write-Host "Go not installed. Please install Go first." -ForegroundColor Red
        }
    }    "2" {
        if ($hasDocker) {
            Write-Host "`nBuilding Docker image locally..." -ForegroundColor Cyan
            docker build -t wallet-backend-render -f Dockerfile .
            if ($LASTEXITCODE -eq 0) {
                Write-Host "`nBuild successful! Testing container..." -ForegroundColor Green
                Write-Host "Running container with environment variables from .env file" -ForegroundColor Yellow

                # Run the container
                docker run -d --name wallet-backend-test -p 8080:8080 --env-file .env wallet-backend-render
                Write-Host "`nContainer running on http://localhost:8080" -ForegroundColor Green
                Write-Host "Press any key to stop the container..." -ForegroundColor Yellow
                $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                docker stop wallet-backend-test
                docker rm wallet-backend-test
            } else {
                Write-Host "Docker build failed." -ForegroundColor Red
            }
        } else {
            Write-Host "Docker not installed. Please install Docker first." -ForegroundColor Red
        }
    }    "3" {
        Write-Host "`nRender Deployment Instructions:" -ForegroundColor Cyan
        Write-Host "==============================" -ForegroundColor Cyan

        Write-Host "`nMethod 1: Automatic Deployment with render.yaml (Recommended)" -ForegroundColor White
        Write-Host "1. Push your code to your GitHub repository" -ForegroundColor White
        Write-Host "2. Log in to Render dashboard at https://dashboard.render.com" -ForegroundColor White
        Write-Host "3. Click 'New' and select 'Blueprint'" -ForegroundColor White
        Write-Host "4. Connect and select your GitHub repository" -ForegroundColor White
        Write-Host "5. Render will detect render.yaml and configure services automatically" -ForegroundColor White
        Write-Host "`n6. Set the following environment variables:" -ForegroundColor White

        # Read env file to suggest values
        if (Test-Path ".env") {
            $envFile = Get-Content ".env" | Where-Object { $_ -notmatch "^#" -and $_.Trim() -ne "" }
            foreach ($line in $envFile) {
                $key, $value = $line -split "=", 2
                Write-Host "   $key = $(if ($key -match "SECRET|KEY|PASSWORD|TOKEN") { "[Set a secure value]" } else { $value })" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   DATABASE_URL = [Your PostgreSQL connection string]" -ForegroundColor Yellow
            Write-Host "   JWT_SECRET = [A secure random string]" -ForegroundColor Yellow
            Write-Host "   ML_MODEL_URL = https://ml-fraud-transaction-detection.onrender.com/predict" -ForegroundColor Yellow
            Write-Host "   ENVIRONMENT = production" -ForegroundColor Yellow
            Write-Host "   ETH_RPC_URL = [Your Ethereum RPC URL]" -ForegroundColor Yellow
            Write-Host "   SCAM_REPORT_CONTRACT = [Your deployed contract address]" -ForegroundColor Yellow
            Write-Host "   REPORTER_PRIVATE_KEY = [Your wallet private key]" -ForegroundColor Yellow
            Write-Host "   CHAIN_ID = 11155111" -ForegroundColor Yellow
        }
          Write-Host "`n7. Click 'Apply' to start the deployment process" -ForegroundColor White

        Write-Host "`nMethod 2: Manual Deployment" -ForegroundColor White
        Write-Host "1. Log in to Render dashboard at https://dashboard.render.com" -ForegroundColor White
        Write-Host "2. Click 'New' and select 'Web Service'" -ForegroundColor White
        Write-Host "3. Connect and select your GitHub repository" -ForegroundColor White
        Write-Host "4. Configure settings:" -ForegroundColor White
        Write-Host "   - Environment: Docker" -ForegroundColor White
        Write-Host "   - Dockerfile path: ./backend/Dockerfile" -ForegroundColor White
        Write-Host "   - Health Check Path: /health" -ForegroundColor White
        Write-Host "5. Add environment variables listed above" -ForegroundColor White
        Write-Host "6. Click 'Create Web Service'" -ForegroundColor White

        Write-Host "`nFor more details, see RENDER_DEPLOYMENT.md or visit: https://render.com/docs/deploy-go-app" -ForegroundColor Cyan
    }
    "4" {
        Write-Host "Exiting..." -ForegroundColor Red
        exit
    }
    default {
        Write-Host "Invalid option. Exiting..." -ForegroundColor Red
    }
}
