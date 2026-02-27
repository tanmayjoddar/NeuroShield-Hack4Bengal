# Wallet Backend Deployment Guide for Render

This guide covers deploying the Wallet1 Go backend service to [Render](https://render.com).

## Prerequisites

- GitHub repository with your code
- Render account
- PostgreSQL database (can be hosted on Render or elsewhere)

## Deployment Steps

### Method 1: Automatic Deployment with render.yaml (Recommended)

1. **Log in to Render** and navigate to the dashboard.

2. **Click "New" and select "Blueprint"** from the dropdown menu.

3. **Connect your GitHub repository** if not already connected.

4. **Select your repository** (TJ456/Wallet1) and the branch you want to deploy.

5. **Render will automatically detect the `render.yaml` file** in your repository and configure the services described in it.

6. **Set up your secrets** in the Render dashboard:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `JWT_SECRET`: A secure secret for JWT token signing
   - `ETH_RPC_URL`: Your Ethereum RPC URL (e.g., from Infura or Alchemy)
   - `SCAM_REPORT_CONTRACT`: Your deployed contract address
   - `REPORTER_PRIVATE_KEY`: Private key for blockchain transactions

7. **Select your repository** and Render will automatically detect the `render.yaml` file.

8. **Configure environment variables** for all the secrets:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `JWT_SECRET`: A secure secret for JWT token generation
   - `ETH_RPC_URL`: Your Ethereum RPC endpoint
   - `SCAM_REPORT_CONTRACT`: Your contract address
   - `REPORTER_PRIVATE_KEY`: Your private key for transactions

9. **Deploy** and Render will build and run your Go backend automatically.

10. **Click "Apply"** to start the deployment process.

11. **Wait for the deployment to complete**. You can monitor the progress in the Render dashboard.

### Method 2: Manual Deployment

If you prefer to deploy manually:

1. **Create a new Web Service** in the Render dashboard.

2. **Connect your GitHub repository** and select the appropriate branch.

3. **Configure your service**:
   - **Name**: wallet-backend
   - **Environment**: Docker
   - **Region**: Choose nearest to your users
   - **Branch**: main (or your preferred branch)
   - **Dockerfile Path**: ./backend/Dockerfile
   - **Health Check Path**: /health

4. **Add environment variables** in the dashboard:

   ```
   DATABASE_URL=postgresql://username:password@hostname:port/database
   ML_MODEL_URL=https://ml-fraud-transaction-detection.onrender.com/predict
   JWT_SECRET=your-secure-jwt-secret
   ENVIRONMENT=production
   ETH_RPC_URL=your-eth-rpc-url
   SCAM_REPORT_CONTRACT=your-contract-address
   REPORTER_PRIVATE_KEY=your-private-key
   CHAIN_ID=11155111
   ```

5. **Click "Create Web Service"** to deploy.

## Setting Up PostgreSQL on Render

1. **Create a new PostgreSQL database** in the Render dashboard.

2. **Take note of the connection information**:
   - Internal Database URL
   - External Database URL
   - Username, Password
   - Database Name

3. **Use the Internal Database URL** for your wallet-backend service if both are hosted on Render.

## Connecting Frontend to Backend

Update your frontend's API URL to point to your Render-hosted backend:

```javascript
// Example configuration in your frontend
const API_BASE_URL = "https://wallet-backend.onrender.com";
```

Make sure your CORS configuration in the backend allows requests from your frontend domain.

## Monitoring and Logs

- Monitor your service health in the Render dashboard
- View logs in real-time for debugging
- Set up alerts for potential issues

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check that your DATABASE_URL is correct
   - Verify that the database is accessible from your service

2. **Port Configuration**
   - Render automatically assigns a PORT value
   - Your application should read from process.env.PORT

3. **Health Check Failures**
   - Ensure your /health endpoint is working correctly
   - Check application logs for startup errors

4. **Build Failures**
   - Check for errors in the build logs
   - Verify that your Dockerfile is valid

For additional help, consult the [Render documentation](https://render.com/docs) or contact Render support.
